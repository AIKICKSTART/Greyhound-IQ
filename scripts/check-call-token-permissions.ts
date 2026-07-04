import assert from "node:assert/strict";

import {
  callRoomJoinWhere,
  createLiveKitCallToken,
} from "../src/lib/call-token";

const roomId = "call_room_test";
const profileId = "profile_test";
const roomNow = new Date("2026-07-04T00:00:00.000Z");
const where = callRoomJoinWhere(roomId, profileId, roomNow) as Record<
  string,
  unknown
>;

assert.equal(where.id, roomId);
assert.equal(where.status, "active");
assert.deepEqual(where.createdAt, {
  gte: new Date("2026-07-03T22:00:00.000Z"),
});
assert.deepEqual(where.permissions, {
  some: {
    profileId,
    canJoin: true,
  },
});

const nowSeconds = 1_700_000_000;
const signed = createLiveKitCallToken(
  { profileId, displayName: "Token Test User" },
  "room-test",
  {
    url: "wss://livekit.example.test",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
  },
  nowSeconds
);

const [headerPart, payloadPart, signaturePart] = signed.token.split(".");
assert.ok(headerPart);
assert.ok(payloadPart);
assert.ok(signaturePart);

const header = decodeJwtPart(headerPart);
const payload = decodeJwtPart(payloadPart);

assert.deepEqual(header, { alg: "HS256", typ: "JWT" });
assert.equal(payload.iss, "test-api-key");
assert.equal(payload.sub, profileId);
assert.equal(payload.name, "Token Test User");
assert.equal(payload.nbf, nowSeconds - 5);
assert.equal(payload.exp, nowSeconds + 10 * 60);
assert.deepEqual(payload.video, {
  room: "room-test",
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
});
assert.equal(signed.expiresAtSeconds, nowSeconds + 10 * 60);

console.log("Call token permission checks passed");

function decodeJwtPart(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}
