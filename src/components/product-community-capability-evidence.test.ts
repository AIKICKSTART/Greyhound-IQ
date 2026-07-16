import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_SCOPE,
  PRODUCT_COMMUNITY_CAPABILITY_EXPECTED_GAIN,
  PRODUCT_COMMUNITY_CAPABILITY_FOCUSED_CONTRACT_FILES,
  PRODUCT_COMMUNITY_CAPABILITY_MASTER_EVIDENCE,
  PRODUCT_COMMUNITY_CAPABILITY_OPEN_GAPS,
  PRODUCT_COMMUNITY_CAPABILITY_OPEN_REQUIREMENT_IDS,
  PRODUCT_COMMUNITY_CAPABILITY_REQUIREMENT_IDS,
  PRODUCT_COMMUNITY_CAPABILITY_TEST_FILE,
} from "./product-community-capability-evidence";

// screen-evidence-test-id: PRODUCT-COMMUNITY-CAPABILITY-EVIDENCE

const EXPECTED_CLOSED_IDS = [
  "ROUTE.COMMUNITY.call-accept",
  "ROUTE.COMMUNITY.call-decline",
  "ROUTE.COMMUNITY.call-end",
  "ROUTE.COMMUNITY.mute",
  "ROUTE.COMMUNITY.unmute",
  "ROUTE.COMMUNITY.camera-enable",
  "ROUTE.COMMUNITY.camera-disable",
  "ROUTE.COMMUNITY.device-switch",
  "ROUTE.COMMUNITY.permission-unavailable",
  "ROUTE.COMMUNITY.missed-call",
  "ROUTE.COMMUNITY.participant-block",
  "ROUTE.COMMUNITY.participant-report",
  "ROUTE.COMMUNITY.immediate-feedback",
  "ROUTE.COMMUNITY.call-state",
  "ROUTE.COMMUNITY.delivery-truth",
  "ROUTE.COMMUNITY.fixture-privacy",
] as const;

const EXPECTED_OPEN_IDS = [
  "ROUTE.COMMUNITY.private-profile",
  "ROUTE.COMMUNITY.hide",
  "ROUTE.COMMUNITY.group-join",
  "ROUTE.COMMUNITY.group-leave",
  "ROUTE.COMMUNITY.group-request",
  "ROUTE.COMMUNITY.group-approve",
  "ROUTE.COMMUNITY.thread-moderate",
  "ROUTE.COMMUNITY.message-edit",
  "ROUTE.COMMUNITY.privacy-boundaries",
  "ROUTE.COMMUNITY.relationship-consistency",
] as const;

const EXPECTED_FOCUSED_CONTRACTS = [
  "src/lib/call-client-actions.test.ts",
  "src/lib/call-client-errors.test.ts",
  "src/app/api/conversations/[id]/delivered/route.test.ts",
  "src/lib/demo-profile-fixture-contract.test.ts",
  "src/components/screen-contracts/production-screen-community-interactions.test.ts",
  "src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts",
] as const;

const DEFERRED_AGGREGATE_TESTS = new Set([
  "src/components/screen-contracts/community-user-stories.test.ts",
  "src/components/product-route-master-evidence.test.ts",
  "src/components/product-source-audit-evidence.test.ts",
]);

assert.deepEqual(
  PRODUCT_COMMUNITY_CAPABILITY_REQUIREMENT_IDS,
  EXPECTED_CLOSED_IDS,
);
assert.deepEqual(
  PRODUCT_COMMUNITY_CAPABILITY_OPEN_REQUIREMENT_IDS,
  EXPECTED_OPEN_IDS,
);
assert.deepEqual(
  PRODUCT_COMMUNITY_CAPABILITY_FOCUSED_CONTRACT_FILES,
  EXPECTED_FOCUSED_CONTRACTS,
);
assert.equal(PRODUCT_COMMUNITY_CAPABILITY_EXPECTED_GAIN, 16);
assert.equal(EXPECTED_OPEN_IDS.length, 10);

const reviewedIds = [...EXPECTED_CLOSED_IDS, ...EXPECTED_OPEN_IDS];
assert.equal(reviewedIds.length, 26);
assert.equal(new Set(reviewedIds).size, 26);

const allCommunityRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.id.startsWith("ROUTE.COMMUNITY."),
);
assert.equal(allCommunityRequirements.length, 90);
const allCommunityIds = new Set(
  allCommunityRequirements.map((requirement) => requirement.id),
);
for (const requirementId of reviewedIds) {
  assert.equal(
    allCommunityIds.has(requirementId),
    true,
    `${requirementId}: reviewed requirement is absent from the immutable prompt extraction`,
  );
}

assert.deepEqual(
  Object.keys(PRODUCT_COMMUNITY_CAPABILITY_MASTER_EVIDENCE),
  EXPECTED_CLOSED_IDS,
);
assert.deepEqual(
  Object.keys(PRODUCT_COMMUNITY_CAPABILITY_OPEN_GAPS),
  EXPECTED_OPEN_IDS,
);

const allowedTestEvidence = new Set<string>([
  PRODUCT_COMMUNITY_CAPABILITY_TEST_FILE,
  ...EXPECTED_FOCUSED_CONTRACTS,
]);
for (const [requirementId, record] of Object.entries(
  PRODUCT_COMMUNITY_CAPABILITY_MASTER_EVIDENCE,
)) {
  assert.equal(record.status, "tested", `${requirementId}: unexpected status`);
  assert.equal(record.evidence[0], PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_FILE);
  assert.equal(record.evidence[1], PRODUCT_COMMUNITY_CAPABILITY_TEST_FILE);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  for (const evidencePath of record.evidence) {
    assert.equal(
      existsSync(evidencePath),
      true,
      `${requirementId}: missing evidence path ${evidencePath}`,
    );
    assert.equal(
      DEFERRED_AGGREGATE_TESTS.has(evidencePath),
      false,
      `${requirementId}: stale aggregate evidence cannot be cited`,
    );
    if (evidencePath.endsWith(".test.ts")) {
      assert.equal(
        allowedTestEvidence.has(evidencePath),
        true,
        `${requirementId}: unreviewed test evidence ${evidencePath}`,
      );
    }
  }
}

for (const requirementId of EXPECTED_OPEN_IDS) {
  assert.equal(
    requirementId in PRODUCT_COMMUNITY_CAPABILITY_MASTER_EVIDENCE,
    false,
    `${requirementId}: residual requirement must stay open`,
  );
  assert.ok(
    PRODUCT_COMMUNITY_CAPABILITY_OPEN_GAPS[requirementId].length >= 150,
    `${requirementId}: residual gap must remain specific and actionable`,
  );
}

assert.match(PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_SCOPE, /source-static/i);
assert.match(
  PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_SCOPE,
  /does not prove browser behavior/,
);
assert.match(
  PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_SCOPE,
  /terminal connection-drop recovery is verified separately/,
);

const evidenceModuleSource = source(PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_FILE);
for (const serverOnlySignal of [
  'from "node:',
  "from 'node:",
  "readFileSync",
  "process.cwd",
]) {
  assert.equal(
    evidenceModuleSource.includes(serverOnlySignal),
    false,
    `client-safe evidence module contains ${serverOnlySignal}`,
  );
}
for (const staleReference of DEFERRED_AGGREGATE_TESTS) {
  assert.equal(
    evidenceModuleSource.includes(staleReference),
    false,
    `evidence module cites deferred aggregate ${staleReference}`,
  );
}

const callPanel = source("src/components/conversation-call-panel.tsx");
assertIncludes("src/components/conversation-call-panel.tsx", callPanel, [
  'await respondToClientCallInvite(invite.roomId, "accept")',
  'await respondToClientCallInvite(invite.roomId, "decline")',
  'aria-label={`Accept ${incomingInvite.callType} call from ${incomingInvite.fromName}`}',
  'aria-label={`Decline ${incomingInvite.callType} call from ${incomingInvite.fromName}`}',
  'await room.localParticipant.setMicrophoneEnabled(next)',
  'aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}',
  'await room.localParticipant.setCameraEnabled(next)',
  'aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}',
  'Room.getLocalDevices("audioinput", false)',
  'Room.getLocalDevices("videoinput", false)',
  'Room.getLocalDevices("audiooutput", false)',
  'media?.addEventListener?.("devicechange", onDeviceChange)',
  "await room.switchActiveDevice(kind, deviceId)",
  'aria-label="Call device settings"',
  "Missed {incomingInvite.callType} call",
  "Reconnecting...",
  "Try again",
]);

const callActions = source("src/lib/call-client-actions.ts");
assertIncludes("src/lib/call-client-actions.ts", callActions, [
  'action: "accept" | "decline"',
  'fetch(`/api/calls/${roomId}/invite`',
  'method: "POST"',
  'body: JSON.stringify({ action })',
  'throw new Error(',
]);

const inviteRoute = source("src/app/api/calls/[roomId]/invite/route.ts");
assertIncludes("src/app/api/calls/[roomId]/invite/route.ts", inviteRoute, [
  "requireCurrentUserProfile()",
  "callRoomIdSchema.parse(roomId)",
  "checkRateLimit(",
  "callInviteActionSchema.parse(await readBoundedJsonRequest(request))",
  "respondToCallInviteForCurrentUser(",
]);

const endRoute = source("src/app/api/calls/[roomId]/end/route.ts");
assertIncludes("src/app/api/calls/[roomId]/end/route.ts", endRoute, [
  "requireCurrentUserProfile()",
  "callRoomIdSchema.parse(roomId)",
  "checkRateLimit(",
  "endCallRoomForCurrentUser(current, parsedRoomId)",
]);

const callService = source("src/lib/call-service.ts");
assertIncludes("src/lib/call-service.ts", callService, [
  "export async function endCallRoomForCurrentUser(",
  "permissions: {",
  "profileId: current.profileId",
  "canJoin: true",
  'action: "call.room.end"',
  "await deleteLiveKitRoom(room.roomName)",
  "export async function respondToCallInviteForCurrentUser(",
  'action: "accept" | "decline"',
  'status: "pending"',
  "expiresAt: { gt: new Date() }",
  'eventType: action === "accept" ? "invite_accepted" : "invite_declined"',
  'action: action === "accept" ? "call.invite.accept" : "call.invite.decline"',
  "export async function runCallMaintenance()",
  'data: { status: "missed" }',
  'eventType: "invite_missed"',
  'type: "call_missed"',
  "take: CALL_MAINTENANCE_LIMIT",
]);

const maintenanceRoute = source(
  "src/app/api/internal/call-maintenance/route.ts",
);
assertIncludes(
  "src/app/api/internal/call-maintenance/route.ts",
  maintenanceRoute,
  ["requireInternalRequest(request)", "runCallMaintenance()"],
);
const scheduler = source("scripts/gcp-scheduler-sync.sh");
assert.match(
  scheduler,
  /call-maintenance[\s\S]*\/api\/internal\/call-maintenance[\s\S]*"\*\/5 \* \* \* \*"/,
);

const callStatusDeclaration = between(
  callPanel,
  "type CallStatus =",
  "type MediaErrors =",
);
for (const state of [
  '"idle"',
  '"starting"',
  '"connecting"',
  '"connected"',
  '"reconnecting"',
  '"error"',
]) {
  assert.ok(callStatusDeclaration.includes(state), `CallStatus is missing ${state}`);
}
const disconnectHandler = between(
  callPanel,
  "nextRoom.on(RoomEvent.Disconnected",
  "nextRoom.on(RoomEvent.Reconnecting",
);
assert.match(disconnectHandler, /resetCallState\(\)/);
assert.match(disconnectHandler, /setStatus\("error"\)/);
assert.match(disconnectHandler, /call connection dropped/);

const leaveHandler = between(
  callPanel,
  "async function leave()",
  "function deviceSelectValue",
);
assert.match(leaveHandler, /activeConnection\?\.disconnect\(\)/);
assert.match(leaveHandler, /await endRoom\(target\.id\)/);
assert.match(leaveHandler, /catch|setError/);
const endRoomHelper = between(
  callPanel,
  "async function endRoom",
  "function bindRemoteTracks",
);
assert.match(endRoomHelper, /fetch\(`\/api\/calls\/\$\{roomId\}\/end`/);
assert.match(endRoomHelper, /response\.ok|throw new Error/);

const mediaErrors = source("src/lib/call-client-errors.ts");
assertIncludes("src/lib/call-client-errors.ts", mediaErrors, [
  "MediaDeviceFailure.getFailure(err)",
  "case MediaDeviceFailure.PermissionDenied:",
  "case MediaDeviceFailure.NotFound:",
  "case MediaDeviceFailure.DeviceInUse:",
  "`Allow ${kind} access in your browser settings and try again`",
  "`No ${kind} detected`",
  "`Your ${kind} is in use by another app`",
]);

const messagePage = source("src/app/messages/[id]/page.tsx");
assertIncludes("src/app/messages/[id]/page.tsx", messagePage, [
  "const blockAction = blockConversation.bind(null, conversation.id)",
  "const unblockAction = unblockConversation.bind(null, conversation.id)",
  "<form action={blockAction}>",
  "<form action={unblockAction}>",
  "const reportAction = reportConversationMessage.bind(",
  "!isMine && (",
  "<form action={reportAction}",
  'entry.eventType === "invite_missed"',
  "`Missed ${callType} call`",
  "const deliveryReceipt = message.deliveryReceipts.find(",
  "isMine && deliveryReceipt",
  "`Delivered ${deliveryReceipt.deliveredAt.toLocaleString(",
  '? "Sent"',
]);

const actions = source("src/app/actions.ts");
assertIncludes("src/app/actions.ts", actions, [
  "export async function blockConversation(",
  "await setConversationBlock(current, conversationId, true)",
  "export async function unblockConversation(",
  "await setConversationBlock(current, conversationId, false)",
  "export async function reportConversationMessage(",
  "requireCurrentUserProfile()",
  "conversationId,",
  "{ senderId: current.profileId }",
  "{ recipientId: current.profileId }",
  'throw new Error("message.cannot_report_own")',
  'targetType: "message"',
  "await createReportForUser(current, parsed)",
]);

const conversationService = source("src/lib/conversation-service.ts");
assertIncludes("src/lib/conversation-service.ts", conversationService, [
  "export async function setConversationBlock(",
  "await getConversationForProfile(",
  "conversation.blockedById !== current.profileId",
  "blockerProfileId: current.profileId",
  "blockedProfileId,",
  "export async function markConversationDelivered(",
  "recipientId: current.profileId",
  "deliveryReceipts: { none: { profileId: current.profileId } }",
  "tx.messageDeliveryReceipt.createMany({",
  "skipDuplicates: true",
]);

const reportService = source("src/lib/report-service.ts");
assertIncludes("src/lib/report-service.ts", reportService, [
  "const message = await tx.message.findFirst({",
  "recipientId: current.profileId",
  "deletedByRecipientAt: null",
  "return message.sender.userId",
]);

const feedControls = source("src/components/instant-feed-controls.tsx");
assertIncludes("src/components/instant-feed-controls.tsx", feedControls, [
  "setSubmitting(true)",
  "Posting...",
  'setError(err instanceof Error ? err.message : "Could not post to feed")',
  'setError(err instanceof Error ? err.message : "Could not comment")',
  "setReactionType(nextReaction)",
  "setReactionType(previous.reactionType)",
  "setCount(previous.count)",
  'aria-live="polite"',
  "setSaved(!previous)",
  "setSaved(previous)",
  '{saved ? "Saved" : "Save"}',
  "setShared(true)",
  '{shared ? "Shared" : "Share"}',
]);

const messageComposer = source("src/components/instant-message-composer.tsx");
assertIncludes("src/components/instant-message-composer.tsx", messageComposer, [
  "setPendingBody(body)",
  "Sending...",
  "setPendingBody(null)",
  'setError(err instanceof Error ? err.message : "Could not send message")',
  'role="status"',
]);

const deliveryRoute = source(
  "src/app/api/conversations/[id]/delivered/route.ts",
);
assertIncludes(
  "src/app/api/conversations/[id]/delivered/route.ts",
  deliveryRoute,
  [
    "export async function POST(",
    "requireCurrentUserProfile()",
    "checkRateLimit(",
    "{ failClosed: true }",
    "markConversationDelivered(current, id)",
  ],
);
assert.equal(deliveryRoute.includes("export async function GET("), false);

const deliveryAcknowledger = source(
  "src/components/conversation-delivery-acknowledger.tsx",
);
assertIncludes(
  "src/components/conversation-delivery-acknowledger.tsx",
  deliveryAcknowledger,
  [
    'method: "POST"',
    'credentials: "same-origin"',
    "if (sent.current) return",
  ],
);

const fixtureContract = source("scripts/demo-route-fixture-contract.ts");
assertIncludes("scripts/demo-route-fixture-contract.ts", fixtureContract, [
  "synthetic: true",
  "realPersonSource: false",
  "approvedForPrivateFixtures: true",
  'email: "admin@greyhoundiq.test"',
  "Daniel Fleuren|daniel-fleuren-founder-portrait",
  'account.email.endsWith(".test")',
]);
const fixtureSeed = source("scripts/seed-demo-route-fixtures.ts");
assertIncludes("scripts/seed-demo-route-fixtures.ts", fixtureSeed, [
  "export function assertDemoTarget(",
  "demo_fixtures.blocked_production_host",
  "remote database project ref mismatch",
  "demo_fixtures.provider_samples_missing: load approved provider data before private fixtures",
]);

console.log(
  "Community capability evidence passed: 16 source-static closures, 10 exact open gaps, focused current contracts only, call-end and dropped-call recovery refinements verified",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function assertIncludes(path: string, contents: string, signals: readonly string[]) {
  for (const signal of signals) {
    assert.equal(
      contents.includes(signal),
      true,
      `${path}: missing deterministic source signal ${signal}`,
    );
  }
}

function between(contents: string, start: string, end: string) {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source section start: ${start}`);
  assert.notEqual(endIndex, -1, `missing source section end: ${end}`);
  return contents.slice(startIndex, endIndex);
}
