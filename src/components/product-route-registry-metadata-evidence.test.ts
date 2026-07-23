import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  DEMO_SCREEN_COUNT,
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_CHECKLIST,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_FILE,
  PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_SCOPE,
  PRODUCT_ROUTE_REGISTRY_METADATA_MASTER_EVIDENCE,
  PRODUCT_ROUTE_REGISTRY_METADATA_OPEN_REQUIREMENTS,
  PRODUCT_ROUTE_REGISTRY_METADATA_REQUIREMENT_IDS,
  PRODUCT_ROUTE_REGISTRY_METADATA_TEST_FILE,
} from "./product-route-registry-metadata-evidence";

const repositoryRoot = path.resolve(__dirname, "../..");
const expectedClosedIds = [
  "REG.ROUTE.field-query-parameters",
  "REG.ROUTE.field-primary-actions",
  "REG.ROUTE.field-forms",
  "REG.ROUTE.field-supported-states",
  "REG.ROUTE.field-fixtures",
  "REG.ROUTE.field-feature-flags",
  "REG.ROUTE.field-entry-points",
  "REG.ROUTE.field-tour",
] as const;
const expectedOpenIds = [
  "REG.ROUTE.drives-navigation",
  "REG.ROUTE.drives-onboarding",
  "REG.ROUTE.drives-access",
  "REG.ROUTE.drives-fixtures",
  "REG.ROUTE.field-secondary-actions",
  "REG.ROUTE.field-data-dependencies",
] as const;

assert.deepEqual(
  [...PRODUCT_ROUTE_REGISTRY_METADATA_REQUIREMENT_IDS],
  expectedClosedIds,
);
assert.deepEqual(
  Object.keys(PRODUCT_ROUTE_REGISTRY_METADATA_MASTER_EVIDENCE),
  expectedClosedIds,
);
assert.deepEqual(
  Object.keys(PRODUCT_ROUTE_REGISTRY_METADATA_OPEN_REQUIREMENTS),
  expectedOpenIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);
for (const requirementId of [...expectedClosedIds, ...expectedOpenIds]) {
  assert.ok(productRequirementIds.has(requirementId), requirementId);
}
for (const requirementId of expectedClosedIds) {
  const evidence = PRODUCT_ROUTE_REGISTRY_METADATA_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested");
  for (const evidencePath of evidence.evidence) {
    assert.ok(existsSync(path.join(repositoryRoot, evidencePath)), evidencePath);
  }
}
for (const requirementId of expectedOpenIds) {
  assert.equal(
    PRODUCT_ROUTE_REGISTRY_METADATA_MASTER_EVIDENCE[requirementId],
    undefined,
    `${requirementId} must remain open`,
  );
  assert.ok(PRODUCT_ROUTE_REGISTRY_METADATA_OPEN_REQUIREMENTS[requirementId]);
}

assert.match(PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_SCOPE, /source-static/i);
assert.match(
  PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_SCOPE,
  /does not establish/i,
);
assert.doesNotMatch(
  readFileSync(
    path.join(repositoryRoot, PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_FILE),
    "utf8",
  ),
  /(?:from\s+["']node:|require\(["']node:)/,
);

assert.equal(DEMO_SCREEN_COUNT, 103);
assert.equal(SCREEN_CONTRACTS.length, 103);
assert.equal(new Set(SCREEN_CONTRACTS.map(({ route }) => route)).size, 103);

const metadataFields = [
  "queryParameters",
  "entryPoints",
  "primaryActions",
  "forms",
  "supportedStates",
  "featureFlags",
  "designLabFixtureIds",
] as const;
for (const contract of SCREEN_CONTRACTS) {
  for (const field of metadataFields) {
    const values = contract[field];
    assert.ok(Array.isArray(values), `${contract.route}.${field}`);
    assert.equal(new Set(values).size, values.length, `${contract.route}.${field}`);
    for (const value of values) {
      assert.equal(value, value.trim(), `${contract.route}.${field}`);
      assert.ok(value.length > 0, `${contract.route}.${field}`);
    }
  }
  assert.ok(contract.supportedStates.length > 0, contract.route);
  assert.ok(contract.designLabFixtureIds.length > 0, contract.route);
  assert.ok(contract.entryPoints.length > 0, contract.route);
  assert.ok(
    contract.entryPoints.includes("Design Lab screen explorer"),
    contract.route,
  );
}

const featureFlaggedRoutes = SCREEN_CONTRACTS.filter(
  ({ featureFlags }) => featureFlags.length > 0,
);
assert.deepEqual(
  featureFlaggedRoutes.map(({ route }) => route),
  [
    "/design-lab",
    "/design-lab/demo-experience",
    "/design-lab/dock-skins",
    "/design-lab/role-blueprints",
    "/feed/device-preview",
    "/marketplace/design-lab",
  ],
);
for (const contract of featureFlaggedRoutes) {
  assert.deepEqual(contract.featureFlags, ["ENABLE_DEVICE_PREVIEWS"]);
}

const onboardingExclusions = SCREEN_CONTRACTS.filter(
  ({ onboardingTourId }) => !onboardingTourId,
);
assert.equal(onboardingExclusions.length, 10);
for (const contract of SCREEN_CONTRACTS) {
  if (contract.onboardingTourId) {
    assert.equal(contract.onboardingTourId, contract.onboardingTourId.trim());
    assert.match(contract.onboardingTourId, /^tour:[a-z-]+:v1$/);
    continue;
  }
  assert.equal(contract.coverage.onboarding.status, "excluded", contract.route);
  assert.ok(
    contract.coverage.onboarding.evidence.includes(
      "src/components/screen-contracts/production-screen-onboarding-exclusions.test.ts",
    ),
    contract.route,
  );
}

const checklist = new Map(
  SCREEN_CONTRACT_CHECKLIST.map((item) => [item.area, item] as const),
);
assert.equal(checklist.get("actions")?.completed, 97);
assert.equal(checklist.get("forms")?.completed, 97);
assert.equal(checklist.get("designLab")?.completed, 97);

assert.deepEqual(
  [
    PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_FILE,
    PRODUCT_ROUTE_REGISTRY_METADATA_TEST_FILE,
  ],
  [
    "src/components/product-route-registry-metadata-evidence.ts",
    "src/components/product-route-registry-metadata-evidence.test.ts",
  ],
);

console.log(
  "Route-registry metadata evidence passed: 97 contracts, 8 structural closures, 6 explicit residuals.",
);
