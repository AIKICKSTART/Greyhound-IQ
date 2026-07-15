import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_TEAM_INVITATION_STATE_EVIDENCE_FILE,
  PRODUCT_TEAM_INVITATION_STATE_EXPECTED_GAIN,
  PRODUCT_TEAM_INVITATION_STATE_MASTER_EVIDENCE,
  PRODUCT_TEAM_INVITATION_STATE_REQUIREMENT_IDS,
  PRODUCT_TEAM_INVITATION_STATE_SCOPE,
  PRODUCT_TEAM_INVITATION_STATE_TEST_FILE,
} from "./product-team-invitation-state-evidence";

// screen-evidence-test-id: PRODUCT-TEAM-INVITATION-STATE

const EXPECTED_REQUIREMENTS = {
  "SYSTEM.invitation-expired": "Provide an expired-invitation experience.",
  "SYSTEM.invitation-invalid": "Provide an invalid-invitation experience.",
} as const;

assert.deepEqual(
  PRODUCT_TEAM_INVITATION_STATE_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_TEAM_INVITATION_STATE_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_TEAM_INVITATION_STATE_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [requirementId, requirementText] of Object.entries(
  EXPECTED_REQUIREMENTS,
)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement, requirementId);
  assert.equal(requirement.requirement, requirementText);
  const record =
    PRODUCT_TEAM_INVITATION_STATE_MASTER_EVIDENCE[
      requirementId as keyof typeof PRODUCT_TEAM_INVITATION_STATE_MASTER_EVIDENCE
    ];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_TEAM_INVITATION_STATE_EVIDENCE_FILE,
    PRODUCT_TEAM_INVITATION_STATE_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  record.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

const evidenceSource = source(PRODUCT_TEAM_INVITATION_STATE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_TEAM_INVITATION_STATE_SCOPE, /invalid token shapes/i);
assert.match(PRODUCT_TEAM_INVITATION_STATE_SCOPE, /past expiresAt are classified as expired/i);
assert.match(PRODUCT_TEAM_INVITATION_STATE_SCOPE, /does not prove browser hydration/i);
assert.match(PRODUCT_TEAM_INVITATION_STATE_SCOPE, /deployed database behavior/i);

const pageSource = source("src/app/account/team/page.tsx");
assertInOrder(pageSource, [
  "const invitationRequested = rawInvitation !== null;",
  "isTeamInvitationToken(rawInvitation)",
  "getOrganizationTeamInvitation(current, invitationToken)",
  "<TeamInvitationReview",
]);
assert.match(
  pageSource,
  /"error-invitation-state"[\s\S]*That invitation is unavailable, expired, or has already been used\./,
);

const reviewSource = source(
  "src/app/account/team/team-invitation-review.tsx",
);
assertInOrder(reviewSource, [
  "if (!invitation)",
  'role="alert"',
  "Invitation unavailable",
  "The link is invalid, belongs to another account email, or could",
  "No team access was changed.",
]);
assertInOrder(reviewSource, [
  'invitation.status === "pending"',
  "Accept invitation",
  "Decline invitation",
  "This invitation is {formatLabel(invitation.status)} and cannot be used",
  "again.",
]);
assert.match(reviewSource, /DATE_FORMATTER\.format\(invitation\.expiresAt\)/);

const serviceSource = source("src/lib/organization-team-service.ts");
assertInOrder(serviceSource, [
  "function assertTeamInvitationToken(value: string)",
  "if (!isTeamInvitationToken(value))",
  'throw new Error("team.invitation_not_found")',
]);
assertInOrder(serviceSource, [
  "if (!invitation || invitation.emailHash !== emailHash)",
  'throw new Error("team.invitation_not_found")',
]);
assertInOrder(serviceSource, [
  "function invitationStatus(status: string, expiresAt: Date)",
  'if (status === "accepted" || status === "rejected") return status;',
  'if (status !== "pending" || expiresAt.getTime() <= Date.now())',
  'return "expired";',
  'return "pending";',
]);

const decisionSource = functionSource(
  serviceSource,
  "decideOrganizationTeamInvitation",
);
assertInOrder(decisionSource, [
  "if (!invitation || invitation.emailHash !== emailHash)",
  'throw new Error("team.invitation_not_found")',
  "if (invitation.expiresAt.getTime() <= Date.now())",
  'throw new Error("team.invitation_expired")',
  'if (invitation.status !== "pending")',
  'throw new Error("team.invitation_not_pending")',
  'if (decision === "accept")',
  "await tx.membership.upsert",
]);

const actionsSource = source("src/app/account/team/actions.ts");
const outcomeSource = functionSource(actionsSource, "teamActionErrorOutcome");
for (const errorCode of [
  "team.invitation_expired",
  "team.invitation_not_pending",
  "team.invitation_not_found",
]) {
  assert.match(outcomeSource, new RegExp(errorCode.replace(".", "\\.")));
}
assert.match(outcomeSource, /return "error-invitation-state"/);

console.log(
  "Team invitation state evidence passed: invalid and expired invitation experiences have source and focused-contract proof with explicit runtime limitations.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string) {
  const start = value.indexOf(`function ${name}`);
  assert.ok(start >= 0, `Missing function ${name}`);
  const nextExport = value.indexOf("\nexport ", start);
  const nextFunction = value.indexOf("\nfunction ", start + 1);
  const ends = [nextExport, nextFunction].filter((index) => index > start);
  const end = ends.length > 0 ? Math.min(...ends) : value.length;
  return value.slice(start, end);
}

function assertInOrder(value: string, expected: readonly string[]) {
  let cursor = -1;
  for (const token of expected) {
    const next = value.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `Expected ordered token: ${token}`);
    cursor = next;
  }
}
