import "server-only";

// Private conversation/profile/presence topics use both opaque HMAC names and
// Supabase Realtime Authorization. A short-lived custom JWT identifies the
// accountable profile; RLS on realtime.messages checks a server-issued topic
// grant before allowing Broadcast or Presence access. Feed remains public.

import { createHmac } from "node:crypto";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { withDbRequestContext } from "@/lib/db-context";
import { logError } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase-storage";

const FEED_REALTIME_CHANNEL = "feed:public";
const REALTIME_SECRET_ENV_KEYS = ["REALTIME_CHANNEL_SECRET"];
const REALTIME_AUTH_TTL_SECONDS = 5 * 60;
const REALTIME_GRANT_TTL_SECONDS = 10 * 60;

let loggedMissingSecret = false;

type RealtimeEventPayload = Record<string, string | number | boolean | null>;

export function publicFeedRealtimeChannel() {
  return FEED_REALTIME_CHANNEL;
}

export function conversationRealtimeChannel(conversationId: string) {
  return scopedRealtimeChannel("conversation", conversationId);
}

export function profileRealtimeChannel(profileId: string) {
  return scopedRealtimeChannel("profile", profileId);
}

// Single shared presence channel for the signed-in member hub. The name is
// still HMAC-derived (unguessable to signed-out clients), but every signed-in
// member receives the same name, so presence payloads must stay content-free:
// profileId only. Clients filter to their accepted-friend ids. Upgrade path if
// cross-member visibility becomes a concern: per-profile presence scopes.
export function membersPresenceChannel() {
  return scopedRealtimeChannel("presence", "members");
}

export function isPrivateRealtimeChannel(channelName: string) {
  return channelName !== FEED_REALTIME_CHANNEL;
}

export async function issueRealtimeAuthorization(
  current: CurrentUserProfile
) {
  const conversations = await withDbRequestContext(current, (tx) =>
    tx.conversation.findMany({
      where: {
        OR: [
          { participantAId: current.profileId },
          { participantBId: current.profileId },
        ],
      },
      select: { id: true },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    })
  );
  const profileTopic = profileRealtimeChannel(current.profileId);
  const presenceTopic = membersPresenceChannel();
  const grants = [
    ...conversations.flatMap((conversation) => {
      const topic = conversationRealtimeChannel(conversation.id);
      return topic
        ? [
            { topic, extension: "broadcast" },
            { topic, extension: "presence" },
          ]
        : [];
    }),
    ...(profileTopic ? [{ topic: profileTopic, extension: "broadcast" }] : []),
    ...(presenceTopic ? [{ topic: presenceTopic, extension: "presence" }] : []),
  ];
  if (grants.length === 0) throw new Error("realtime.not_configured");

  const nowSeconds = Math.floor(Date.now() / 1000);
  const grantExpiry = new Date(
    (nowSeconds + REALTIME_GRANT_TTL_SECONDS) * 1000
  );
  const { error } = await getSupabaseAdminClient().rpc(
    "giq_replace_realtime_topic_grants",
    {
      requested_profile_id: current.profileId,
      requested_grants: grants,
      requested_expires_at: grantExpiry.toISOString(),
    }
  );
  if (error) throw new Error("realtime.grant_sync_failed");

  const expiresAt = nowSeconds + REALTIME_AUTH_TTL_SECONDS;
  const topics = [...new Set(grants.map((grant) => grant.topic))];
  return {
    token: signRealtimeJwt({
      iss: "supabase",
      aud: "authenticated",
      role: "authenticated",
      sub: current.dbUserId,
      profile_id: current.profileId,
      iat: nowSeconds,
      exp: expiresAt,
    }),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    topics,
  };
}

function scopedRealtimeChannel(scope: string, id: string) {
  const secret = realtimeChannelSecret();
  if (!secret) return null;

  const digest = createHmac("sha256", secret)
    .update(`${scope}:${id}`)
    .digest("hex")
    .slice(0, 48);
  return `${scope}:${digest}`;
}

export async function broadcastFeedRealtimeEvent(
  event: string,
  payload: RealtimeEventPayload
) {
  await broadcastRealtimeEvent(FEED_REALTIME_CHANNEL, event, payload);
}

export async function broadcastConversationRealtimeEvent(
  conversationId: string,
  event: string,
  payload: RealtimeEventPayload
) {
  const channel = conversationRealtimeChannel(conversationId);
  if (!channel) return;
  await broadcastRealtimeEvent(channel, event, payload);
}

export async function broadcastProfileRealtimeEvent(
  profileId: string,
  event: string,
  payload: RealtimeEventPayload
) {
  const channel = profileRealtimeChannel(profileId);
  if (!channel) return;
  await broadcastRealtimeEvent(channel, event, payload);
}

async function broadcastRealtimeEvent(
  channelName: string,
  event: string,
  payload: RealtimeEventPayload
) {
  if (process.env.REALTIME_BROADCAST_DISABLED === "true") return;

  try {
    const client = getSupabaseAdminClient();
    const channel = client.channel(channelName, {
      config: { private: isPrivateRealtimeChannel(channelName) },
    });
    try {
      await channel.httpSend(event, payload);
    } finally {
      await client.removeChannel(channel);
    }
  } catch (err) {
    logError("realtime.broadcast_failed", { channelName, event }, err);
    if (process.env.REALTIME_BROADCAST_STRICT === "true") throw err;
  }
}

function signRealtimeJwt(payload: Record<string, string | number>) {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret || secret.length < 32 || looksLikePlaceholder(secret)) {
    throw new Error("realtime.jwt_secret_not_configured");
  }
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const body = base64UrlJson(payload);
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function realtimeChannelSecret() {
  for (const key of REALTIME_SECRET_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim() && !looksLikePlaceholder(value)) return value;
  }
  if (process.env.NODE_ENV === "production" && !loggedMissingSecret) {
    loggedMissingSecret = true;
    logError("realtime.secret_missing");
  }
  return null;
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("your_") || normalized.includes("your-");
}
