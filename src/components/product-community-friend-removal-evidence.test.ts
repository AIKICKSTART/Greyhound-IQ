import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_EXPECTED_GAIN,
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_MASTER_EVIDENCE,
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_REQUIREMENT_IDS,
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_SCOPE,
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_TEST_FILE,
} from "./product-community-friend-removal-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-COMMUNITY-FRIEND-REMOVAL

const EXPECTED_REQUIREMENTS = {
  "ROUTE.COMMUNITY.friend-cancel": "Support cancelling a friend request.",
  "ROUTE.COMMUNITY.friend-remove": "Support removing a friend.",
} as const;

assert.deepEqual(
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_COMMUNITY_FRIEND_REMOVAL_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_COMMUNITY_FRIEND_REMOVAL_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [id, requirementText] of Object.entries(EXPECTED_REQUIREMENTS)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, requirementText);
  const evidence =
    PRODUCT_COMMUNITY_FRIEND_REMOVAL_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_COMMUNITY_FRIEND_REMOVAL_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_COMMUNITY_FRIEND_REMOVAL_EVIDENCE_FILE,
    PRODUCT_COMMUNITY_FRIEND_REMOVAL_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

for (const scopeAssertion of [
  /source and unit/i,
  /outgoing pending friendships to cancellation/i,
  /accepted friendships to removal/i,
  /explicit inline confirmation/i,
  /pending, success, and recoverable-failure feedback/i,
  /current profile inside request-scoped database context/i,
  /does not prove browser hydration/i,
  /deployed row-level security/i,
  /relationship consistency across unimplemented group membership/i,
]) {
  assert.match(PRODUCT_COMMUNITY_FRIEND_REMOVAL_SCOPE, scopeAssertion);
}

const controlPath = "src/components/friendship-removal-control.tsx";
const controlSource = source(controlPath);
for (const assertion of [
  'type FriendshipRemovalVariant = "cancel-request" | "remove-friend"',
  "await removeFriendAction(formData)",
  'formData.set("friendshipId", friendshipId)',
  "setPending(true)",
  "setSuccess(",
  "setError(",
  'role="status"',
  'role="alert"',
  "aria-expanded={confirming}",
  "onClick={confirmRemoval}",
  "router.refresh()",
  "This does not block them.",
]) {
  assert.ok(controlSource.includes(assertion), `${controlPath}: ${assertion}`);
}
assert.doesNotMatch(controlSource, /window\.confirm/);

const profilePath = "src/app/p/[handle]/page.tsx";
const profileSource = source(profilePath);
const actionsFunction = functionSource(
  profileSource,
  "PersonalProfileActions",
  ts.ScriptKind.TSX,
);
for (const assertion of [
  'friendship?.status === "accepted"',
  'variant="remove-friend"',
  'friendship?.status === "pending"',
  'friendship.direction === "incoming"',
  'variant="cancel-request"',
  "friendshipId={friendship.friendshipId}",
]) {
  assert.ok(actionsFunction.includes(assertion), `${profilePath}: ${assertion}`);
}

const appActionsPath = "src/app/actions.ts";
const removeAction = functionSource(source(appActionsPath), "removeFriendAction");
for (const assertion of [
  "requireCurrentUserProfile()",
  "checkRateLimit(",
  'friendshipId: z.string().trim().min(1).max(120)',
  "await removeFriend(current, parsed.friendshipId)",
  'revalidatePath("/feed")',
  'revalidatePath("/pulse/friends")',
]) {
  assert.ok(removeAction.includes(assertion), `${appActionsPath}: ${assertion}`);
}

const friendServicePath = "src/lib/friend-service.ts";
const removeService = functionSource(
  source(friendServicePath),
  "removeFriend",
);
for (const assertion of [
  "withDbRequestContext(current",
  "tx.friendship.findFirst",
  "{ profileAId: current.profileId }",
  "{ profileBId: current.profileId }",
  'throw new Error("friend.not_found")',
  "tx.friendship.delete",
  'action: "friend.remove"',
  'broadcastProfileRealtimeEvent(otherProfileId, "friend_updated"',
]) {
  assert.ok(removeService.includes(assertion), `${friendServicePath}: ${assertion}`);
}
assert.doesNotMatch(removeService, /withDbSystemContext/);

const evidenceSource = source(PRODUCT_COMMUNITY_FRIEND_REMOVAL_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Community friend removal evidence passed in isolation: outgoing request cancellation and accepted-friend removal are participant-scoped and now expose confirmation, pending, success and retryable failure UI for exact +2 central wiring.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string, kind = ts.ScriptKind.TS) {
  const sourceFile = ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}
