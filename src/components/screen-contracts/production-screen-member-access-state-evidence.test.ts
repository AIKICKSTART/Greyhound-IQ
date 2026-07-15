import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import { PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS } from "./production-screen-admin-access-state-evidence";
import {
  PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
} from "./production-screen-member-access-state-evidence";
import {
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
} from "./production-screen-messaging-access-state-evidence";
import { PUBLIC_SCREEN_PERMISSION_CONTRACTS } from "./screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-MEMBER-ACCESS-STATE-EVIDENCE

const TEST_ID = PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST.id;
const TEST_PATH = PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST.path;

const EXPECTED_PERMISSION_ROUTES = [
  "/account",
  "/account/appearance",
  "/account/billing",
  "/account/listings",
  "/account/listings/archived",
  "/account/listings/drafts",
  "/account/notifications",
  "/account/pages",
  "/account/pages/[id]",
  "/account/privacy",
  "/account/profile",
  "/account/saved-listings",
  "/account/security",
  "/account/support",
  "/account/support/[id]",
  "/listings/[id]/edit",
  "/marketplace/[id]/edit",
  "/account/team",
  "/account/usage",
  "/agents",
] as const;

const EXPECTED_STATE_ROUTES = [
  "/account",
  "/account/appearance",
  "/account/billing",
  "/account/listings",
  "/account/listings/archived",
  "/account/listings/drafts",
  "/account/notifications",
  "/account/pages",
  "/account/pages/[id]",
  "/account/privacy",
  "/account/profile",
  "/account/saved-listings",
  "/account/security",
  "/account/support",
  "/account/support/[id]",
  "/listings/[id]/edit",
  "/marketplace/[id]/edit",
  "/account/team",
  "/account/usage",
  "/agents",
] as const;

assert.equal(existsSync(TEST_PATH), true);
assert.deepEqual(
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.map(({ route }) => route),
  EXPECTED_PERMISSION_ROUTES,
  "the member permission wave must fail closed on route additions or removals",
);
assert.deepEqual(
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS.map(({ route }) => route),
  EXPECTED_STATE_ROUTES,
  "the member state wave must fail closed on route additions or removals",
);
assert.equal(PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.length, 20);
assert.equal(PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS.length, 20);
assert.equal(
  new Set<string>(
    PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.map(({ route }) => route),
  ).has("/account/appearance"),
  true,
  "Appearance Studio must retain its page-level member authentication after the production preview gate",
);

const priorPermissionRoutes = new Set<string>([
  ...PUBLIC_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route),
  ...PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS.map(({ route }) => route),
  ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.map(({ route }) => route),
]);
const priorStateRoutes = new Set<string>([
  ...PRODUCTION_SCREEN_STATE_CONTRACTS.map(({ route }) => route),
  ...PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS.map(({ route }) => route),
  ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.map(({ route }) => route),
]);

let permissionRuleCount = 0;
for (const contract of PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(contract.route);
  assert.ok(screen, `${contract.route}: missing screen registry entry`);
  assert.equal(priorPermissionRoutes.has(contract.route), false);
  assert.equal(screen.sourceFiles[0], contract.sourcePath);
  assert.equal(screen.coverage.permissions.status, "tested");
  assert.deepEqual(screen.permissionRules, contract.permissions);
  assert.ok(screen.coverage.permissions.evidence.includes(TEST_PATH));
  assert.ok(contract.permissions.length >= 2);
  for (const permission of contract.permissions) {
    assert.ok(permission.actor.length > 0);
    assert.ok(permission.enforcedBy.length > 0);
    assert.deepEqual(permission.testIds, [TEST_ID]);
  }
  permissionRuleCount += contract.permissions.length;
  assertSourceAssertions(contract.sourceAssertions, contract.route);
}
assert.equal(permissionRuleCount, 48);

const stateIds = new Set<string>();
for (const contract of PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(contract.route);
  assert.ok(screen, `${contract.route}: missing screen registry entry`);
  assert.equal(priorStateRoutes.has(contract.route), false);
  assert.equal(screen.sourceFiles[0], contract.sourcePath);
  assert.equal(screen.coverage.states.status, "verified");
  assert.deepEqual(
    screen.stateRules,
    contract.states.map(({ id, testIds, recoveryActionId }) => ({
      id,
      testIds,
      ...(recoveryActionId ? { recoveryActionId } : {}),
    })),
  );
  assert.deepEqual(
    screen.supportedStates,
    contract.states.map(({ id }) => id),
  );
  assert.ok(screen.coverage.states.evidence.includes(TEST_PATH));

  for (const state of contract.states) {
    assert.match(state.id, /^PRODUCTION\.STATE\.[A-Z0-9-]+\.[A-Z0-9-]+$/);
    assert.equal(stateIds.has(state.id), false, `${state.id} is duplicated`);
    stateIds.add(state.id);
    assert.deepEqual(state.testIds, [TEST_ID]);
    assert.equal("fixtureId" in state, false);
    assertSourceAssertions(state.sourceAssertions, state.id);
  }
}
assert.equal(stateIds.size, 69);

const requireCurrentUserProfile = functionSource(
  "src/lib/auth.ts",
  "requireCurrentUserProfile",
);
assertOrdered(
  requireCurrentUserProfile,
  ["await withAuth()", "if (!user)", 'throw new Error("auth.unauthorized")'],
  "missing sessions must fail before a current profile can be returned",
);

console.log(
  "Member access/state source evidence passed: 20 permission cells, 48 permission rules, 20 state cells, 69 explicit states; no browser, deployed-role, or runtime fixture claim",
);

function assertSourceAssertions(
  assertions: readonly {
    sourcePath: string;
    symbol?: string;
    orderedText: readonly [string, ...string[]];
  }[],
  label: string,
) {
  assert.ok(assertions.length > 0, `${label}: source assertions are required`);
  for (const sourceAssertion of assertions) {
    assert.equal(existsSync(sourceAssertion.sourcePath), true);
    const source = sourceAssertion.symbol
      ? functionSource(sourceAssertion.sourcePath, sourceAssertion.symbol)
      : readFileSync(sourceAssertion.sourcePath, "utf8");
    assertOrdered(
      source,
      sourceAssertion.orderedText,
      `${label}: ${sourceAssertion.sourcePath}${
        sourceAssertion.symbol ? `#${sourceAssertion.symbol}` : ""
      }`,
    );
  }
}

function functionSource(sourcePath: string, name: string) {
  const source = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `${sourcePath} must export ${name}`);
  return declaration.getText(sourceFile);
}

function assertOrdered(
  source: string,
  needles: readonly string[],
  message: string,
) {
  let cursor = 0;
  for (const needle of needles) {
    const index = source.indexOf(needle, cursor);
    assert.notEqual(index, -1, `${message}. Missing: ${needle}`);
    cursor = index + needle.length;
  }
}
