import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCT_ACTION_INVENTORY_SUMMARY,
} from "./product-action-inventory-evidence";
import {
  SCREEN_CONTRACTS,
  type ScreenContract,
} from "./demo-experience-registry";
import {
  PRODUCT_ACTION_PURPOSE_EVIDENCE_FILE,
  PRODUCT_ACTION_PURPOSE_EXPECTED_GAIN,
  PRODUCT_ACTION_PURPOSE_MASTER_EVIDENCE,
  PRODUCT_ACTION_PURPOSE_OPEN_GAP,
  PRODUCT_ACTION_PURPOSE_REQUIREMENT_IDS,
  PRODUCT_ACTION_PURPOSE_SCOPE,
  PRODUCT_ACTION_PURPOSE_TEST_FILE,
} from "./product-action-purpose-evidence";
import {
  buildProductAutomatedSourceGateRegistry,
  findInteractiveControlIssues,
  type ProductInteractiveControlRecord,
} from "./product-automated-source-gate-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  productionScreenCoverage,
} from "./screen-contracts/production-screen-coverage";
import type { FamilyScreenManifest } from "./screen-contracts/types";

// screen-evidence-test-id: PRODUCT-ACTION-PURPOSE-EVIDENCE

assert.deepEqual(PRODUCT_ACTION_PURPOSE_REQUIREMENT_IDS, [
  "ACTION.BEHAVIOUR.purpose",
]);
assert.equal(PRODUCT_ACTION_PURPOSE_EXPECTED_GAIN, 0);
assert.deepEqual(Object.keys(PRODUCT_ACTION_PURPOSE_MASTER_EVIDENCE), [
  "ACTION.BEHAVIOUR.purpose",
]);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === "ACTION.BEHAVIOUR.purpose",
);
assert.ok(requirement);
assert.equal(
  requirement.requirement,
  "Every interactive control has a clear purpose.",
);

const evidence =
  PRODUCT_ACTION_PURPOSE_MASTER_EVIDENCE["ACTION.BEHAVIOUR.purpose"];
assert.equal(evidence.status, "blocked");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ACTION_PURPOSE_EVIDENCE_FILE,
  PRODUCT_ACTION_PURPOSE_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) =>
  assert.equal(existsSync(path), true, path),
);

const evidenceSource = readFileSync(
  PRODUCT_ACTION_PURPOSE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(
  PRODUCT_ACTION_PURPOSE_SCOPE,
  new RegExp(`all ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} registered screens`, "i"),
);
assert.match(
  PRODUCT_ACTION_PURPOSE_SCOPE,
  new RegExp(`${PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount} declared actions`, "i"),
);
assert.match(PRODUCT_ACTION_PURPOSE_SCOPE, /every discoverable interactive JSX control/i);
assert.match(PRODUCT_ACTION_PURPOSE_SCOPE, /every unmatched control remains an explicit fail-closed gap/i);
assert.match(PRODUCT_ACTION_PURPOSE_SCOPE, /documented purpose only/i);
assert.match(PRODUCT_ACTION_PURPOSE_SCOPE, /does not prove hydrated execution/i);
assert.match(PRODUCT_ACTION_PURPOSE_SCOPE, /successful real result/i);
assert.match(PRODUCT_ACTION_PURPOSE_SCOPE, /production readiness/i);

type Action = FamilyScreenManifest["actions"][number];
type InteractionContract = {
  actions: readonly Action[];
  forms: FamilyScreenManifest["forms"];
};

const designLabManifestByRoute = new Map(
  DESIGN_LAB_USER_STORY_MANIFESTS.map(
    (manifest) => [manifest.route, manifest] as const,
  ),
);
const productionContracts = PRODUCTION_SCREEN_INTERACTION_CONTRACTS as Readonly<
  Record<string, InteractionContract | undefined>
>;
const productionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);

assert.equal(SCREEN_CONTRACTS.length, PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount);
assert.equal(
  designLabManifestByRoute.size,
  PRODUCT_ACTION_INVENTORY_SUMMARY.designLabManifestCount,
);
assert.equal(
  Object.keys(productionContracts).length,
  PRODUCT_ACTION_INVENTORY_SUMMARY.productionContractCount,
);
assert.equal(
  productionExclusions.size,
  PRODUCT_ACTION_INVENTORY_SUMMARY.exclusionCount,
);

const routeActionPairs = new Set<string>();
let actionCount = 0;
let excludedScreenCount = 0;

for (const screen of SCREEN_CONTRACTS) verifyScreen(screen);

assert.equal(actionCount, PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount);
assert.equal(routeActionPairs.size, PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount);
assert.equal(
  excludedScreenCount,
  PRODUCT_ACTION_INVENTORY_SUMMARY.exclusionCount,
);

const sourceGateRegistry = buildProductAutomatedSourceGateRegistry();
assert.ok(
  sourceGateRegistry.interactiveControls.length > SCREEN_CONTRACTS.length,
  "the control inventory must enumerate controls, not merely one signal per screen",
);
assert.equal(
  new Set(sourceGateRegistry.interactiveControls.map(({ id }) => id)).size,
  sourceGateRegistry.interactiveControls.length,
  "each source control must be inventoried once by source location",
);
const expectedUnmatchedControlIds = sourceGateRegistry.interactiveControls
  .filter(({ purposeContractIds }) => purposeContractIds.length === 0)
  .map(({ id }) => id)
  .toSorted();
assert.deepEqual(
  sourceGateRegistry.interactiveControlIssues.map(({ recordId }) => recordId),
  expectedUnmatchedControlIds,
  "every unmatched control must remain an explicit issue",
);
assert.ok(
  sourceGateRegistry.interactiveControlIssues.length > 0,
  "ACTION.BEHAVIOUR.purpose must stay blocked while controls lack contracts",
);

const purposeIdsByRoute = new Map<string, Set<string>>();
for (const screen of SCREEN_CONTRACTS) {
  const manifest = designLabManifestByRoute.get(screen.route);
  const contract = manifest ?? productionContracts[screen.route];
  purposeIdsByRoute.set(
    screen.route,
    new Set([
      ...(contract?.actions.map(({ id }) => id) ?? []),
      ...(contract?.forms.map(({ id }) => id) ?? []),
    ]),
  );
}
for (const control of sourceGateRegistry.interactiveControls) {
  assert.equal(existsSync(control.sourceFile), true, control.id);
  assert.ok(control.sourceLine > 0, control.id);
  assert.ok(control.sourceColumn > 0, control.id);
  assert.ok(control.ownerRoutes.length > 0, control.id);
  for (const contractId of control.purposeContractIds) {
    assert.ok(
      control.ownerRoutes.some((route) =>
        purposeIdsByRoute.get(route)?.has(contractId),
      ),
      `${control.id}: ${contractId} is not owned by any control route`,
    );
  }
}

const accountTeamControls = sourceGateRegistry.interactiveControls.filter(
  ({ ownerRoutes }) => ownerRoutes.includes("/account/team"),
);
assert.ok(
  accountTeamControls.some(({ purposeContractIds }) =>
    purposeContractIds.includes("ACCOUNT-TEAM.FORM.LEAVE"),
  ),
  "the leave-team form control must be reconciled as a form purpose",
);
assert.ok(
  accountTeamControls.some(
    ({ sourceFile, purposeContractIds }) =>
      sourceFile.endsWith("/team-invite-form.tsx") &&
      purposeContractIds.length === 0,
  ),
  "unbound team invitation controls must not be hidden by another screen action",
);
const missingControlFixture: ProductInteractiveControlRecord = {
  id: "src/app/negative/page.tsx:1:1:button",
  sourceFile: "src/app/negative/page.tsx",
  sourceLine: 1,
  sourceColumn: 1,
  ownerRoutes: ["/negative"],
  tagName: "button",
  purposeContractIds: [],
  bindingEvidence: [],
};
assert.deepEqual(findInteractiveControlIssues([missingControlFixture]), [
  {
    code: "INTERACTIVE_CONTROL_PURPOSE_MISSING",
    recordId: missingControlFixture.id,
    sourceFile: missingControlFixture.sourceFile,
    sourceLine: 1,
    ownerRoutes: ["/negative"],
  },
]);
assert.match(PRODUCT_ACTION_PURPOSE_OPEN_GAP, /every unmatched interactive source control/i);
assert.match(PRODUCT_ACTION_PURPOSE_OPEN_GAP, /stays blocked/i);

console.log(
  `Action-purpose evaluator passed in isolation: ${sourceGateRegistry.interactiveControls.length} source controls reconciled and ${sourceGateRegistry.interactiveControlIssues.length} unmatched controls remain explicitly blocked across ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} screens.`,
);

function verifyScreen(screen: ScreenContract) {
  const designLabManifest = designLabManifestByRoute.get(screen.route);
  const productionContract = productionContracts[screen.route];

  if (designLabManifest) {
    assert.equal(productionContract, undefined, screen.route);
    assert.equal(productionExclusions.has(screen.route), false, screen.route);
    assert.ok(designLabManifest.actions.length > 0, screen.route);
    assert.equal(screen.coverage.actions.status, "tested", screen.route);
    assert.deepEqual(
      screen.primaryActions,
      designLabManifest.actions.map(({ id }) => id),
      screen.route,
    );
    designLabManifest.actions.forEach((action) =>
      verifyAction(screen.route, action),
    );
    return;
  }

  const sourceClaim = productionScreenCoverage({
    screenId: screen.id,
    route: screen.route,
    concreteRoute: screen.concreteRoute,
    sourcePath: screen.sourceFiles[0],
    routeAuditPassed: false,
  }).actions;

  if (productionExclusions.has(screen.route)) {
    assert.equal(productionContract, undefined, screen.route);
    assert.deepEqual(screen.primaryActions, [], screen.route);
    assert.equal(screen.coverage.actions.status, "excluded", screen.route);
    assert.equal(sourceClaim?.status, "excluded", screen.route);
    excludedScreenCount += 1;
    return;
  }

  assert.ok(productionContract, `${screen.route}: missing action contract`);
  assert.ok(productionContract.actions.length > 0, screen.route);
  assert.equal(screen.coverage.actions.status, "verified", screen.route);
  assert.equal(sourceClaim?.status, "verified", screen.route);
  assert.deepEqual(
    screen.primaryActions,
    productionContract.actions.map(({ id }) => id),
    screen.route,
  );
  productionContract.actions.forEach((action) =>
    verifyAction(screen.route, action),
  );
}

function verifyAction(route: string, action: Action) {
  assertNonEmpty(action.id, `${route} action id`);
  assert.ok(
    action.result.trim().length >= 20,
    `${route}/${action.id}: outcome is too vague`,
  );
  assert.doesNotMatch(
    action.result,
    /\b(?:todo|coming soon|add later|mock this|handle errors)\b/i,
    `${route}/${action.id}: placeholder outcome`,
  );
  assertNonEmpty(action.enforcement ?? "", `${route}/${action.id} enforcement`);
  assert.ok(action.testIds.length > 0, `${route}/${action.id} test references`);
  action.testIds.forEach((testId) =>
    assertNonEmpty(testId, `${route}/${action.id} test id`),
  );

  const routeActionPair = `${route}::${action.id}`;
  assert.equal(
    routeActionPairs.has(routeActionPair),
    false,
    `${routeActionPair} is duplicated`,
  );
  routeActionPairs.add(routeActionPair);
  actionCount += 1;
}

function assertNonEmpty(value: string, label: string) {
  assert.ok(value.trim().length > 0, `${label} must be non-empty`);
}
