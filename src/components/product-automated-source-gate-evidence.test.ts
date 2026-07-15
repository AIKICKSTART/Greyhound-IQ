import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  PRODUCT_AUTOMATED_SOURCE_GATE_EVIDENCE_FILE,
  PRODUCT_AUTOMATED_SOURCE_GATE_EXPECTED_GAIN,
  PRODUCT_AUTOMATED_SOURCE_GATE_MASTER_EVIDENCE,
  PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_GAPS,
  PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_REQUIREMENT_IDS,
  PRODUCT_AUTOMATED_SOURCE_GATE_REGISTRY_FILE,
  PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS,
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY,
  PRODUCT_AUTOMATED_SOURCE_GATE_TEST_FILE,
} from "./product-automated-source-gate-evidence";
import {
  buildProductAutomatedSourceGateRegistry,
  findInternalLinkIssues,
  findPrimaryActionIssues,
  findStateFixtureIssues,
  matchInternalRoute,
  type ProductInternalLinkRecord,
  type ProductPrimaryActionRecord,
  type ProductStateFixtureRecord,
} from "./product-automated-source-gate-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-AUTOMATED-SOURCE-GATE-EVIDENCE

assert.deepEqual(PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS, [
  "VERIFY.GATE.internal-link",
  "VERIFY.GATE.primary-action",
]);
assert.equal(PRODUCT_AUTOMATED_SOURCE_GATE_EXPECTED_GAIN, 1);
assert.deepEqual(PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_REQUIREMENT_IDS, [
  "VERIFY.GATE.primary-action",
  "VERIFY.GATE.state-fixture",
]);
assert.deepEqual(
  Object.keys(PRODUCT_AUTOMATED_SOURCE_GATE_MASTER_EVIDENCE),
  PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS,
);

const requirementIds = new Set(PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id));
for (const requirementId of [
  ...PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS,
  ...PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_REQUIREMENT_IDS,
]) {
  assert.equal(requirementIds.has(requirementId), true, requirementId);
}

for (const [requirementId, evidence] of Object.entries(
  PRODUCT_AUTOMATED_SOURCE_GATE_MASTER_EVIDENCE,
)) {
  assert.equal(
    evidence.status,
    requirementId === "VERIFY.GATE.internal-link" ? "tested" : "blocked",
    requirementId,
  );
  assert.deepEqual(evidence.evidence.slice(0, 3), [
    PRODUCT_AUTOMATED_SOURCE_GATE_EVIDENCE_FILE,
    PRODUCT_AUTOMATED_SOURCE_GATE_TEST_FILE,
    PRODUCT_AUTOMATED_SOURCE_GATE_REGISTRY_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(
      existsSync(evidencePath),
      true,
      `${requirementId}: ${evidencePath}`,
    ),
  );
}

const clientSafeEvidenceSource = readFileSync(
  PRODUCT_AUTOMATED_SOURCE_GATE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(clientSafeEvidenceSource, /from ["']node:/);
assert.doesNotMatch(
  clientSafeEvidenceSource,
  /\breadFileSync\b|\bprocess\.cwd\b/,
);

const registry = buildProductAutomatedSourceGateRegistry();
assert.equal(
  SCREEN_CONTRACTS.length,
  PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.screenCount,
);
assert.deepEqual(
  registry.auditedRoutes,
  SCREEN_CONTRACTS.map(({ route }) => route).toSorted(),
);
assert.ok(registry.auditedSourceFiles.length >= 400);
assert.ok(registry.routePatterns.length >= SCREEN_CONTRACTS.length);

assert.ok(registry.internalLinks.length >= 446);
assert.deepEqual(registry.internalLinkIssues, []);
for (const link of registry.internalLinks) {
  assert.ok(link.sourceLine > 0, link.id);
  assert.ok(link.sourceColumn > 0, link.id);
  assert.equal(existsSync(link.sourceFile), true, link.id);
  assert.ok(link.ownerRoutes.length > 0, link.id);
  assert.ok(link.normalizedTarget.startsWith("/"), link.id);
  assert.ok(link.matchedRoutePattern, link.id);
  assert.ok(registry.routePatterns.includes(link.matchedRoutePattern), link.id);
}
assert.ok(
  registry.internalLinks.some(
    (link) =>
      link.sourceFile === "src/app/results/page.tsx" &&
      link.normalizedTarget === "/races/__GIQ_DYNAMIC_SEGMENT__" &&
      link.matchedRoutePattern === "/races/[id]",
  ),
  "source-resolvable identifier hrefs must remain in the internal-link registry",
);
assert.equal(
  matchInternalRoute("/dogs/source-negative", registry.routePatterns),
  "/dogs/[id]",
);
assert.equal(
  matchInternalRoute("/__source_gate_missing_route__", registry.routePatterns),
  null,
);
const missingLinkFixture: ProductInternalLinkRecord = {
  id: "negative-link",
  sourceFile: "src/app/page.tsx",
  sourceLine: 1,
  sourceColumn: 1,
  ownerRoutes: ["/"],
  kind: "jsx-href",
  rawTarget: "/__source_gate_missing_route__",
  normalizedTarget: "/__source_gate_missing_route__",
  matchedRoutePattern: null,
};
assert.deepEqual(findInternalLinkIssues([missingLinkFixture]), [
  {
    code: "MISSING_INTERNAL_ROUTE",
    recordId: "negative-link",
    sourceFile: "src/app/page.tsx",
    target: "/__source_gate_missing_route__",
  },
]);

const expectedActionIds = SCREEN_CONTRACTS.flatMap((screen) =>
  screen.primaryActions.map((actionId) => `${screen.route}::${actionId}`),
).toSorted((left, right) => left.localeCompare(right));
assert.equal(
  expectedActionIds.length,
  PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.primaryActionCount,
);
assert.equal(new Set(expectedActionIds).size, expectedActionIds.length);
assert.deepEqual(
  registry.primaryActions.map(({ id }) => id),
  expectedActionIds,
);
assert.ok(
  registry.primaryActionIssues.length > 0,
  "the primary-action gate must remain blocked while exact bindings are absent",
);
const actionIssuesByRecord = new Map(
  registry.primaryActions.map((action) => [
    action.id,
    registry.primaryActionIssues.filter((issue) => issue.recordId === action.id),
  ]),
);
const correctedExistingBindingActionIds = [
  "/admin/listings::ADMIN-LISTINGS.ACTION.LISTING.OPEN",
  "/discover::DISCOVER.ACTION.ACTOR.OPEN",
  "/discover::DISCOVER.ACTION.DOG.OPEN",
  "/dogs::DOGS.ACTION.DOG.OPEN",
  "/listings::MARKETPLACE.ACTION.LISTING.OPEN",
  "/marketplace::MARKETPLACE.ACTION.LISTING.OPEN",
  "/meetings/[id]::MEETING-DETAIL.ACTION.TRACK.OPEN",
  "/messages/[id]::MESSAGE-THREAD.ACTION.SEARCH",
  "/races::RACES.ACTION.TRACK.OPEN",
  "/races/[id]::RACE-DETAIL.ACTION.DOG.OPEN",
  "/results::RESULTS.ACTION.RACE.OPEN",
  "/tracks::TRACKS.ACTION.RACE.OPEN",
  "/tracks::TRACKS.ACTION.TRACK.OPEN",
  "/tracks/[id]::TRACK-DETAIL.ACTION.RACE.OPEN",
] as const;
const explicitImplementationBindingActionIds = [
  "/admin/listings::ADMIN-LISTINGS.ACTION.CATEGORY.ACTIVE.SET",
  "/admin/listings::ADMIN-LISTINGS.ACTION.LISTING.APPROVE",
  "/admin/listings::ADMIN-LISTINGS.ACTION.LISTING.REJECT",
  "/admin/listings::ADMIN-LISTINGS.ACTION.LISTING.REMOVE",
  "/listings/[id]::MARKETPLACE-DETAIL.ACTION.SAVE.TOGGLE",
  "/marketplace/[id]::MARKETPLACE-DETAIL.ACTION.SAVE.TOGGLE",
  "/privacy::PRIVACY.ACTION.COOKIE.ACCEPT",
  "/privacy::PRIVACY.ACTION.COOKIE.DECLINE",
  "/privacy::PRIVACY.ACTION.GAMBLING-HELP.OPEN",
  "/races/[id]::RACE-DETAIL.ACTION.REPLAY.PLAY",
] as const;
for (const actionId of [
  ...correctedExistingBindingActionIds,
  ...explicitImplementationBindingActionIds,
]) {
  const action = registry.primaryActions.find(({ id }) => id === actionId);
  assert.ok(action, `${actionId}: missing primary-action record`);
  assert.deepEqual(
    actionIssuesByRecord.get(actionId),
    [],
    `${actionId}: exact implementation/test binding regressed`,
  );
  assert.ok(action.implementationEvidence.length > 0, actionId);
  assert.ok(action.testEvidence.length > 0, actionId);
}
assert.ok(
  new Set(registry.primaryActionIssues.map(({ recordId }) => recordId)).size <=
    143,
  "the bounded binding batch must close at least 24 of the 167 strict baseline action gaps",
);

const explicitPurposeContractIds = [
  "ADMIN-LISTINGS.ACTION.CATEGORY.CREATE",
  "ADMIN-LISTINGS.ACTION.CATEGORY.ACTIVE.SET",
  "ADMIN-LISTINGS.ACTION.LISTING.APPROVE",
  "ADMIN-LISTINGS.ACTION.LISTING.REJECT",
  "ADMIN-LISTINGS.ACTION.LISTING.REMOVE",
  "ADMIN-LISTINGS.FORM.CATEGORY-CREATE",
  "ADMIN-LISTINGS.FORM.CATEGORY-ACTIVE",
  "ADMIN-LISTINGS.FORM.APPROVE",
  "ADMIN-LISTINGS.FORM.REJECT",
  "ADMIN-LISTINGS.FORM.REMOVE",
  "MARKETPLACE-DETAIL.ACTION.ENQUIRY.SEND",
  "MARKETPLACE-DETAIL.ACTION.SAVE.TOGGLE",
  "MARKETPLACE-DETAIL.FORM.ENQUIRY",
  "PRIVACY.ACTION.COOKIE.ACCEPT",
  "PRIVACY.ACTION.COOKIE.DECLINE",
  "PRIVACY.ACTION.GAMBLING-HELP.OPEN",
  "RACE-DETAIL.ACTION.REPLAY.PLAY",
] as const;
const interactiveIssueIds = new Set(
  registry.interactiveControlIssues.map(({ recordId }) => recordId),
);
for (const purposeId of explicitPurposeContractIds) {
  const boundControls = registry.interactiveControls.filter(({ purposeContractIds }) =>
    purposeContractIds.includes(purposeId),
  );
  assert.ok(boundControls.length > 0, `${purposeId}: no exact source control`);
  boundControls.forEach(({ id }) =>
    assert.equal(interactiveIssueIds.has(id), false, `${purposeId}: ${id}`),
  );
}
for (const action of registry.primaryActions) {
  assert.ok(action.result.trim(), action.id);
  assert.ok(action.enforcement.trim(), action.id);
  assert.ok(action.contractSourceFile, action.id);
  assert.ok(
    action.contractSourceLine && action.contractSourceLine > 0,
    action.id,
  );
  assert.equal(existsSync(action.contractSourceFile), true, action.id);
  action.implementationEvidence.forEach((implementation) => {
    assert.equal(implementation.actionId, action.actionId, action.id);
    assert.equal(existsSync(implementation.sourceFile), true, action.id);
    assert.ok(implementation.sourceLine > 0, action.id);
    assert.ok(implementation.value.trim(), action.id);
  });
  action.testEvidence.forEach((test) => {
    assert.equal(test.actionId, action.actionId, action.id);
    assert.ok(action.declaredTestIds.includes(test.testId), action.id);
    assert.equal(existsSync(test.testFile), true, `${action.id}: ${test.testFile}`);
  });
  if ((actionIssuesByRecord.get(action.id) ?? []).length === 0) {
    assert.ok(action.implementationEvidence.length > 0, action.id);
    assert.ok(action.testEvidence.length > 0, action.id);
    assert.notEqual(action.resolution, "unresolved", action.id);
  }
  for (const destination of action.destinations) {
    assert.ok(destination.normalizedTarget.startsWith("/"), action.id);
    assert.ok(destination.matchedRoutePattern, action.id);
  }
}

const missingActionFixture: ProductPrimaryActionRecord = {
  id: "/negative::ACTION.MISSING",
  route: "/negative",
  actionId: "ACTION.MISSING",
  result: "Attempts an action without an implementation path.",
  enforcement: "",
  contractSourceFile: null,
  contractSourceLine: null,
  declaredTestIds: ["ACTION.MISSING.TEST"],
  implementationEvidence: [],
  testEvidence: [],
  destinations: [],
  resolution: "unresolved",
};
assert.deepEqual(
  new Set(
    findPrimaryActionIssues([missingActionFixture]).map(({ code }) => code),
  ),
  new Set([
    "ACTION_CONTRACT_SOURCE_MISSING",
    "ACTION_SOURCE_SIGNAL_MISSING",
    "ACTION_TEST_MISSING",
    "ACTION_HANDLER_OR_DESTINATION_MISSING",
  ]),
);
const unrelatedActionEvidenceFixture: ProductPrimaryActionRecord = {
  ...missingActionFixture,
  id: "/negative::ACTION.UNRELATED-EVIDENCE",
  actionId: "ACTION.UNRELATED-EVIDENCE",
  enforcement: "handleUnrelatedEvidenceAction",
  contractSourceFile: "src/app/page.tsx",
  contractSourceLine: 1,
  declaredTestIds: ["ACTION.UNRELATED-EVIDENCE.TEST"],
  implementationEvidence: [
    {
      actionId: "ACTION.DIFFERENT",
      sourceFile: "src/app/page.tsx",
      sourceLine: 1,
      binding: "handler-token",
      value: "handleDifferentAction",
    },
  ],
  testEvidence: [
    {
      actionId: "ACTION.DIFFERENT",
      testId: "ACTION.DIFFERENT.TEST",
      testFile: PRODUCT_AUTOMATED_SOURCE_GATE_TEST_FILE,
    },
  ],
  resolution: "handler-contract",
};
assert.deepEqual(
  new Set(
    findPrimaryActionIssues([unrelatedActionEvidenceFixture]).map(
      ({ code }) => code,
    ),
  ),
  new Set([
    "ACTION_SOURCE_SIGNAL_MISSING",
    "ACTION_TEST_MISSING",
    "ACTION_HANDLER_OR_DESTINATION_MISSING",
  ]),
  "evidence belonging to another action must not close this action",
);
assert.ok(
  registry.primaryActionIssues.some(
    (issue) =>
      issue.recordId ===
        "/account/team::ACCOUNT-TEAM.ACTION.INVITATION.COPY" &&
      issue.code === "ACTION_SOURCE_SIGNAL_MISSING",
  ),
  "the invitation-copy control must stay open until its implementation is exactly bound",
);
const resolvedAction = registry.primaryActions.find(
  (action) => (actionIssuesByRecord.get(action.id) ?? []).length === 0,
);
assert.ok(resolvedAction, "at least one independently bound action is expected");
const missingActionDestinationFixture: ProductPrimaryActionRecord = {
  ...resolvedAction,
  id: "/negative::ACTION.BAD-DESTINATION",
  destinations: [
    {
      rawTarget: "/__source_gate_missing_route__",
      normalizedTarget: "/__source_gate_missing_route__",
      matchedRoutePattern: null,
    },
  ],
  resolution: "handler-contract",
};
assert.deepEqual(findPrimaryActionIssues([missingActionDestinationFixture]), [
  {
    code: "ACTION_DESTINATION_MISSING",
    recordId: "/negative::ACTION.BAD-DESTINATION",
    detail:
      "The declared internal destination /__source_gate_missing_route__ has no page or route handler.",
  },
]);

const expectedStateIds = SCREEN_CONTRACTS.flatMap((screen) =>
  screen.stateRules.map((state) => `${screen.route}::${state.id}`),
).toSorted((left, right) => left.localeCompare(right));
assert.equal(expectedStateIds.length, PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateCount);
assert.deepEqual(
  registry.stateFixtures.map(({ id }) => id),
  expectedStateIds,
);
assert.equal(
  registry.stateFixtureIssues.length,
  PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.missingStateFixtureCount,
);
assert.equal(
  registry.stateFixtures.filter(({ fixtureId }) => fixtureId).length,
  PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateFixtureCount,
);
assert.equal(
  registry.stateFixtures.filter(({ recoveryActionId }) => recoveryActionId)
    .length,
  PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.recoveryActionCount,
);
const missingStateFixture: ProductStateFixtureRecord = {
  id: "/negative::STATE.MISSING",
  route: "/negative",
  stateId: "STATE.MISSING",
  fixtureId: null,
  recoveryActionId: null,
  evidence: [],
};
assert.deepEqual(findStateFixtureIssues([missingStateFixture]), [
  {
    code: "STATE_FIXTURE_MISSING",
    recordId: "/negative::STATE.MISSING",
    route: "/negative",
    stateId: "STATE.MISSING",
  },
]);

assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  new RegExp(`all ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.screenCount} registered screens`, "i"),
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  /all current source-resolvable internal targets/i,
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  new RegExp(`all ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.primaryActionCount} route-scoped actions`, "i"),
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  /unrelated source signals or route-level test files cannot satisfy another action/i,
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  /does not claim browser rendering/i,
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  new RegExp(`only ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateFixtureCount} of ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateCount} declared states`, "i"),
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE,
  new RegExp(`other ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.missingStateFixtureCount} are reported`, "i"),
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_GAPS["VERIFY.GATE.primary-action"],
  /every route-scoped action is independently source-backed and test-backed/i,
);
assert.match(
  PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_GAPS["VERIFY.GATE.state-fixture"],
  new RegExp(`${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.missingStateFixtureCount} do not have a reproducible fixtureId`, "i"),
);

console.log(
  `Product automated source gates passed in isolation: ${registry.internalLinks.length} internal targets resolve; ${new Set(registry.primaryActionIssues.map(({ recordId }) => recordId)).size}/${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.primaryActionCount} primary actions and ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.missingStateFixtureCount}/${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateCount} state fixtures remain open and explicit.`,
);
