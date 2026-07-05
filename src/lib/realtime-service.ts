import "server-only";

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
