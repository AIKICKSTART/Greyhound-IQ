import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_ACCOUNT_TEAM_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_TEAM_EXPECTED_GAIN,
  PRODUCT_ACCOUNT_TEAM_MASTER_EVIDENCE,
  PRODUCT_ACCOUNT_TEAM_REQUIREMENT_IDS,
  PRODUCT_ACCOUNT_TEAM_SCOPE,
  PRODUCT_ACCOUNT_TEAM_TEST_FILE,
} from "./product-account-team-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  canChangeTeamMemberRole,
  canInviteTeamRole,
  canLeaveTeam,
  canRemoveTeamMember,
  resolveTeamAuthority,
} from "../lib/organization-team-policy";

// screen-evidence-test-id: PRODUCT-ACCOUNT-TEAM

const EXPECTED_REQUIREMENTS = {
  "ROUTE.ACCOUNT.team-invite": "Discover or create team invitations.",
  "ROUTE.ACCOUNT.invite-accept": "Discover or create invitation acceptance.",
  "ROUTE.ACCOUNT.invite-reject": "Discover or create invitation rejection.",
  "ROUTE.ACCOUNT.team-leave": "Discover or create leaving a team.",
  "ROUTE.ACCOUNT.member-remove": "Discover or create removing a team member.",
  "ROUTE.ACCOUNT.member-role": "Discover or create changing a member role.",
  "ROUTE.ACCOUNT.least-privilege":
    "Enforce least privilege for team role changes.",
  "ROUTE.ACCOUNT.last-owner":
    "Prevent removal of the last required owner or administrator without safe transfer.",
} as const;

assert.deepEqual(
  PRODUCT_ACCOUNT_TEAM_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_ACCOUNT_TEAM_EXPECTED_GAIN, 8);
assert.deepEqual(
  Object.keys(PRODUCT_ACCOUNT_TEAM_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [id, requirementText] of Object.entries(EXPECTED_REQUIREMENTS)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, requirementText);
  const evidence =
    PRODUCT_ACCOUNT_TEAM_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_ACCOUNT_TEAM_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_ACCOUNT_TEAM_EVIDENCE_FILE,
    PRODUCT_ACCOUNT_TEAM_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

for (const assertion of [
  /source and unit verification/i,
  /72-hour one-time invitation/i,
  /SHA-256 email and token hashes/i,
  /locked, single-use transaction/i,
  /atomically transfer ownerId/i,
  /database-rate-limited with fail-closed behavior/i,
  /audited inside the mutation transaction/i,
  /does not prove browser hydration/i,
  /invitation email delivery/i,
  /deployed database RLS/i,
  /production database concurrency/i,
]) {
  assert.match(PRODUCT_ACCOUNT_TEAM_SCOPE, assertion);
}

assert.equal(
  resolveTeamAuthority({
    actorUserId: "owner",
    organizationOwnerId: "owner",
    membership: null,
  }),
  "owner",
);
assert.equal(
  resolveTeamAuthority({
    actorUserId: "stale-owner",
    organizationOwnerId: "owner",
    membership: { role: "owner", status: "active" },
  }),
  "member",
);
assert.equal(canInviteTeamRole("owner", "admin"), true);
assert.equal(canInviteTeamRole("admin", "member"), true);
assert.equal(canInviteTeamRole("admin", "admin"), false);
assert.equal(
  canRemoveTeamMember({
    authority: "owner",
    targetAuthority: "owner",
    isSelf: false,
  }),
  false,
);
assert.equal(
  canRemoveTeamMember({
    authority: "admin",
    targetAuthority: "member",
    isSelf: false,
  }),
  true,
);
assert.equal(
  canChangeTeamMemberRole({
    authority: "owner",
    targetAuthority: "member",
    nextRole: "owner",
    isSelf: false,
  }),
  true,
);
assert.equal(
  canChangeTeamMemberRole({
    authority: "admin",
    targetAuthority: "member",
    nextRole: "admin",
    isSelf: false,
  }),
  false,
);
assert.equal(canLeaveTeam("owner"), false);
assert.equal(canLeaveTeam("admin"), true);

const servicePath = "src/lib/organization-team-service.ts";
const service = source(servicePath);
for (const assertion of [
  'import "server-only"',
  "randomBytes(TEAM_INVITATION_TOKEN_BYTES)",
  'createHash("sha256")',
  "emailHash",
  "tokenHash",
  "expiresAt",
  "FOR UPDATE",
]) {
  assert.ok(service.includes(assertion), `${servicePath}: ${assertion}`);
}
assert.match(service, /const TEAM_INVITATION_TOKEN_BYTES = 32/);
assert.match(service, /const TEAM_INVITATION_TTL_MS = 72 \* 60 \* 60 \* 1000/);
assert.doesNotMatch(service, /email:\s*input\.email/);

const createInvitation = functionSource(
  service,
  "createOrganizationTeamInvitation",
);
assertInOrder(createInvitation, [
  "withDbSystemContext(async (tx)",
  "lockOrganization(tx, input.organizationId)",
  "getTeamAuthority(tx, organization, current.dbUserId)",
  "canInviteTeamRole(authority, input.role)",
  "tx.organizationInvitation",
  'action: "team.invitation.create"',
]);
assert.match(
  createInvitation,
  /invitationPath: `\/account\/team\?invitation=\$\{encodeURIComponent\(token\)\}`/,
);

const decideInvitation = functionSource(
  service,
  "decideOrganizationTeamInvitation",
);
assertInOrder(decideInvitation, [
  "assertTeamInvitationToken(token)",
  "hashTeamInvitationEmail(current.email)",
  "withDbSystemContext(async (tx)",
  'WHERE "tokenHash" = ${tokenHash}',
  "FOR UPDATE",
  "invitation.emailHash !== emailHash",
  'invitation.status !== "pending"',
  "tx.membership.upsert",
  "tx.organizationInvitation.update",
  "writeTeamAudit(tx",
]);

const leave = functionSource(service, "leaveOrganizationTeam");
assertInOrder(leave, [
  "lockOrganization(tx, organizationId)",
  "resolveTeamAuthority({",
  "canLeaveTeam(authority)",
  'data: { status: "left" }',
  'action: "team.member.leave"',
]);

const remove = functionSource(service, "removeOrganizationTeamMember");
assertInOrder(remove, [
  "lockOrganization(tx, input.organizationId)",
  "getTeamAuthority(",
  "getTeamMembership(",
  "canRemoveTeamMember({",
  'data: { status: "removed" }',
  'action: "team.member.remove"',
]);

const roleChange = functionSource(
  service,
  "changeOrganizationTeamMemberRole",
);
assertInOrder(roleChange, [
  "lockOrganization(tx, input.organizationId)",
  "canChangeTeamMemberRole({",
  'if (input.role === "owner")',
  'update: { role: "admin", status: "active" }',
  'data: { role: "owner", status: "active" }',
  "data: { ownerId: input.targetUserId }",
  'action: "team.owner.transfer"',
]);

const actionsPath = "src/app/account/team/actions.ts";
const actions = source(actionsPath);
for (const name of [
  "createTeamInvitationAction",
  "decideTeamInvitationAction",
  "leaveTeamAction",
  "removeTeamMemberAction",
  "changeTeamMemberRoleAction",
]) {
  const action = functionSource(actions, name);
  assert.match(action, /requireCurrentUserProfile\(\)/, name);
  assert.match(action, /requireTeamRateLimit\(/, name);
}
assert.match(actions, /const FAIL_CLOSED_RATE_LIMIT = \{ failClosed: true \}/);
assert.match(actions, /confirmation: z\.literal\("REMOVE"\)/);
assert.match(actions, /confirmation: z\.literal\("TRANSFER"\)/);
assert.match(actions, /confirmation: z\.literal\("LEAVE"\)/);

const inviteFormPath = "src/app/account/team/team-invite-form.tsx";
const inviteForm = source(inviteFormPath);
for (const assertion of [
  "useActionState(",
  "pending ? \"Creating...\"",
  'state.status === "error"',
  'state.status === "success"',
  'role={state.status === "error" ? "alert" : "status"}',
  'aria-live="polite"',
  "navigator.clipboard.writeText",
]) {
  assert.ok(inviteForm.includes(assertion), `${inviteFormPath}: ${assertion}`);
}

const managementPath = "src/app/account/team/team-management.tsx";
const management = source(managementPath);
for (const assertion of [
  "action={leaveTeamAction}",
  "action={removeTeamMemberAction}",
  "action={changeTeamMemberRoleAction}",
  'name="confirmation" value="LEAVE"',
  'name="confirmation" value="REMOVE"',
  'name="confirmation"',
  'value="TRANSFER"',
  "Transfer ownership to an active member before leaving this team.",
]) {
  assert.ok(management.includes(assertion), `${managementPath}: ${assertion}`);
}

const invitationPagePath = "src/app/account/team/team-invitation-review.tsx";
const invitationPage = source(invitationPagePath);
for (const assertion of [
  "action={decideTeamInvitationAction}",
  'name="decision" value="accept"',
  'name="decision" value="reject"',
  'pendingLabel="Accepting..."',
  'pendingLabel="Declining..."',
]) {
  assert.ok(invitationPage.includes(assertion), `${invitationPagePath}: ${assertion}`);
}

const teamPagePath = "src/app/account/team/page.tsx";
const teamPage = source(teamPagePath);
for (const assertion of [
  "isTeamInvitationToken(rawInvitation)",
  "getOrganizationTeamInvitation(current, invitationToken)",
  "<TeamInvitationReview",
]) {
  assert.ok(teamPage.includes(assertion), `${teamPagePath}: ${assertion}`);
}

const evidenceSource = source(PRODUCT_ACCOUNT_TEAM_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Account-team evidence passed in isolation: eight account requirements have source and policy proof with explicit runtime limitations; exact +8 central wiring is ready.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}

function assertInOrder(value: string, expected: readonly string[]) {
  let cursor = -1;
  for (const token of expected) {
    const next = value.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `Expected ordered token: ${token}`);
    cursor = next;
  }
}
