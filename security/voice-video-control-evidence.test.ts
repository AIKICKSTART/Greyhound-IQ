import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { TokenVerifier } from "livekit-server-sdk";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  CALL_ROOM_JOIN_TTL_MS,
  callRoomJoinWhere,
  createLiveKitCallToken,
} from "../src/lib/call-token";
import {
  callInviteActionSchema,
  callRoomIdSchema,
} from "../src/lib/call-validation";
import {
  OPEN_VOICE_VIDEO_CONTROL_GAPS,
  VERIFIED_VOICE_VIDEO_CONTROL_IDS,
  VOICE_VIDEO_CONTROL_MASTER_EVIDENCE,
} from "./voice-video-control-evidence";

const expectedVerifiedIds = [
  "security.voice-video-control.short-lived",
  "security.voice-video-control.scope",
  "security.voice-video-control.no-master-secret",
  "security.voice-video-control.membership",
  "security.voice-video-control.blocks",
  "security.voice-video-control.invitation-limit",
  "security.voice-video-control.lifecycle-audit",
  "security.voice-video-control.removal",
  "security.voice-video-control.expiry",
  "security.voice-video-control.enumeration",
] as const;

assert.deepEqual(VERIFIED_VOICE_VIDEO_CONTROL_IDS, expectedVerifiedIds);
assert.deepEqual(
  Object.keys(VOICE_VIDEO_CONTROL_MASTER_EVIDENCE),
  expectedVerifiedIds,
);
assert.equal(new Set(VERIFIED_VOICE_VIDEO_CONTROL_IDS).size, 10);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
const config = {
  url: "wss://voice-video-control.example.test",
  apiKey: "voice-video-control-test-key",
  apiSecret: "voice-video-control-test-secret-at-least-32-bytes",
};
const verifier = new TokenVerifier(config.apiKey, config.apiSecret);
const beforeIssueSeconds = Math.floor(Date.now() / 1000);
const voice = await createLiveKitCallToken(
  { profileId: "profile-a", displayName: "Profile A" },
  "room-a",
  "voice",
  config,
);
const voiceClaims = await verifier.verify(voice.token);
assert.equal(voiceClaims.sub, "profile-a");
assert.equal(voiceClaims.name, "Profile A");
assert.equal(voiceClaims.video?.room, "room-a");
assert.equal(voiceClaims.video?.roomJoin, true);
assert.equal(voiceClaims.video?.canPublishData, false);
assert.deepEqual(voiceClaims.video?.canPublishSources, ["microphone"]);
assert.equal(voice.expiresAtSeconds, voiceClaims.exp);
assert.ok(voice.expiresAtSeconds > beforeIssueSeconds);
assert.ok(voice.expiresAtSeconds - beforeIssueSeconds <= 10 * 60);
assert.deepEqual(Object.keys(voice).toSorted(), ["expiresAtSeconds", "token"]);

const video = await createLiveKitCallToken(
  { profileId: "profile-b", displayName: "Profile B" },
  "room-b",
  "video",
  config,
);
const videoClaims = await verifier.verify(video.token);
assert.equal(videoClaims.sub, "profile-b");
assert.equal(videoClaims.video?.room, "room-b");
assert.deepEqual(videoClaims.video?.canPublishSources, [
  "microphone",
  "camera",
  "screen_share",
  "screen_share_audio",
]);
await assert.rejects(() =>
  new TokenVerifier(config.apiKey, `${config.apiSecret}-wrong`).verify(voice.token),
);

const now = new Date("2026-07-15T00:00:00.000Z");
assert.deepEqual(callRoomJoinWhere("room-a", "profile-a", now), {
  id: "room-a",
  status: "active",
  createdAt: { gte: new Date(now.getTime() - CALL_ROOM_JOIN_TTL_MS) },
  permissions: { some: { profileId: "profile-a", canJoin: true } },
});

assert.equal(callInviteActionSchema.safeParse({ action: "accept" }).success, true);
assert.equal(callInviteActionSchema.safeParse({ action: "decline" }).success, true);
assert.equal(callInviteActionSchema.safeParse({ action: "invite" }).success, false);
assert.equal(callRoomIdSchema.safeParse(" ").success, false);
assert.equal(callRoomIdSchema.safeParse("x".repeat(121)).success, false);

const callToken = source("src/lib/call-token.ts");
const callService = source("src/lib/call-service.ts");
const liveKitAdmin = source("src/lib/livekit-admin.ts");
const liveKitConfig = source("src/lib/livekit-config.ts");
const createRoute = source("src/app/api/calls/rooms/route.ts");
const tokenRoute = source("src/app/api/calls/[roomId]/token/route.ts");
const inviteRoute = source("src/app/api/calls/[roomId]/invite/route.ts");
const endRoute = source("src/app/api/calls/[roomId]/end/route.ts");
const webhookRoute = source("src/app/api/livekit/webhook/route.ts");
const packageJson = source("package.json");
const workflow = source(".github/workflows/ci.yml");

assert.match(callToken, /const LIVEKIT_TOKEN_TTL_SECONDS = 10 \* 60/);
assert.match(callToken, /identity: current\.profileId/);
assert.match(callToken, /room: roomName/);
assert.match(callToken, /canPublishData: false/);
assert.doesNotMatch(callToken, /createHmac|sign\s*\(/);

assert.match(liveKitAdmin, /^import "server-only";/);
assert.match(liveKitAdmin, /readLiveKitDeploymentConfig\(process\.env\)/);
assert.match(liveKitConfig, /env\[`\$\{prefix\}_API_SECRET`\]/);
assert.doesNotMatch(tokenRoute, /LIVEKIT_API_SECRET|apiSecret/);

const createTokenBody = exportedFunction(callService, "createCallTokenForCurrentUser");
assert.match(createTokenBody, /callRoomJoinWhere\(roomId, current\.profileId\)/);
assert.match(createTokenBody, /if \(!room\) throw new Error\("call\.room_not_found"\)/);
assert.match(createTokenBody, /if \(room\.conversation\?\.blockedById\)/);
assert.match(createTokenBody, /assertProfilesCanInteract\(/);
assert.match(createTokenBody, /eventType: "token_issued"/);
assert.match(createTokenBody, /action: "call\.token\.issue"/);

const createRoomBody = exportedFunction(callService, "createCallRoomForConversation");
assert.match(createRoomBody, /getConversationForProfile\(/);
assert.match(createRoomBody, /assertProfilesCanInteract\(/);
assert.match(createRoomBody, /invites:\s*\{\s*create:/);
assert.match(createRoomBody, /expiresAt: inviteExpiresAt/);
assert.match(createRoomBody, /eventType: "room_created"/);
assert.match(createRoomBody, /action: "call\.room\.create"/);

for (const [route, limit, key] of [
  [createRoute, "10", "call:room:"],
  [tokenRoute, "20", "call:token:"],
  [inviteRoute, "20", "call:invite:"],
  [endRoute, "20", "call:end:"],
] as const) {
  assert.match(route, /requireCurrentUserProfile\(\)/);
  assert.ok(route.includes(`RATE_LIMIT = ${limit}`));
  assert.ok(route.includes(key));
  assert.match(route, /rateLimitExceededResponse\(/);
}
assert.match(tokenRoute, /callRoomIdSchema\.parse\(roomId\)/);
assert.match(tokenRoute, /createCallTokenForCurrentUser\(current, parsedRoomId\)/);

const endBody = exportedFunction(callService, "endCallRoomForCurrentUser");
assert.match(endBody, /profileId: current\.profileId/);
assert.match(endBody, /endCallRoom\(/);
assert.match(endBody, /deleteLiveKitRoom\(room\.roomName\)/);
const sharedEndBody = asyncFunction(callService, "endCallRoom");
assert.match(sharedEndBody, /status: "ended", endedAt/);
assert.match(sharedEndBody, /leftAt: endedAt/);
assert.match(sharedEndBody, /eventType: event\.eventType/);

const webhookBody = exportedFunction(callService, "handleLiveKitWebhookEvent");
assert.match(webhookRoute, /const auth = request\.headers\.get\("authorization"\)/);
assert.match(webhookRoute, /receiveLiveKitWebhook\(body, auth\)/);
assert.match(webhookBody, /event\.event === "participant_left"/);
assert.match(webhookBody, /profileId = event\.participant\?\.identity/);
assert.match(webhookBody, /profileId, leftAt: null/);
assert.match(webhookBody, /data: joined \? \{ joinedAt: new Date\(\) \} : \{ leftAt: new Date\(\) \}/);

const maintenanceBody = exportedFunction(callService, "runCallMaintenance");
assert.match(maintenanceBody, /CALL_ROOM_JOIN_TTL_MS/);
assert.match(maintenanceBody, /eventType: "room_expired"/);
assert.match(maintenanceBody, /status: "pending", expiresAt: \{ lt: now \}/);
assert.match(maintenanceBody, /data: \{ status: "missed" \}/);
assert.match(maintenanceBody, /deleteLiveKitRoom\(room\.roomName\)/);

assert.match(callService, /toProfileId: current\.profileId/);
assert.match(callService, /take: 3/);
assert.match(packageJson, /"check:calls": "tsx scripts\/check-call-token-permissions\.ts"/);
assert.match(workflow, /npm run check:calls/);

for (const requirementId of VERIFIED_VOICE_VIDEO_CONTROL_IDS) {
  const evidence = VOICE_VIDEO_CONTROL_MASTER_EVIDENCE[requirementId];
  assert.deepEqual(SECURITY_MASTER_EVIDENCE[requirementId], evidence);
  for (const evidencePath of evidence.evidence) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const [requirementId, gap] of Object.entries(
  OPEN_VOICE_VIDEO_CONTROL_GAPS,
)) {
  assert.ok(gap.length > 100, `${requirementId}: gap must remain explicit`);
  assert.equal(VOICE_VIDEO_CONTROL_MASTER_EVIDENCE[requirementId], undefined);
  assert.equal(SECURITY_MASTER_EVIDENCE[requirementId], undefined);
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.equal(isMasterRequirementComplete(requirement), false);
}

console.log(
  "Voice/video controls passed: 10 LiveKit credential, membership, abuse, lifecycle and teardown gates verified; one-time replay prevention remains open",
);
}

function source(file: string) {
  return readFileSync(file, "utf8");
}

function exportedFunction(fileSource: string, name: string) {
  return functionSlice(fileSource, `export async function ${name}`);
}

function asyncFunction(fileSource: string, name: string) {
  return functionSlice(fileSource, `\nasync function ${name}(`);
}

function functionSlice(fileSource: string, marker: string) {
  const start = fileSource.indexOf(marker);
  assert.ok(start >= 0, `${marker}: source function missing`);
  const rest = fileSource.slice(start + marker.length);
  const next = rest.search(/\n(?:export )?async function /);
  return next >= 0 ? rest.slice(0, next) : rest;
}
