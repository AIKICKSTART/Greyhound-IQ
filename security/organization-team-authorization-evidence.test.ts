import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  canChangeTeamMemberRole,
  canInviteTeamRole,
  canLeaveTeam,
  canRemoveTeamMember,
  resolveTeamAuthority,
} from "../src/lib/organization-team-policy";
import {
  ORGANIZATION_TEAM_AUTHORIZATION_EVIDENCE_FILE,
  ORGANIZATION_TEAM_AUTHORIZATION_EXPECTED_GAIN,
  ORGANIZATION_TEAM_AUTHORIZATION_MASTER_EVIDENCE,
  ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS,
  ORGANIZATION_TEAM_AUTHORIZATION_SCOPE,
  ORGANIZATION_TEAM_AUTHORIZATION_TEST_FILE,
  ORGANIZATION_TEAM_AUTHORIZATION_TRACES,
} from "./organization-team-authorization-evidence";

assert.equal(ORGANIZATION_TEAM_AUTHORIZATION_EXPECTED_GAIN, 11);
assert.equal(new Set(ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS).size, 11);
assert.deepEqual(
  Object.keys(ORGANIZATION_TEAM_AUTHORIZATION_MASTER_EVIDENCE),
  ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS,
);
for (const assertion of [
  /source, policy-unit/i,
  /current user on the server/i,
  /cross-organization denial/i,
  /does not claim browser hydration/i,
  /production concurrency/i,
  /authorization outside the organization-team workflow/i,
]) {
  assert.match(ORGANIZATION_TEAM_AUTHORIZATION_SCOPE, assertion);
}

for (const requirementId of ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.equal(SECURITY_MASTER_EVIDENCE[requirementId]?.status, "verified");
  assert.equal(isMasterRequirementComplete(requirement), true);

  const evidence =
    ORGANIZATION_TEAM_AUTHORIZATION_MASTER_EVIDENCE[requirementId];
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    ORGANIZATION_TEAM_AUTHORIZATION_EVIDENCE_FILE,
    ORGANIZATION_TEAM_AUTHORIZATION_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.deepEqual(
  ORGANIZATION_TEAM_AUTHORIZATION_TRACES.map(
    ({ requirementId, expectedResult }) => ({ requirementId, expectedResult }),
  ),
  [
    {
      requirementId: "security.trace.35.team-invite-create",
      expectedResult: "allowed",
    },
    {
      requirementId: "security.trace.37.team-role-change",
      expectedResult: "allowed",
    },
    {
      requirementId: "security.trace.38.last-owner-removal-attempt",
      expectedResult: "denied",
    },
  ],
);
for (const trace of ORGANIZATION_TEAM_AUTHORIZATION_TRACES) {
  assert.ok(trace.actor.length > 30, `${trace.requirementId}: actor missing`);
  assert.equal(trace.steps.length, 2, `${trace.requirementId}: trace drifted`);
  for (const step of trace.steps) {
    for (const [field, value] of Object.entries(step)) {
      assert.ok(value.trim(), `${trace.requirementId}: ${field} missing`);
    }
    assert.equal(existsSync(step.sourceFile), true, step.sourceFile);
    assert.equal(existsSync(step.test), true, step.test);
  }
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
    actorUserId: "removed-admin",
    organizationOwnerId: "owner",
    membership: { role: "admin", status: "removed" },
  }),
  "none",
);
assert.equal(canInviteTeamRole("admin", "admin"), false);
assert.equal(canLeaveTeam("owner"), false);
assert.equal(
  canRemoveTeamMember({
    authority: "owner",
    targetAuthority: "owner",
    isSelf: false,
  }),
  false,
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

const actions = read("src/app/account/team/actions.ts");
for (const name of [
  "createTeamInvitationAction",
  "changeTeamMemberRoleAction",
  "removeTeamMemberAction",
]) {
  const action = functionSource(actions, name);
  assert.match(action, /requireCurrentUserProfile\(\)/, name);
  assert.match(action, /requireTeamRateLimit\(/, name);
}
assert.match(actions, /confirmation: z\.literal\("REMOVE"\)/);
assert.match(actions, /confirmation: z\.literal\("TRANSFER"\)/);

const service = read("src/lib/organization-team-service.ts");
const invitation = functionSource(service, "createOrganizationTeamInvitation");
assertInOrder(invitation, [
  "lockOrganization(tx, input.organizationId)",
  "getTeamAuthority(tx, organization, current.dbUserId)",
  "canInviteTeamRole(authority, input.role)",
  "tx.organizationInvitation",
  'action: "team.invitation.create"',
]);
const roleChange = functionSource(
  service,
  "changeOrganizationTeamMemberRole",
);
assertInOrder(roleChange, [
  "lockOrganization(tx, input.organizationId)",
  "getTeamAuthority(",
  "getTeamMembership(",
  "canChangeTeamMemberRole({",
  'if (input.role === "owner")',
  "data: { ownerId: input.targetUserId }",
  'action: "team.owner.transfer"',
]);
const removal = functionSource(service, "removeOrganizationTeamMember");
assertInOrder(removal, [
  "lockOrganization(tx, input.organizationId)",
  "getTeamAuthority(",
  "getTeamMembership(",
  "canRemoveTeamMember({",
  'throw new Error("team.member_remove_forbidden")',
  "tx.membership.update",
]);
const membershipLookup = functionSource(service, "getTeamMembership");
assert.match(
  membershipLookup,
  /organizationId_userId: \{ organizationId, userId \}/,
  "target membership must remain inseparable from its organization",
);

const rls = JSON.parse(
  read("security/row-level-security-runtime-evidence.json"),
) as {
  verdict: string;
  safety: { productionContacted: boolean };
  cases: Record<string, OrganizationCounts>;
};
assert.equal(rls.verdict, "verified");
assert.equal(rls.safety.productionContacted, false);
assert.deepEqual(rls.cases.anonymous, zeroCounts());
assert.deepEqual(rls.cases.ownerA, {
  membershipA: 1,
  membershipB: 0,
  organizationA: 1,
  organizationB: 0,
  signupOutbox: 0,
});
assert.deepEqual(rls.cases.ownerB, {
  membershipA: 0,
  membershipB: 1,
  organizationA: 0,
  organizationB: 1,
  signupOutbox: 0,
});

console.log(
  "Organization/team authorization evidence passed: server-resolved authority, cross-organization RLS denial, last-owner protection, and three exact traces verified",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(source: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "organization-team-evidence.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let match: ts.FunctionDeclaration | undefined;
  const walk = (node: ts.Node) => {
    if (
      !match &&
      ts.isFunctionDeclaration(node) &&
      node.name?.text === name
    ) {
      match = node;
    }
    node.forEachChild(walk);
  };
  walk(sourceFile);
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}

function assertInOrder(source: string, assertions: readonly string[]) {
  let previous = -1;
  for (const assertion of assertions) {
    const index = source.indexOf(assertion);
    assert.ok(index > previous, `${assertion}: missing or out of order`);
    previous = index;
  }
}

type OrganizationCounts = {
  membershipA: number;
  membershipB: number;
  organizationA: number;
  organizationB: number;
  signupOutbox: number;
};

function zeroCounts(): OrganizationCounts {
  return {
    membershipA: 0,
    membershipB: 0,
    organizationA: 0,
    organizationB: 0,
    signupOutbox: 0,
  };
}
