import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST,
} from "./production-screen-admin-access-state-evidence";
import { PUBLIC_SCREEN_PERMISSION_CONTRACTS } from "./screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-ADMIN-ACCESS-STATE-EVIDENCE

const TEST_ID = PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST.id;
const TEST_PATH = PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST.path;

const EXPECTED_ADMIN_EVIDENCE = {
  "/admin/billing-events": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-BILLING-EVENTS.LOADING",
      "PRODUCTION.STATE.ADMIN-BILLING-EVENTS.EMPTY",
      "PRODUCTION.STATE.ADMIN-BILLING-EVENTS.POPULATED",
    ],
  },
  "/admin/bug-reports": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-BUG-REPORTS.LOADING",
      "PRODUCTION.STATE.ADMIN-BUG-REPORTS.EMPTY",
      "PRODUCTION.STATE.ADMIN-BUG-REPORTS.POPULATED",
      "PRODUCTION.STATE.ADMIN-BUG-REPORTS.READ-ONLY",
    ],
  },
  "/admin/entitlements": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-ENTITLEMENTS.LOADING",
      "PRODUCTION.STATE.ADMIN-ENTITLEMENTS.EMPTY",
      "PRODUCTION.STATE.ADMIN-ENTITLEMENTS.POPULATED",
    ],
  },
  "/admin/feedback": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-FEEDBACK.LOADING",
      "PRODUCTION.STATE.ADMIN-FEEDBACK.EMPTY",
      "PRODUCTION.STATE.ADMIN-FEEDBACK.POPULATED",
      "PRODUCTION.STATE.ADMIN-FEEDBACK.READ-ONLY",
    ],
  },
  "/admin/invoices": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-INVOICES.LOADING",
      "PRODUCTION.STATE.ADMIN-INVOICES.EMPTY",
      "PRODUCTION.STATE.ADMIN-INVOICES.POPULATED",
    ],
  },
  "/admin/organizations": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-ORGANIZATIONS.LOADING",
      "PRODUCTION.STATE.ADMIN-ORGANIZATIONS.EMPTY",
      "PRODUCTION.STATE.ADMIN-ORGANIZATIONS.POPULATED",
    ],
  },
  "/admin/subscriptions": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-SUBSCRIPTIONS.LOADING",
      "PRODUCTION.STATE.ADMIN-SUBSCRIPTIONS.EMPTY",
      "PRODUCTION.STATE.ADMIN-SUBSCRIPTIONS.POPULATED",
    ],
  },
  "/admin/webhooks": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-WEBHOOKS.LOADING",
      "PRODUCTION.STATE.ADMIN-WEBHOOKS.EMPTY-STATUSES",
      "PRODUCTION.STATE.ADMIN-WEBHOOKS.EMPTY-EVENTS",
      "PRODUCTION.STATE.ADMIN-WEBHOOKS.POPULATED",
    ],
  },
  "/admin": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-DASHBOARD.LOADING",
      "PRODUCTION.STATE.ADMIN-DASHBOARD.EMPTY",
      "PRODUCTION.STATE.ADMIN-DASHBOARD.POPULATED",
    ],
  },
  "/admin/account-deletion": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-ACCOUNT-DELETION.LOADING",
      "PRODUCTION.STATE.ADMIN-ACCOUNT-DELETION.EMPTY",
      "PRODUCTION.STATE.ADMIN-ACCOUNT-DELETION.POPULATED",
    ],
  },
  "/admin/actions": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-ACTIONS.LOADING",
      "PRODUCTION.STATE.ADMIN-ACTIONS.EMPTY",
      "PRODUCTION.STATE.ADMIN-ACTIONS.POPULATED",
    ],
  },
  "/admin/audit": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-AUDIT.LOADING",
      "PRODUCTION.STATE.ADMIN-AUDIT.EMPTY",
      "PRODUCTION.STATE.ADMIN-AUDIT.POPULATED",
    ],
  },
  "/admin/bespoke": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-BESPOKE.LOADING",
      "PRODUCTION.STATE.ADMIN-BESPOKE.EMPTY",
      "PRODUCTION.STATE.ADMIN-BESPOKE.POPULATED",
    ],
  },
  "/admin/billing": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-BILLING.LOADING",
      "PRODUCTION.STATE.ADMIN-BILLING.EMPTY",
      "PRODUCTION.STATE.ADMIN-BILLING.POPULATED",
    ],
  },
  "/admin/compliance": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-COMPLIANCE.LOADING",
      "PRODUCTION.STATE.ADMIN-COMPLIANCE.EMPTY",
      "PRODUCTION.STATE.ADMIN-COMPLIANCE.POPULATED",
    ],
  },
  "/admin/dog-ownership": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-DOG-OWNERSHIP.LOADING",
      "PRODUCTION.STATE.ADMIN-DOG-OWNERSHIP.EMPTY",
      "PRODUCTION.STATE.ADMIN-DOG-OWNERSHIP.POPULATED",
    ],
  },
  "/admin/exports": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-EXPORTS.LOADING",
      "PRODUCTION.STATE.ADMIN-EXPORTS.EMPTY",
      "PRODUCTION.STATE.ADMIN-EXPORTS.POPULATED",
    ],
  },
  "/admin/feed": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-FEED.LOADING",
      "PRODUCTION.STATE.ADMIN-FEED.EMPTY",
      "PRODUCTION.STATE.ADMIN-FEED.POPULATED",
    ],
  },
  "/admin/invitations": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-INVITATIONS.LOADING",
      "PRODUCTION.STATE.ADMIN-INVITATIONS.EMPTY",
      "PRODUCTION.STATE.ADMIN-INVITATIONS.POPULATED",
    ],
  },
  "/admin/jobs": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-JOBS.LOADING",
      "PRODUCTION.STATE.ADMIN-JOBS.EMPTY",
      "PRODUCTION.STATE.ADMIN-JOBS.POPULATED",
    ],
  },
  "/admin/listings": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-LISTINGS.LOADING",
      "PRODUCTION.STATE.ADMIN-LISTINGS.EMPTY",
      "PRODUCTION.STATE.ADMIN-LISTINGS.POPULATED",
    ],
  },
  "/admin/page-rules": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-PAGE-RULES.LOADING",
      "PRODUCTION.STATE.ADMIN-PAGE-RULES.DEFAULT",
      "PRODUCTION.STATE.ADMIN-PAGE-RULES.POPULATED",
    ],
  },
  "/admin/payments": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-PAYMENTS.LOADING",
      "PRODUCTION.STATE.ADMIN-PAYMENTS.EMPTY",
      "PRODUCTION.STATE.ADMIN-PAYMENTS.POPULATED",
    ],
  },
  "/admin/plans": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-PLANS.LOADING",
      "PRODUCTION.STATE.ADMIN-PLANS.EMPTY",
      "PRODUCTION.STATE.ADMIN-PLANS.POPULATED",
    ],
  },
  "/admin/reports": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-REPORTS.LOADING",
      "PRODUCTION.STATE.ADMIN-REPORTS.EMPTY",
      "PRODUCTION.STATE.ADMIN-REPORTS.POPULATED",
    ],
  },
  "/admin/retention": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-RETENTION.LOADING",
      "PRODUCTION.STATE.ADMIN-RETENTION.EMPTY",
      "PRODUCTION.STATE.ADMIN-RETENTION.POPULATED",
    ],
  },
  "/admin/safety": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-SAFETY.LOADING",
      "PRODUCTION.STATE.ADMIN-SAFETY.EMPTY",
      "PRODUCTION.STATE.ADMIN-SAFETY.POPULATED",
    ],
  },
  "/admin/site-content": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-SITE-CONTENT.LOADING",
      "PRODUCTION.STATE.ADMIN-SITE-CONTENT.DEFAULT",
      "PRODUCTION.STATE.ADMIN-SITE-CONTENT.POPULATED",
    ],
  },
  "/admin/source-health": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-SOURCE-HEALTH.LOADING",
      "PRODUCTION.STATE.ADMIN-SOURCE-HEALTH.EMPTY",
      "PRODUCTION.STATE.ADMIN-SOURCE-HEALTH.POPULATED",
    ],
  },
  "/admin/support": {
    guard: "requireModeratorProfile()",
    decisions: ["deny", "deny", "allow", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-SUPPORT.LOADING",
      "PRODUCTION.STATE.ADMIN-SUPPORT.EMPTY",
      "PRODUCTION.STATE.ADMIN-SUPPORT.POPULATED",
      "PRODUCTION.STATE.ADMIN-SUPPORT.READ-ONLY",
    ],
  },
  "/admin/usage": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-USAGE.LOADING",
      "PRODUCTION.STATE.ADMIN-USAGE.EMPTY",
      "PRODUCTION.STATE.ADMIN-USAGE.POPULATED",
    ],
  },
  "/admin/users": {
    guard: "requireAdminProfile()",
    decisions: ["deny", "deny", "allow"],
    stateIds: [
      "PRODUCTION.STATE.ADMIN-USERS.LOADING",
      "PRODUCTION.STATE.ADMIN-USERS.EMPTY",
      "PRODUCTION.STATE.ADMIN-USERS.POPULATED",
    ],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.map(({ route }) => route),
  Object.keys(EXPECTED_ADMIN_EVIDENCE),
  "the admin access/state wave must fail closed on route additions or removals",
);
assert.equal(PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.length, 32);

const previousPermissionRoutes = new Set<string>(
  PUBLIC_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route),
);
const previousStateRoutes = new Set<string>(
  PRODUCTION_SCREEN_STATE_CONTRACTS.map(({ route }) => route),
);
const allStateIds = new Set<string>();
let permissionRuleCount = 0;

for (const contract of PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS) {
  const expected =
    EXPECTED_ADMIN_EVIDENCE[
      contract.route as keyof typeof EXPECTED_ADMIN_EVIDENCE
    ];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(contract.route);
  assert.ok(screen, `${contract.route}: missing screen registry entry`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.authentication, "required");
  assert.equal(previousPermissionRoutes.has(contract.route), false);
  assert.equal(previousStateRoutes.has(contract.route), false);
  assert.equal(existsSync(contract.sourcePath), true);
  assert.equal(contract.sourcePath, screen.sourceFiles[0]);
  assert.equal(contract.guardCall, expected.guard);
  assert.deepEqual(
    contract.permissions.map(({ decision }) => decision),
    expected.decisions,
  );
  assert.deepEqual(
    contract.states.map(({ id }) => id),
    expected.stateIds,
  );

  const pageSource = functionSource(contract.sourcePath, contract.pageFunction);
  assertOrdered(
    pageSource,
    [contract.guardCall, contract.readCall],
    `${contract.route}: authorization must precede protected reads`,
  );

  assert.equal(screen.coverage.permissions.status, "tested");
  assert.deepEqual(screen.permissionRules, contract.permissions);
  assert.ok(screen.coverage.permissions.evidence.includes(TEST_PATH));
  for (const permission of contract.permissions) {
    assert.ok(permission.enforcedBy.length > 0);
    assert.deepEqual(permission.testIds, [TEST_ID]);
  }
  permissionRuleCount += contract.permissions.length;

  assert.equal(screen.coverage.states.status, "verified");
  assert.deepEqual(
    screen.stateRules,
    contract.states.map(({ id, testIds }) => ({ id, testIds })),
  );
  assert.deepEqual(
    screen.supportedStates,
    contract.states.map(({ id }) => id),
  );
  assert.ok(screen.coverage.states.evidence.includes(TEST_PATH));

  for (const state of contract.states) {
    assert.match(state.id, /^PRODUCTION\.STATE\.ADMIN-[A-Z0-9-]+\.[A-Z0-9-]+$/);
    assert.equal(allStateIds.has(state.id), false, `${state.id} is duplicated`);
    allStateIds.add(state.id);
    assert.deepEqual(state.testIds, [TEST_ID]);
    assert.equal("fixtureId" in state, false);
    assert.equal("recoveryActionId" in state, false);
    assert.ok(state.sourceAssertions.length > 0);

    for (const assertion of state.sourceAssertions) {
      assert.equal(existsSync(assertion.sourcePath), true);
      assert.match(assertion.sourcePath, /^src\/app\//);
      assertOrdered(
        readFileSync(assertion.sourcePath, "utf8"),
        assertion.orderedText,
        `${state.id}: ${assertion.sourcePath}`,
      );
    }

    if (state.id.endsWith(".LOADING")) {
      assert.equal(
        state.sourceAssertions.some(
          ({ sourcePath }) => sourcePath === "src/app/admin/loading.tsx",
        ),
        true,
      );
    }
    if (state.id.includes(".EMPTY")) {
      const proof = state.sourceAssertions.flatMap(({ orderedText }) => orderedText);
      assert.equal(proof.some((text) => text.includes("length === 0")), true);
    }
    if (state.id.endsWith(".POPULATED")) {
      const proof = state.sourceAssertions.flatMap(({ orderedText }) => orderedText);
      assert.equal(proof.some((text) => text.includes(".map(")), true);
    }
  }
}

assert.equal(permissionRuleCount, 105);
assert.equal(allStateIds.size, 100);
assert.equal(
  [...allStateIds].filter((id) => id.endsWith(".LOADING")).length,
  32,
);
assert.equal(
  [...allStateIds].filter((id) => id.endsWith(".READ-ONLY")).length,
  3,
);

const requireCurrentUserProfile = functionSource(
  "src/lib/auth.ts",
  "requireCurrentUserProfile",
);
assertOrdered(
  requireCurrentUserProfile,
  ["await withAuth()", "if (!user)", 'throw new Error("auth.unauthorized")'],
  "missing sessions must be rejected before protected profile work",
);

const requireModeratorProfile = functionSource(
  "src/lib/auth.ts",
  "requireModeratorProfile",
);
assertOrdered(
  requireModeratorProfile,
  [
    "requireCurrentUserProfile()",
    "if (!isModeratorRole(current.profileRole))",
    'throw new Error("auth.forbidden")',
  ],
  "moderator access must use the exact moderator-role predicate",
);

const requireAdminProfile = functionSource("src/lib/auth.ts", "requireAdminProfile");
assertOrdered(
  requireAdminProfile,
  [
    "requireCurrentUserProfile()",
    "if (!isAdminRole(current.profileRole))",
    'throw new Error("auth.forbidden")',
  ],
  "administrator access must use the exact admin-role predicate",
);

const adminMutationsSource = readFileSync("src/app/admin/mutations.ts", "utf8");
for (const functionName of ["updateAdminStatus", "updateAdminBugReportAction"]) {
  const source = functionSource("src/app/admin/mutations.ts", functionName);
  assert.match(
    source,
    /^export async function .+\{\s*const current = await requireAdminProfile\(\);/,
    `${functionName} must independently enforce administrator access`,
  );
}
assert.ok(adminMutationsSource.includes("await updateAdminBugReport(current, parsed);"));

console.log(
  "Admin access/state evidence passed: 32 permission routes, 105 permission rules, 32 state routes, 100 explicit source states",
);

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

function assertOrdered(source: string, needles: readonly string[], message: string) {
  let cursor = 0;
  for (const needle of needles) {
    const index = source.indexOf(needle, cursor);
    assert.notEqual(index, -1, `${message}. Missing: ${needle}`);
    cursor = index + needle.length;
  }
}
