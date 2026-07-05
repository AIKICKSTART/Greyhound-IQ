import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";

const LIVEKIT_TOKEN_TTL_SECONDS = 10 * 60;
export const CALL_ROOM_JOIN_TTL_MS = 2 * 60 * 60 * 1000;

export type LiveKitConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

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

export function createLiveKitCallToken(
  current: { profileId: string; displayName: string },
  roomName: string,
  config: LiveKitConfig,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const expiresAtSeconds = nowSeconds + LIVEKIT_TOKEN_TTL_SECONDS;
  const payload = {
    iss: config.apiKey,
    sub: current.profileId,
    name: current.displayName,
    nbf: nowSeconds - 5,
    exp: expiresAtSeconds,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    },
  };

  return {
    token: signJwt(payload, config.apiSecret),
    expiresAtSeconds,
  };
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createHmac("sha256", secret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
