import "server-only";

// Private conversation/profile/presence topics use both opaque HMAC names and
// Supabase Realtime Authorization. A short-lived custom JWT identifies the
// accountable profile; RLS on realtime.messages checks a server-issued topic
// grant before allowing Broadcast or Presence access. Feed remains public.

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { withDbRequestContext } from "@/lib/db-context";
import { logExecutionError } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase-storage";

const FEED_REALTIME_CHANNEL = "feed:public";
const REALTIME_SECRET_ENV_KEYS = ["REALTIME_CHANNEL_SECRET"];
const REALTIME_AUTH_TTL_SECONDS = 5 * 60;
const REALTIME_GRANT_TTL_SECONDS = 10 * 60;
const REALTIME_RPC_TIMEOUT_MS = 5_000;

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

export function isPrivateRealtimeChannel(channelName: string) {
  return channelName !== FEED_REALTIME_CHANNEL;
}

export async function issueRealtimeAuthorization(
  current: CurrentUserProfile
) {
  const conversations = await listRealtimeConversations(current);
  const grants = buildRealtimeTopicGrants(current.profileId, conversations);
  if (grants.length === 0) throw new Error("realtime.not_configured");

  const nowSeconds = Math.floor(Date.now() / 1000);
  const grantExpiry = new Date(
    (nowSeconds + REALTIME_GRANT_TTL_SECONDS) * 1000
  );
  const client = getSupabaseAdminClient();
  const { error } = await client.rpc(
    "giq_replace_realtime_topic_grants",
    {
      requested_profile_id: current.profileId,
      requested_grants: grants,
      requested_expires_at: grantExpiry.toISOString(),
    }
  );
  if (error) throw new Error("realtime.grant_sync_failed");

  // A block can race the cross-database grant replacement. Re-check the app
  // database after replacement and remove any topic that became inaccessible
  // while the Supabase RPC was in flight.
  const revalidatedConversations = await listRealtimeConversations(
    current,
    conversations.map((conversation) => conversation.id)
  );
  const revalidatedIds = new Set(
    revalidatedConversations
      .filter((conversation) =>
        canProfileAccessConversationRealtime(current.profileId, conversation)
      )
      .map((conversation) => conversation.id)
  );
  const staleTopics = conversations.flatMap((conversation) => {
    if (revalidatedIds.has(conversation.id)) return [];
    const topic = conversationRealtimeChannel(conversation.id);
    return topic ? [topic] : [];
  });
  if (staleTopics.length > 0) {
    await revokeRealtimeTopicGrants([current.profileId], staleTopics, client);
  }

  const expiresAt = nowSeconds + REALTIME_AUTH_TTL_SECONDS;
  const staleTopicSet = new Set(staleTopics);
  const topics = [
    ...new Set(
      grants
        .map((grant) => grant.topic)
        .filter((topic) => !staleTopicSet.has(topic))
    ),
  ];
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

type RealtimeTopicGrant = {
  topic: string;
  extension: "broadcast" | "presence";
};

/** @internal Exported for the server-side authorization regression test. */
export function buildRealtimeTopicGrants(
  profileId: string,
  conversations: RealtimeConversationAccessRecord[]
): RealtimeTopicGrant[] {
  const profileTopic = profileRealtimeChannel(profileId);
  return [
    ...conversations
      .filter((conversation) =>
        canProfileAccessConversationRealtime(profileId, conversation)
      )
      .flatMap((conversation) => {
        const topic = conversationRealtimeChannel(conversation.id);
        return topic
          ? [
              { topic, extension: "broadcast" },
              { topic, extension: "presence" },
            ]
          : [];
      }),
    ...(profileTopic ? [{ topic: profileTopic, extension: "broadcast" }] : []),
  ] as RealtimeTopicGrant[];
}

type RealtimeConversationAccessRecord = {
  id: string;
  participantAId: string;
  participantBId: string;
  blockedById: string | null;
};

/** @internal Exported for the server-side authorization regression test. */
export function canProfileAccessConversationRealtime(
  profileId: string,
  conversation: RealtimeConversationAccessRecord
) {
  return (
    conversation.blockedById === null &&
    (conversation.participantAId === profileId ||
      conversation.participantBId === profileId)
  );
}

function listRealtimeConversations(
  current: CurrentUserProfile,
  conversationIds?: string[]
) {
  if (conversationIds && conversationIds.length === 0) return Promise.resolve([]);
  return withDbRequestContext(current, (tx) =>
    tx.conversation.findMany({
      where: {
        ...(conversationIds ? { id: { in: conversationIds } } : {}),
        blockedById: null,
        OR: [
          { participantAId: current.profileId },
          { participantBId: current.profileId },
        ],
      },
      select: {
        id: true,
        participantAId: true,
        participantBId: true,
        blockedById: true,
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    })
  );
}

/**
 * Remove an already-issued conversation grant for both participants when a
 * block takes effect. Future token issuance independently excludes blocked
 * conversations, so a failed/retried block cannot restore access.
 */
export async function revokeConversationRealtimeGrants(
  conversationId: string,
  profileIds: string[],
  client?: SupabaseClient
) {
  const topic = conversationRealtimeChannel(conversationId);
  const uniqueProfileIds = [
    ...new Set(profileIds.map((profileId) => profileId.trim()).filter(Boolean)),
  ];
  if (!topic || uniqueProfileIds.length === 0) return;

  await revokeRealtimeTopicGrants(
    uniqueProfileIds,
    [topic],
    client ?? getSupabaseAdminClient(),
  );
}

async function revokeRealtimeTopicGrants(
  profileIds: string[],
  topics: string[],
  client: SupabaseClient
) {
  const request = client.rpc("giq_revoke_realtime_topic_grants", {
    requested_profile_ids: profileIds,
    requested_topics: topics,
  });
  const boundedRequest = request.abortSignal?.(
    AbortSignal.timeout(REALTIME_RPC_TIMEOUT_MS),
  ) ?? request;
  const { error } = await boundedRequest;
  if (error) throw new Error("realtime.grant_revoke_failed");
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
    await logExecutionError(
      "realtime.broadcast_failed",
      { channelName, event },
      err,
    );
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
  return null;
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("your_") || normalized.includes("your-");
}
