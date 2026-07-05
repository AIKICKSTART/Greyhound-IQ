import "server-only";

import { RoomServiceClient, WebhookReceiver } from "livekit-server-sdk";
import type { LiveKitConfig } from "@/lib/call-token";
import { logError } from "@/lib/logger";

export function liveKitConfig(): LiveKitConfig {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) throw new Error("call.not_configured");
  return { url, apiKey, apiSecret };
}

// Best-effort remote room teardown. Never throws: the DB is the source of
// truth and the webhook + call-maintenance cron reconcile any drift.
export async function deleteLiveKitRoom(roomName: string): Promise<void> {
  try {
    const config = liveKitConfig();
    const client = new RoomServiceClient(
      config.url.replace(/^ws/, "http"),
      config.apiKey,
      config.apiSecret
    );
    await client.deleteRoom(roomName);
  } catch (err) {
    logError("livekit.delete_room_failed", { roomName }, err);
  }
}

// Verifies the webhook signature; verification errors throw for the caller.
export async function receiveLiveKitWebhook(
  body: string,
  authHeader: string | null
) {
  const config = liveKitConfig();
  const receiver = new WebhookReceiver(config.apiKey, config.apiSecret);
  return receiver.receive(body, authHeader ?? undefined);
}
