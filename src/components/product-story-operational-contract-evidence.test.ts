import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_STORY_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
  PRODUCT_STORY_OPERATIONAL_CONTRACT_EXPECTED_GAIN,
  PRODUCT_STORY_OPERATIONAL_CONTRACT_MASTER_EVIDENCE,
  PRODUCT_STORY_OPERATIONAL_CONTRACT_REQUIREMENT_IDS,
  PRODUCT_STORY_OPERATIONAL_CONTRACT_SCOPE,
  PRODUCT_STORY_OPERATIONAL_CONTRACT_TEST_FILE,
} from "./product-story-operational-contract-evidence";
import { buildProductStoryOperationalContractRegistry } from "./product-story-operational-contract-registry";
import { PRODUCT_STORY_CONTRACT_FIELD_REQUIREMENT_IDS } from "./product-story-contract-field-evidence";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";

// screen-evidence-test-id: PRODUCT-STORY-OPERATIONAL-CONTRACT-EVIDENCE

const EXPECTED_REQUIREMENT_IDS = [
  "STORY.FIELD.goal",
  "STORY.FIELD.alternative-paths",
  "STORY.FIELD.failure-paths",
  "STORY.FIELD.blocked-private-paths",
  "STORY.FIELD.fields",
  "STORY.FIELD.validation",
  "STORY.FIELD.loading",
  "STORY.FIELD.empty",
  "STORY.FIELD.success",
  "STORY.FIELD.recoverable-error",
  "STORY.FIELD.analytics-audit",
  "STORY.FIELD.onboarding",
  "STORY.FIELD.accessibility",
  "STORY.FIELD.mobile",
] as const;

assert.deepEqual(
  PRODUCT_STORY_OPERATIONAL_CONTRACT_REQUIREMENT_IDS,
  EXPECTED_REQUIREMENT_IDS,
);
assert.equal(PRODUCT_STORY_OPERATIONAL_CONTRACT_EXPECTED_GAIN, 14);
assert.deepEqual(
  Object.keys(PRODUCT_STORY_OPERATIONAL_CONTRACT_MASTER_EVIDENCE),
  EXPECTED_REQUIREMENT_IDS,
);

const promptStoryIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ section }) => section === "stories.contract",
).map(({ id }) => id);
assert.equal(promptStoryIds.length, 28);
assert.deepEqual(
  [
    ...PRODUCT_STORY_CONTRACT_FIELD_REQUIREMENT_IDS,
    ...EXPECTED_REQUIREMENT_IDS,
  ].toSorted(),
  promptStoryIds.toSorted(),
  "Core and operational story batches must partition stories.contract",
);

for (const [requirementId, evidence] of Object.entries(
  PRODUCT_STORY_OPERATIONAL_CONTRACT_MASTER_EVIDENCE,
)) {
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_STORY_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
    PRODUCT_STORY_OPERATIONAL_CONTRACT_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(evidencePath), true, `${requirementId}: ${evidencePath}`),
  );
}

const clientSafeEvidenceSource = readFileSync(
  PRODUCT_STORY_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(clientSafeEvidenceSource, /from ["']node:/);
assert.doesNotMatch(clientSafeEvidenceSource, /readFileSync/);
assert.doesNotMatch(clientSafeEvidenceSource, /process\.cwd/);

const registry = buildProductStoryOperationalContractRegistry();
const expectedRecordIds = [
  ...DEMO_SCREEN_FAMILIES.filter(({ key }) => key !== "design-lab").flatMap(
    (family) =>
      family.screens.map((screen) => {
        assert.ok(screen.userStory, `${screen.route}: inline story`);
        return `${screen.route}::${screen.userStory.id}`;
      }),
  ),
  ...DESIGN_LAB_USER_STORY_MANIFESTS.flatMap((manifest) =>
    manifest.userStories.map((story) => `${manifest.route}::${story.id}`),
  ),
].toSorted((left, right) => left.localeCompare(right));

assert.equal(SCREEN_CONTRACTS.length, 97);
assert.equal(DEMO_SCREEN_FAMILIES.flatMap(({ screens }) => screens).length, 97);
assert.equal(registry.records.length, 97);
assert.equal(registry.auditedRoutes.length, 97);
assert.ok(registry.auditedSourceFiles.length >= 400);
assert.deepEqual(registry.discoveredRecordIds, expectedRecordIds);
assert.deepEqual(
  registry.records.map(({ id }) => id),
  expectedRecordIds,
  "Every canonical route story must have exactly one operational record",
);
assert.equal(new Set(expectedRecordIds).size, expectedRecordIds.length);

let storyFieldCount = 0;
let validationRuleCount = 0;
let sourceSignalCount = 0;
let declaredTourCount = 0;
let undeclaredTourCount = 0;

for (const record of registry.records) {
  assert.ok(registry.auditedRoutes.includes(record.route), record.id);
  assertNonEmpty(record.storyId, `${record.id}: storyId`);
  assertNonEmpty(record.goal, `${record.id}: goal`);
  assert.ok(record.alternativePaths.length > 0, `${record.id}: alternatives`);
  record.alternativePaths.forEach((path) =>
    assertNonEmpty(path, `${record.id}: alternative`),
  );
  assertNonEmpty(record.failurePaths.expectation, `${record.id}: failure`);
  assert.ok(
    ["optional", "public", "required"].includes(
      record.blockedPrivatePaths.authentication,
    ),
    record.id,
  );
  assert.equal(record.validation.length, record.fields.length, record.id);
  storyFieldCount += record.fields.length;
  for (const field of record.fields) {
    assert.ok(field.sourceLine > 0, field.id);
    assert.ok(field.sourceColumn > 0, field.id);
    assert.equal(existsSync(field.sourceFile), true, field.id);
  }
  for (const validation of record.validation) {
    validationRuleCount += validation.rules.length;
    assert.ok(record.fields.some(({ id }) => id === validation.fieldId), record.id);
  }
  assertNonEmpty(record.loading.expectation, `${record.id}: loading`);
  assertNonEmpty(record.empty.expectation, `${record.id}: empty`);
  assert.ok(record.success.feedback.length > 0, `${record.id}: success`);
  record.success.feedback.forEach((feedback) =>
    assertNonEmpty(feedback, `${record.id}: feedback`),
  );
  assertNonEmpty(
    record.recoverableError.expectation,
    `${record.id}: recoverable error`,
  );
  sourceSignalCount += record.analyticsAudit.length;
  record.analyticsAudit.forEach((signal) => {
    assert.ok(["analytics", "audit"].includes(signal.kind), record.id);
    assert.ok(signal.sourceLine > 0, record.id);
    assertNonEmpty(signal.sourceText, `${record.id}: source signal`);
    assert.ok(record.sourceFiles.includes(signal.sourceFile), record.id);
  });
  assert.ok(record.accessibility.length > 0, `${record.id}: accessibility`);
  assert.ok(record.mobile.length > 0, `${record.id}: mobile`);
  assert.ok(record.sourceFiles.length > 0, `${record.id}: source files`);

  if (record.onboarding.recordedState === "route-tour-declared") {
    declaredTourCount += 1;
    assertNonEmpty(record.onboarding.tourId ?? "", `${record.id}: tour`);
  } else {
    undeclaredTourCount += 1;
    assert.equal(record.onboarding.tourId, null, record.id);
  }
}

assert.ok(storyFieldCount >= 1_800);
assert.ok(validationRuleCount > 0);
assert.ok(sourceSignalCount > 0);
assert.equal(declaredTourCount, 87);
assert.equal(undeclaredTourCount, 10);

assert.match(PRODUCT_STORY_OPERATIONAL_CONTRACT_SCOPE, /all 97 canonical route stories/i);
assert.match(PRODUCT_STORY_OPERATIONAL_CONTRACT_SCOPE, /explicit recorded gaps/i);
assert.match(PRODUCT_STORY_OPERATIONAL_CONTRACT_SCOPE, /does not prove server validation/i);
assert.match(PRODUCT_STORY_OPERATIONAL_CONTRACT_SCOPE, /does not prove.*object-level authorisation/i);
assert.match(PRODUCT_STORY_OPERATIONAL_CONTRACT_SCOPE, /production readiness/i);

console.log(
  `Product story operational contract evidence passed: exact ${registry.records.length}-story register closes the remaining 14/28 record requirements; ${undeclaredTourCount} tour gaps remain explicitly visible.`,
);

function assertNonEmpty(value: string, label: string) {
  assert.ok(value.trim().length > 0, label);
}
