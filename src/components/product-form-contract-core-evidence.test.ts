import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  SCREEN_CONTRACTS,
  type ScreenContract,
} from "./demo-experience-registry";
import {
  PRODUCT_FORM_CONTRACT_CORE_EVIDENCE_FILE,
  PRODUCT_FORM_CONTRACT_CORE_EXPECTED_GAIN,
  PRODUCT_FORM_CONTRACT_CORE_MASTER_EVIDENCE,
  PRODUCT_FORM_CONTRACT_CORE_REQUIREMENT_IDS,
  PRODUCT_FORM_CONTRACT_CORE_SCOPE,
  PRODUCT_FORM_CONTRACT_CORE_TEST_FILE,
} from "./product-form-contract-core-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import {
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  productionScreenCoverage,
} from "./screen-contracts/production-screen-coverage";
import {
  findFormSubmissionSignals,
  getLocalSourceClosure,
} from "./screen-contracts/screen-contract-source-audit";
import type { FamilyScreenManifest } from "./screen-contracts/types";

// screen-evidence-test-id: PRODUCT-FORM-CONTRACT-CORE-EVIDENCE

const EXPECTED_REQUIREMENT_IDS = [
  "FORM.FIELD.id",
  "FORM.FIELD.route",
  "FORM.FIELD.destination",
] as const;

assert.deepEqual(
  PRODUCT_FORM_CONTRACT_CORE_REQUIREMENT_IDS,
  EXPECTED_REQUIREMENT_IDS,
);
assert.equal(PRODUCT_FORM_CONTRACT_CORE_EXPECTED_GAIN, 3);
assert.deepEqual(
  Object.keys(PRODUCT_FORM_CONTRACT_CORE_MASTER_EVIDENCE),
  EXPECTED_REQUIREMENT_IDS,
);

const promptRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of EXPECTED_REQUIREMENT_IDS) {
  assert.equal(promptRequirementIds.has(requirementId), true, requirementId);
  const evidence = PRODUCT_FORM_CONTRACT_CORE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_FORM_CONTRACT_CORE_EVIDENCE_FILE,
    PRODUCT_FORM_CONTRACT_CORE_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) =>
    assert.equal(existsSync(path), true, `${requirementId}: ${path}`),
  );
}

const evidenceSource = readFileSync(
  PRODUCT_FORM_CONTRACT_CORE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_FORM_CONTRACT_CORE_SCOPE, /all 97 registered screens/i);
assert.match(PRODUCT_FORM_CONTRACT_CORE_SCOPE, /146 route-scoped form contracts/i);
assert.match(PRODUCT_FORM_CONTRACT_CORE_SCOPE, /core form inventory metadata/i);
assert.match(PRODUCT_FORM_CONTRACT_CORE_SCOPE, /does not prove complete field-level mapping/i);
assert.match(PRODUCT_FORM_CONTRACT_CORE_SCOPE, /does not prove.*hydrated submission/i);
assert.match(PRODUCT_FORM_CONTRACT_CORE_SCOPE, /production readiness/i);

type Form = FamilyScreenManifest["forms"][number];
type InteractionContract = { forms: readonly Form[] };

const designLabManifestByRoute = new Map(
  DESIGN_LAB_USER_STORY_MANIFESTS.map(
    (manifest) => [manifest.route, manifest] as const,
  ),
);
const productionContracts = PRODUCTION_SCREEN_INTERACTION_CONTRACTS as Readonly<
  Record<string, InteractionContract | undefined>
>;
const productionExclusions = new Set<string>(
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
);
const designLabProductionExclusionOverlap = new Set([
  "/feed/device-preview",
  "/marketplace/design-lab",
]);

assert.equal(SCREEN_CONTRACTS.length, 97);
assert.equal(designLabManifestByRoute.size, 6);
assert.equal(Object.keys(productionContracts).length, 87);
assert.equal(productionExclusions.size, 30);
assert.equal(
  new Set(SCREEN_CONTRACTS.map(({ route }) => route)).size,
  SCREEN_CONTRACTS.length,
);

const routeFormPairs = new Set<string>();
let formCount = 0;
let excludedScreenCount = 0;

function verifyForm(route: string, form: Form) {
  assertNonEmpty(form.id, `${route} form id`);
  assertNonEmpty(form.submitsTo, `${route}/${form.id} submission destination`);
  assertNonEmpty(form.schema ?? "", `${route}/${form.id} validation schema`);
  assert.ok(form.testIds.length > 0, `${route}/${form.id} test references`);
  form.testIds.forEach((testId) =>
    assertNonEmpty(testId, `${route}/${form.id} test id`),
  );

  const routeFormPair = `${route}::${form.id}`;
  assert.equal(
    routeFormPairs.has(routeFormPair),
    false,
    `${routeFormPair} is duplicated`,
  );
  routeFormPairs.add(routeFormPair);
  formCount += 1;
}

for (const screen of SCREEN_CONTRACTS) verifyScreen(screen);

assert.equal(formCount, 146);
assert.equal(routeFormPairs.size, 146);
assert.equal(excludedScreenCount, 34);

console.log(
  "Product form core evidence passed in isolation: 97 screens map to 146 route-scoped forms or 34 explicit zero-form exclusions; exact +3 central wiring is ready.",
);

function verifyScreen(screen: ScreenContract) {
  const designLabManifest = designLabManifestByRoute.get(screen.route);
  const productionContract = productionContracts[screen.route];
  const formSignals = [...getLocalSourceClosure(screen.sourceFiles[0])].flatMap(
    findFormSubmissionSignals,
  );

  if (designLabManifest) {
    assert.equal(productionContract, undefined, screen.route);
    assert.equal(
      productionExclusions.has(screen.route),
      designLabProductionExclusionOverlap.has(screen.route),
      screen.route,
    );
    assert.deepEqual(designLabManifest.forms, [], screen.route);
    assert.deepEqual(screen.forms, [], screen.route);
    assert.deepEqual(formSignals, [], screen.route);
    assert.equal(screen.coverage.forms.status, "excluded", screen.route);
    assert.equal(
      designLabManifest.coverage.forms.status === "excluded"
        ? designLabManifest.coverage.forms.exclusion.owner
        : undefined,
      "Design Lab screen-contract owner",
      screen.route,
    );
    excludedScreenCount += 1;
    return;
  }

  const sourceClaim = productionScreenCoverage({
    screenId: screen.id,
    route: screen.route,
    concreteRoute: screen.concreteRoute,
    sourcePath: screen.sourceFiles[0],
    routeAuditPassed: false,
  }).forms;

  if (productionExclusions.has(screen.route)) {
    assert.deepEqual(productionContract?.forms ?? [], [], screen.route);
    assert.deepEqual(screen.forms, [], screen.route);
    assert.deepEqual(formSignals, [], screen.route);
    assert.equal(screen.coverage.forms.status, "excluded", screen.route);
    assert.equal(sourceClaim?.status, "excluded", screen.route);
    if (sourceClaim?.status === "excluded") {
      assert.equal(sourceClaim.exclusion.owner, "Product Engineering");
      assert.match(
        sourceClaim.exclusion.rationale,
        /no form submission primitive/i,
      );
    }
    excludedScreenCount += 1;
    return;
  }

  assert.ok(productionContract, `${screen.route}: missing form contract`);
  assert.ok(formSignals.length > 0, `${screen.route}: no source form signal`);
  assert.ok(productionContract.forms.length > 0, screen.route);
  assert.equal(screen.coverage.forms.status, "verified", screen.route);
  assert.equal(sourceClaim?.status, "verified", screen.route);
  assert.deepEqual(
    screen.forms,
    productionContract.forms.map(({ id, submitsTo }) => `${id} -> ${submitsTo}`),
    screen.route,
  );
  productionContract.forms.forEach((form) => verifyForm(screen.route, form));
}

function assertNonEmpty(value: string, label: string) {
  assert.ok(value.trim().length > 0, `${label} must be non-empty`);
}
