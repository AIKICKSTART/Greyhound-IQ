import "server-only";

// Realtime authorization model: channel-name secrecy (NOT Supabase Realtime
// Authorization / RLS on realtime.messages — that is the deferred upgrade path).
//
// - Channel names for scoped (conversation/profile) channels are HMAC-SHA256
//   digests of `${scope}:${id}` keyed by REALTIME_CHANNEL_SECRET. They are
//   unguessable capabilities: possessing the name is the access token.
// - Names are only ever issued server-side to the authenticated owner: the
//   profile channel is derived from the session's own profileId, and the
//   conversation channel is derived from a conversation id that
//   getConversationForProfile already gated to a participant. A client cannot
//   pass an arbitrary profileId to obtain someone else's channel name.
// - REALTIME_CHANNEL_SECRET is server-only (this module is "server-only" and
//   the secret is never exposed via NEXT_PUBLIC_* or serialized into props);
//   only the derived name reaches the client.
// - Rotation = rotate REALTIME_CHANNEL_SECRET; all existing names change and
//   stale subscribers are evicted from the new topics.
// - Residual risk: a channel name could leak via client logs/referrers, and
//   because Supabase presence is client-asserted, a participant on a shared
//   channel can spoof the other party's presence label. Both are bounded to
//   already-authorized 1:1 channels and content-free (ids/flags only) payloads.
// - Upgrade path if name secrecy proves insufficient: enable Supabase Realtime
//   Authorization with RLS on realtime.messages keyed to conversation
//   membership, and drop the HMAC naming.

import { createHmac } from "node:crypto";
import { logError } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase-storage";

const FEED_REALTIME_CHANNEL = "feed:public";
const REALTIME_SECRET_ENV_KEYS = ["REALTIME_CHANNEL_SECRET"];

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
    const channel = client.channel(channelName);
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
