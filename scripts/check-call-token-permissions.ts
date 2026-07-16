import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TokenVerifier, WebhookReceiver } from "livekit-server-sdk";

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

  const tokenConfig = {
    url: "wss://livekit.example.test",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret-for-livekit-token-verification",
  };
  const verifier = new TokenVerifier(tokenConfig.apiKey, tokenConfig.apiSecret);
  const voiceSigned = await createLiveKitCallToken(
    { profileId, displayName: "Token Test User" },
    "room-test",
    "voice",
    tokenConfig
  );

  const [headerPart, payloadPart, signaturePart] = voiceSigned.token.split(".");
  assert.ok(headerPart);
  assert.ok(payloadPart);
  assert.ok(signaturePart);

  const header = decodeJwtPart(headerPart);
  const voicePayload = await verifier.verify(voiceSigned.token);

  assert.equal(header.alg, "HS256");
  assert.equal(voicePayload.iss, tokenConfig.apiKey);
  assert.equal(voicePayload.sub, profileId);
  assert.equal(voicePayload.name, "Token Test User");
  assert.equal(voicePayload.video?.room, "room-test");
  assert.equal(voicePayload.video?.roomJoin, true);
  assert.equal(voicePayload.video?.canPublish, true);
  assert.equal(voicePayload.video?.canSubscribe, true);
  assert.equal(voicePayload.video?.canPublishData, false);
  assert.deepEqual(voicePayload.video?.canPublishSources, ["microphone"]);
  assert.equal(voiceSigned.expiresAtSeconds, voicePayload.exp);
  assert.ok(
    voiceSigned.expiresAtSeconds - Math.floor(Date.now() / 1000) <= 10 * 60,
    "voice token TTL is at most 10 minutes"
  );

  const videoSigned = await createLiveKitCallToken(
    { profileId, displayName: "Token Test User" },
    "room-video-test",
    "video",
    tokenConfig
  );
  const videoPayload = await verifier.verify(videoSigned.token);
  assert.equal(videoPayload.video?.room, "room-video-test");
  assert.deepEqual(videoPayload.video?.canPublishSources, [
    "microphone",
    "camera",
    "screen_share",
    "screen_share_audio",
  ]);

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

  // ── Tier-gate placement (free receivers may join, only paid may start) ────
  // Source-level invariant: createCallRoomForConversation keeps the paid gate;
  // createCallTokenForCurrentUser must NOT have it (free receivers mint join
  // tokens for rooms holding their CallPermission.canJoin row).
  const callServiceSource = readFileSync(
    join(__dirname, "..", "src", "lib", "call-service.ts"),
    "utf8"
  );
  const createRoomBody = sliceFunction(
    callServiceSource,
    "createCallRoomForConversation"
  );
  const createTokenBody = sliceFunction(
    callServiceSource,
    "createCallTokenForCurrentUser"
  );
  assert.ok(
    createRoomBody.includes("assertPaidFeatureAccess"),
    "createCallRoomForConversation must keep the paid initiation gate"
  );
  assert.ok(
    !createTokenBody.includes("assertPaidFeatureAccess("),
    "createCallTokenForCurrentUser must not tier-gate receivers joining"
  );
  const callTokenSource = readFileSync(
    join(__dirname, "..", "src", "lib", "call-token.ts"),
    "utf8"
  );
  assert.ok(callTokenSource.includes("new AccessToken("), "LiveKit SDK must sign call tokens");
  assert.ok(!callTokenSource.includes("createHmac"), "call tokens must not use hand-built JWT signing");
  console.log("PASS: call initiation paid-gated, token join ungated");
  // ── End tier-gate placement ────────────────────────────────────────────────
}

// Text between a named export and the next top-level export — enough to
// assert which gates live inside which function without executing DB code.
function sliceFunction(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `call-service.ts must export ${name}`);
  const rest = source.slice(start + 1);
  const nextExport = rest.search(/\nexport /);
  return nextExport >= 0 ? rest.slice(0, nextExport) : rest;
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
