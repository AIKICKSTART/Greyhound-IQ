import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_ACTION_INVENTORY_EVIDENCE_FILE,
  PRODUCT_ACTION_INVENTORY_EXPECTED_GAIN,
  PRODUCT_ACTION_INVENTORY_MASTER_EVIDENCE,
  PRODUCT_ACTION_INVENTORY_REQUIREMENT_IDS,
  PRODUCT_ACTION_INVENTORY_SCOPE,
  PRODUCT_ACTION_INVENTORY_SUMMARY,
  PRODUCT_ACTION_INVENTORY_TEST_FILE,
} from "./product-action-inventory-evidence";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  productionScreenCoverage,
} from "./screen-contracts/production-screen-coverage";
import {
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contracts/screen-contract-source-audit";
import type { FamilyScreenManifest } from "./screen-contracts/types";

const completedIds = [...PRODUCT_ACTION_INVENTORY_REQUIREMENT_IDS];

assert.deepEqual(completedIds, [
  "OUT.action-inventory",
  "COMPLETE.EVIDENCE.actions-mapped",
]);
assert.equal(PRODUCT_ACTION_INVENTORY_EXPECTED_GAIN, 2);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_ACTION_INVENTORY_MASTER_EVIDENCE),
  completedIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const evidence = PRODUCT_ACTION_INVENTORY_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_ACTION_INVENTORY_EVIDENCE_FILE,
    PRODUCT_ACTION_INVENTORY_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  assert.equal(
    evidence.evidence.some((evidencePath) => evidencePath.startsWith("output/")),
    false,
    `${requirementId} must not depend on mutable browser output`,
  );
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], evidence);
}

const evidenceSource = readFileSync(PRODUCT_ACTION_INVENTORY_EVIDENCE_FILE, "utf8");
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(
  PRODUCT_ACTION_INVENTORY_SCOPE,
  new RegExp(`all ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} registered screens`, "i"),
);
assert.match(
  PRODUCT_ACTION_INVENTORY_SCOPE,
  new RegExp(`${PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount} route-scoped action entries`, "i"),
);
assert.match(PRODUCT_ACTION_INVENTORY_SCOPE, /inventory and source mapping only/i);
assert.match(PRODUCT_ACTION_INVENTORY_SCOPE, /does not prove hydrated execution/i);
assert.match(PRODUCT_ACTION_INVENTORY_SCOPE, /current browser-audit freshness/i);
assert.match(PRODUCT_ACTION_INVENTORY_SCOPE, /server authorization/i);
assert.match(PRODUCT_ACTION_INVENTORY_SCOPE, /production readiness/i);

type Action = FamilyScreenManifest["actions"][number];
type InteractionContract = {
  actions: readonly Action[];
};

const designLabManifestByRoute = new Map(
  DESIGN_LAB_USER_STORY_MANIFESTS.map((manifest) => [manifest.route, manifest] as const),
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
assert.equal(
  SCREEN_CONTRACTS.length,
  designLabManifestByRoute.size +
    Object.keys(productionContracts).length +
    productionExclusions.size,
  "Every registered screen must be a production contract, tested exclusion, or Design Lab manifest",
);

const routeActionPairs = new Set<string>();
let actionCount = 0;

function verifyAction(route: string, action: Action) {
  assert.ok(action.id.trim(), route);
  assert.ok(action.result.trim(), `${route}/${action.id}`);
  assert.ok(action.enforcement?.trim(), `${route}/${action.id}`);
  assert.ok(action.testIds.length > 0, `${route}/${action.id}`);
  assert.ok(
    action.testIds.every((testId) => testId.trim().length > 0),
    `${route}/${action.id}`,
  );
  const pair = `${route}::${action.id}`;
  assert.equal(routeActionPairs.has(pair), false, `${pair} is duplicated`);
  routeActionPairs.add(pair);
  actionCount += 1;
}

for (const screen of SCREEN_CONTRACTS) {
  const designLabManifest = designLabManifestByRoute.get(screen.route);
  const productionContract = productionContracts[screen.route];
  const actionSignals = [...getLocalSourceClosure(screen.sourceFiles[0])]
    .flatMap(findUserActionSignals);

  if (designLabManifest) {
    assert.equal(productionContract, undefined, screen.route);
    assert.equal(productionExclusions.has(screen.route), false, screen.route);
    assert.ok(
      ["verified", "tested"].includes(screen.coverage.actions.status),
      screen.route,
    );
    assert.ok(actionSignals.length > 0, `${screen.route}: no source action signal`);
    assert.ok(designLabManifest.actions.length > 0, screen.route);
    const manifestTestIds = new Set(
      designLabManifest.tests.map(({ id }) => id),
    );
    assert.deepEqual(
      screen.primaryActions,
      designLabManifest.actions.map(({ id }) => id),
      screen.route,
    );
    for (const action of designLabManifest.actions) {
      verifyAction(screen.route, action);
      assert.ok(
        action.testIds.every((testId) => manifestTestIds.has(testId)),
        `${screen.route}/${action.id}: unknown manifest test reference`,
      );
    }
    continue;
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
    assert.deepEqual(actionSignals, [], screen.route);
    assert.deepEqual(screen.primaryActions, [], screen.route);
    assert.equal(screen.coverage.actions.status, "excluded", screen.route);
    assert.equal(sourceClaim?.status, "excluded", screen.route);
    if (sourceClaim?.status === "excluded") {
      assert.equal(sourceClaim.exclusion.owner, "Product Engineering");
      assert.match(sourceClaim.exclusion.rationale, /no page-owned user-action primitive/i);
    }
    continue;
  }

  assert.ok(productionContract, `${screen.route}: missing action contract`);
  assert.ok(actionSignals.length > 0, `${screen.route}: no source action signal`);
  assert.equal(screen.coverage.actions.status, "verified", screen.route);
  assert.equal(sourceClaim?.status, "verified", screen.route);
  assert.ok(productionContract.actions.length > 0, screen.route);
  assert.deepEqual(
    screen.primaryActions,
    productionContract.actions.map(({ id }) => id),
    screen.route,
  );
  for (const action of productionContract.actions) {
    verifyAction(screen.route, action);
  }
}

assert.equal(actionCount, PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount);
assert.equal(routeActionPairs.size, PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount);

const actionDocument = readFileSync("docs/product/action-inventory.md", "utf8");
assert.ok(
  actionDocument.includes(
    `Status: ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount}/${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} screen action cells contract-complete; runtime journeys incomplete`,
  ),
);
assert.ok(
  actionDocument.includes(
    `${PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount} route-scoped action entries`,
  ),
);
assert.ok(
  actionDocument.includes(
    `${PRODUCT_ACTION_INVENTORY_SUMMARY.productionContractCount} production action contracts`,
  ),
);
assert.match(actionDocument, /four tested zero-action exclusions/i);
assert.match(actionDocument, /six source-mapped Design Lab manifests/i);
assert.ok(
  actionDocument.includes(
    `Complete | ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount}`,
  ),
);
assert.match(actionDocument, /Captured only \| 0/);
assert.match(actionDocument, /ACTION-01 \| Gap/);
assert.match(actionDocument, /does not prove hydrated pending, success, failure or denial behavior/i);

const missingActionReport = readFileSync(
  "docs/product/missing-action-report.md",
  "utf8",
);
assert.match(missingActionReport, /Status: inventory complete; behavior verification open/);
assert.match(
  missingActionReport,
  new RegExp(`all ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} registered screen cells`, "i"),
);
assert.match(missingActionReport, /per-action ownership, permission, validation, loading, success, failure, idempotency and audit evidence remains incomplete/i);

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_ACTION_INVENTORY_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly two completed requirements",
);

console.log(
  `Product action-inventory evidence passed: ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} screen cells, ${PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount} route-scoped entries, ${PRODUCT_ACTION_INVENTORY_SUMMARY.productionContractCount} production contracts, ${PRODUCT_ACTION_INVENTORY_SUMMARY.exclusionCount} exclusions and ${PRODUCT_ACTION_INVENTORY_SUMMARY.designLabManifestCount} Design Lab manifests; 2 gates closed.`,
);
