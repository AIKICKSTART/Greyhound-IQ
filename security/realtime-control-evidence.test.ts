import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  REALTIME_CONTROL_MASTER_EVIDENCE,
  VERIFIED_REALTIME_CONTROL_IDS,
} from "./realtime-control-evidence";

const tokenRoute = read("src/app/api/realtime/token/route.ts");
const client = read("src/components/realtime-refresh.tsx");
const apiErrors = read("src/lib/api-errors.ts");
const conversation = read("src/lib/conversation-service.ts");
const validation = read("src/lib/conversation-validation.ts");
const moderation = read("src/lib/moderation-service.ts");
const reports = read("src/lib/report-service.ts");
const realtime = read("src/lib/realtime-service.ts");
const realtimeTest = read("src/lib/realtime-authorization.test.ts");
const policies = read("scripts/sql/supabase-private-realtime-policies.sql");

// Authenticated, short-lived, exact-topic authorization with proactive refresh.
assert.match(tokenRoute, /requireCurrentUserProfile\(\)/);
assert.match(tokenRoute, /checkRateLimit\([\s\S]*`realtime:token:/);
assert.match(tokenRoute, /Cache-Control": "private, no-store"/);
assert.match(realtime, /const REALTIME_AUTH_TTL_SECONDS = 5 \* 60/);
assert.match(realtime, /const REALTIME_GRANT_TTL_SECONDS = 10 \* 60/);
assert.match(realtime, /profile_id: current\.profileId,[\s\S]*exp: expiresAt/);
assert.match(realtime, /secret\.length < 32/);
assert.match(client, /client\.realtime\.setAuth\(payload\.token\)/);
assert.match(
  client,
  /browserRealtimeRefreshTimer = setTimeout\([\s\S]*browserRealtimeAuthExpiresAt = 0;[\s\S]*ensureBrowserRealtimeAuthorization\(client\)/,
);
assert.match(client, /browserRealtimeAuthExpiresAt > now \+ 30_000/);

// Membership and block state are resolved by the server, rechecked after the
// cross-database grant write, and revoked for both members when a block wins.
assert.match(
  realtime,
  /blockedById: null,[\s\S]*participantAId: current\.profileId[\s\S]*participantBId: current\.profileId/,
);
assert.match(realtime, /canProfileAccessConversationRealtime/);
assert.match(realtime, /const revalidatedConversations = await listRealtimeConversations/);
assert.match(realtime, /await revokeRealtimeTopicGrants\(\[current\.profileId\], staleTopics, client\)/);
assert.match(conversation, /await revokeConversationRealtimeGrants\(conversation\.id, \[/);
assert.match(realtimeTest, /non-participants must not receive conversation grants/);
assert.match(realtimeTest, /a blocked conversation must not receive a realtime grant/);

// The Realtime engine accepts only exact, unexpired broadcast/presence grants.
assert.match(policies, /g\.profile_id = nullif\(auth\.jwt\(\) ->> 'profile_id', ''\)/);
assert.match(policies, /g\.topic = requested_topic/);
assert.match(policies, /g\.extension = requested_extension/);
assert.match(policies, /g\.expires_at > now\(\)/);
assert.match(policies, /on realtime\.messages as restrictive for select/);
assert.match(policies, /on realtime\.messages as restrictive for insert/);
assert.match(policies, /to authenticated/);

// Attachments remain on the authenticated message API and are bounded before
// persistence; Realtime transports invalidation ids/flags rather than files.
assert.match(validation, /mediaIds: z\.array\([\s\S]*\.max\(4\)/);
assert.match(conversation, /assertMediaAttachable\(current, mediaIds, 4/);
assert.match(conversation, /message\.media_must_be_private/);

// Delivery/read receipts are participant-gated, persisted, and deduplicated.
assert.match(conversation, /export async function markConversationRead[\s\S]*getConversationForProfile/);
assert.match(conversation, /tx\.messageDeliveryReceipt\.createMany\([\s\S]*skipDuplicates: true/);
assert.match(conversation, /tx\.messageReadReceipt\.createMany\([\s\S]*skipDuplicates: true/);
assert.match(conversation, /export async function markConversationDelivered[\s\S]*getConversationForProfile/);

// Presence and typing are scoped to member-only conversation topics. There is
// no global presence grant, and the UI ignores another profile's typing claim.
assert.match(realtimeTest, /authorization must never grant a global member-presence topic/);
assert.match(client, /config: \{ private: isPrivateChannel\(config\.name\) \}/);
assert.match(client, /event: "typing"/);
assert.match(client, /payload\?\.profileId !== typing\.otherProfileId/);
assert.match(client, /now - lastTypingSentAt < TYPING_SEND_THROTTLE_MS/);

// Public errors are generic, broadcast logs exclude payloads, offline delivery
// comes from persisted messages, and moderation executes before persistence.
assert.match(tokenRoute, /jsonError\(err, "Could not authorize realtime"\)/);
assert.match(apiErrors, /if \(status === null\)[\s\S]*message: fallback/);
assert.match(apiErrors, /message: status >= 500 \? fallback : message/);
assert.match(realtime, /"realtime\.broadcast_failed",[\s\S]*\{ channelName, event \},[\s\S]*err/);
assert.doesNotMatch(
  realtime.match(/logExecutionError\([\s\S]*?\);/)?.[0] ?? "",
  /payload/,
);
assert.match(conversation, /const message = await withDbRequestContext[\s\S]*tx\.message\.create/);
assert.match(conversation, /await broadcastConversationRefresh\(conversation, "message_created"/);
assert.match(conversation, /const phraseMatch = await findBannedPhraseMatch\(input\.body, "message"\)/);
assert.match(conversation, /phraseMatch\?\.action === "block"/);
assert.match(moderation, /target: "all" \}, \{ target \}/);
assert.match(reports, /tx\.messageModerationAction\.create/);

assert.equal(VERIFIED_REALTIME_CONTROL_IDS.length, 15);
assert.deepEqual(
  Object.keys(REALTIME_CONTROL_MASTER_EVIDENCE).toSorted(),
  [...VERIFIED_REALTIME_CONTROL_IDS].toSorted(),
);
for (const requirementId of VERIFIED_REALTIME_CONTROL_IDS) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    REALTIME_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const unprovenId of [
  "security.realtime-control.origin-validation",
  "security.realtime-control.message-level-authorization",
  "security.realtime-control.privacy-settings",
  "security.realtime-control.tenant-isolation",
  "security.realtime-control.rate-limits",
  "security.realtime-control.message-size-limits",
  "security.realtime-control.replay-behavior",
  "security.realtime-control.ordering-behavior",
  "security.realtime-control.duplicate-message-behavior",
  "security.realtime-control.reconnection",
] as const) {
  assert.equal(
    REALTIME_CONTROL_MASTER_EVIDENCE[unprovenId],
    undefined,
    `${unprovenId}: provider/runtime or missing-control evidence remains open`,
  );
}

console.log(
  "Realtime controls passed: 15 source-backed auth, membership, expiry, scoped visibility, receipt, offline, and moderation controls",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}
