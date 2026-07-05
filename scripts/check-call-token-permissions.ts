import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";

import { WebhookReceiver } from "livekit-server-sdk";

import {
  callRoomJoinWhere,
  createLiveKitCallToken,
} from "../src/lib/call-token";

main().catch((err) => {
  console.error("Call token permission checks failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
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
    canPublishData: false,
  });
  assert.equal(signed.expiresAtSeconds, nowSeconds + 10 * 60);

  console.log("Call token permission checks passed");

  // ── Webhook signature verification ────────────────────────────────────────
  // Use WebhookReceiver directly (livekit-admin.ts has "server-only" which
  // requires --conditions=react-server; check:calls runs without that flag).
  const WEBHOOK_API_KEY = "test-webhook-api-key";
  // ≥32 bytes for jose HS256
  const WEBHOOK_API_SECRET = "test-webhook-api-secret-for-hmac-sig-verification";

  const receiver = new WebhookReceiver(WEBHOOK_API_KEY, WEBHOOK_API_SECRET);

  const webhookBody = JSON.stringify({
    event: "room_finished",
    room: { name: "ghiq-webhook-test" },
  });

  // Valid signature accepted
  const jwt = buildWebhookJwt(webhookBody, WEBHOOK_API_KEY, WEBHOOK_API_SECRET);
  const event = await receiver.receive(webhookBody, jwt);
  assert.ok(event, "valid webhook JWT accepted by WebhookReceiver");
  console.log("PASS: valid webhook JWT accepted");

  // Tampered body rejected (sha256 mismatch)
  const jwtForTamper = buildWebhookJwt(webhookBody, WEBHOOK_API_KEY, WEBHOOK_API_SECRET);
  const tamperedBody = webhookBody.replace("room_finished", "room_started");
  await assert.rejects(
    () => receiver.receive(tamperedBody, jwtForTamper),
    "tampered body rejected by WebhookReceiver",
  );
  console.log("PASS: tampered body rejected");

  // Wrong secret rejected
  const jwtWrongSecret = buildWebhookJwt(
    webhookBody,
    WEBHOOK_API_KEY,
    "wrong-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  );
  await assert.rejects(
    () => receiver.receive(webhookBody, jwtWrongSecret),
    "wrong-secret JWT rejected by WebhookReceiver",
  );
  console.log("PASS: wrong-secret JWT rejected");
  // ── End webhook signature verification ────────────────────────────────────
}

function buildWebhookJwt(body: string, apiKey: string, apiSecret: string): string {
  const sha256hex = createHash("sha256").update(body).digest();
  // WebhookReceiver checks: btoa(Array.from(uint8).map(v=>String.fromCharCode(v)).join(""))
  // which is standard base64 (not base64url).
  const sha256b64 = Buffer.from(sha256hex).toString("base64");

  const ts = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const claim = {
    iss: apiKey,
    sha256: sha256b64,
    nbf: ts - 5,
    exp: ts + 60,
  };
  const unsigned = `${b64urlJson(header)}.${b64urlJson(claim)}`;
  const sig = createHmac("sha256", apiSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${sig}`;
}

function b64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJwtPart(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}
