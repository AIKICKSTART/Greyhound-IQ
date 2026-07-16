import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_FILE =
  "src/components/product-community-capability-evidence.ts" as const;
export const PRODUCT_COMMUNITY_CAPABILITY_TEST_FILE =
  "src/components/product-community-capability-evidence.test.ts" as const;

export const PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_SCOPE =
  "Deterministic source-static verification of sixteen implemented community call, participant-safety, immediate-feedback, delivery-truth, and synthetic-fixture capabilities. This evidence verifies reviewed source bindings and focused contracts only; it does not prove browser behavior, a production database result, LiveKit availability, scheduled-job execution, current route-audit parity, or current aggregate source-audit parity. Call termination now checks the endpoint result and surfaces failure, while terminal connection-drop recovery is verified separately by the focused dropped-call evidence module.";

export const PRODUCT_COMMUNITY_CAPABILITY_REQUIREMENT_IDS = [
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

export type ProductCommunityCapabilityRequirementId =
  (typeof PRODUCT_COMMUNITY_CAPABILITY_REQUIREMENT_IDS)[number];

export const PRODUCT_COMMUNITY_CAPABILITY_OPEN_REQUIREMENT_IDS = [
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

export type ProductCommunityCapabilityOpenRequirementId =
  (typeof PRODUCT_COMMUNITY_CAPABILITY_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_COMMUNITY_CAPABILITY_OPEN_GAPS = {
  "ROUTE.COMMUNITY.private-profile":
    "Profile visibility, forced row-level security, and not-found handling exist, but the repository lacks a current database-backed cross-role access matrix proving signed-out, member, non-friend, friend, owner, and blocked-user behavior without object-level authorization leakage.",
  "ROUTE.COMMUNITY.hide":
    "Actor mute and moderation-level post hiding exist, but there is no member-facing per-post hide mutation and control. Muting an author is broader than hiding one post and cannot truthfully satisfy this requirement.",
  "ROUTE.COMMUNITY.group-join":
    "The current forum and community schema has no production group-membership model, join mutation, authorization boundary, or bound join control, so this capability requires product and data implementation rather than evidence.",
  "ROUTE.COMMUNITY.group-leave":
    "The current forum and community schema has no production group-membership model, leave mutation, ownership rule, or bound leave control, so membership removal and its cross-surface state cannot yet be exercised.",
  "ROUTE.COMMUNITY.group-request":
    "There is no production pending group-membership request state, request mutation, duplicate-request handling, notification path, or bound request-access control in the current group surfaces.",
  "ROUTE.COMMUNITY.group-approve":
    "There is no production group role or membership approval model, authorized approval mutation, audit event, or approver UI, so the required privileged workflow and deny-by-default boundary are absent.",
  "ROUTE.COMMUNITY.thread-moderate":
    "Thread records expose pinned and locked fields and locked threads reject replies, but no authorized moderation mutation, role check, audit path, or production moderation control can change those states.",
  "ROUTE.COMMUNITY.message-edit":
    "Conversation messages have create, reaction, report, receipt, and soft-delete paths, but no message update service, edit route or action, edited timestamp, ownership check, or bound editing control exists.",
  "ROUTE.COMMUNITY.privacy-boundaries":
    "Participant-scoped conversation reads, block controls, forced profile RLS, and not-found handling exist, but a current end-to-end cross-role BOLA and RLS matrix has not proved all signed-out, blocked, private, and missing-thread non-leak outcomes.",
  "ROUTE.COMMUNITY.relationship-consistency":
    "Friendship mutations broadcast and revalidate their current surfaces, but group membership is not implemented and friend cancellation or removal has no bound UI; cross-surface relationship consistency is therefore incomplete.",
} as const satisfies Readonly<
  Record<ProductCommunityCapabilityOpenRequirementId, string>
>;

export const PRODUCT_COMMUNITY_CAPABILITY_FOCUSED_CONTRACT_FILES = [
  "src/lib/call-client-actions.test.ts",
  "src/lib/call-client-errors.test.ts",
  "src/app/api/conversations/[id]/delivered/route.test.ts",
  "src/lib/demo-profile-fixture-contract.test.ts",
  "src/components/screen-contracts/production-screen-community-interactions.test.ts",
  "src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts",
] as const;

export const PRODUCT_COMMUNITY_CAPABILITY_EXPECTED_GAIN =
  PRODUCT_COMMUNITY_CAPABILITY_REQUIREMENT_IDS.length;

export type ProductCommunityCapabilityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_COMMUNITY_CAPABILITY_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_CAPABILITY_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductCommunityCapabilityEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

const CALL_PANEL_EVIDENCE = [
  "src/components/conversation-call-panel.tsx",
  "src/lib/call-client-actions.ts",
] as const;

const CALL_SERVER_EVIDENCE = [
  "src/lib/call-validation.ts",
  "src/lib/call-service.ts",
] as const;

const MESSAGE_SAFETY_EVIDENCE = [
  "src/app/messages/[id]/page.tsx",
  "src/app/actions.ts",
  "src/lib/conversation-service.ts",
  "src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts",
] as const;

export const PRODUCT_COMMUNITY_CAPABILITY_MASTER_EVIDENCE = {
  "ROUTE.COMMUNITY.call-accept": tested(
    ...CALL_PANEL_EVIDENCE,
    ...CALL_SERVER_EVIDENCE,
    "src/app/api/calls/[roomId]/invite/route.ts",
    "src/lib/call-client-actions.test.ts",
  ),
  "ROUTE.COMMUNITY.call-decline": tested(
    ...CALL_PANEL_EVIDENCE,
    ...CALL_SERVER_EVIDENCE,
    "src/app/api/calls/[roomId]/invite/route.ts",
    "src/lib/call-client-actions.test.ts",
  ),
  "ROUTE.COMMUNITY.call-end": tested(
    ...CALL_PANEL_EVIDENCE,
    ...CALL_SERVER_EVIDENCE,
    "src/app/api/calls/[roomId]/end/route.ts",
  ),
  "ROUTE.COMMUNITY.mute": tested(...CALL_PANEL_EVIDENCE),
  "ROUTE.COMMUNITY.unmute": tested(...CALL_PANEL_EVIDENCE),
  "ROUTE.COMMUNITY.camera-enable": tested(...CALL_PANEL_EVIDENCE),
  "ROUTE.COMMUNITY.camera-disable": tested(...CALL_PANEL_EVIDENCE),
  "ROUTE.COMMUNITY.device-switch": tested(...CALL_PANEL_EVIDENCE),
  "ROUTE.COMMUNITY.permission-unavailable": tested(
    "src/components/conversation-call-panel.tsx",
    "src/lib/call-client-errors.ts",
    "src/lib/call-client-errors.test.ts",
  ),
  "ROUTE.COMMUNITY.missed-call": tested(
    "src/components/conversation-call-panel.tsx",
    "src/app/messages/[id]/page.tsx",
    "src/lib/call-service.ts",
    "src/app/api/internal/call-maintenance/route.ts",
    "scripts/gcp-scheduler-sync.sh",
  ),
  "ROUTE.COMMUNITY.participant-block": tested(...MESSAGE_SAFETY_EVIDENCE),
  "ROUTE.COMMUNITY.participant-report": tested(
    ...MESSAGE_SAFETY_EVIDENCE,
    "src/lib/report-service.ts",
  ),
  "ROUTE.COMMUNITY.immediate-feedback": tested(
    "src/components/instant-feed-controls.tsx",
    "src/components/instant-message-composer.tsx",
    "src/components/screen-contracts/production-screen-community-interactions.test.ts",
    "src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts",
  ),
  "ROUTE.COMMUNITY.call-state": tested(
    "src/components/conversation-call-panel.tsx",
    "src/lib/call-client-errors.ts",
    "src/lib/call-client-errors.test.ts",
  ),
  "ROUTE.COMMUNITY.delivery-truth": tested(
    "src/app/messages/[id]/page.tsx",
    "src/components/conversation-delivery-acknowledger.tsx",
    "src/app/api/conversations/[id]/delivered/route.ts",
    "src/lib/conversation-service.ts",
    "src/app/api/conversations/[id]/delivered/route.test.ts",
  ),
  "ROUTE.COMMUNITY.fixture-privacy": tested(
    "scripts/demo-route-fixture-contract.ts",
    "scripts/seed-demo-route-fixtures.ts",
    "src/lib/demo-access.ts",
    "src/lib/demo-profile-media.ts",
    "src/lib/demo-profile-fixture-contract.test.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductCommunityCapabilityRequirementId,
    ProductCommunityCapabilityEvidenceRecord
  >
>;
