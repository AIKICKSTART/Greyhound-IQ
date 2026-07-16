import type { Prisma } from "@prisma/client";
import { AccessToken, TrackSource } from "livekit-server-sdk";

const LIVEKIT_TOKEN_TTL_SECONDS = 10 * 60;
export const CALL_ROOM_JOIN_TTL_MS = 2 * 60 * 60 * 1000;

export type LiveKitConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

export type CallType = "voice" | "video";

export function callRoomJoinWhere(
  roomId: string,
  profileId: string,
  now = new Date()
): Prisma.CallRoomWhereInput {
  return {
    id: roomId,
    status: "active",
    // ponytail: room-level TTL; use participant heartbeats if call recovery needs longer windows.
    createdAt: { gte: new Date(now.getTime() - CALL_ROOM_JOIN_TTL_MS) },
    permissions: {
      some: {
        profileId,
        canJoin: true,
      },
    },
  };
}

export async function createLiveKitCallToken(
  current: { profileId: string; displayName: string },
  roomName: string,
  callType: CallType,
  config: LiveKitConfig,
) {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: current.profileId,
    name: current.displayName,
    ttl: LIVEKIT_TOKEN_TTL_SECONDS,
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishSources:
      callType === "voice"
        ? [TrackSource.MICROPHONE]
        : [
            TrackSource.MICROPHONE,
            TrackSource.CAMERA,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
          ],
    canSubscribe: true,
    canPublishData: false,
  });

  const signed = await token.toJwt();

  return {
    token: signed,
    expiresAtSeconds: jwtExpiry(signed),
  };
}

function jwtExpiry(token: string) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("call.token_invalid");
  const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    exp?: unknown;
  };
  if (typeof exp !== "number") throw new Error("call.token_invalid");
  return exp;
}
