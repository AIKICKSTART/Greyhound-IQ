import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES,
  DESIGN_LAB_SYSTEM_STATE_PRESENTATIONS,
} from "./design-lab-scenario-contract";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_SYSTEM_STATE_COVERAGE_EVIDENCE_FILE,
  PRODUCT_SYSTEM_STATE_COVERAGE_MASTER_EVIDENCE,
  PRODUCT_SYSTEM_STATE_COVERAGE_REQUIREMENT_IDS,
  PRODUCT_SYSTEM_STATE_COVERAGE_SCOPE,
  PRODUCT_SYSTEM_STATE_COVERAGE_TEST_FILE,
} from "./product-system-state-coverage-evidence";

const EXPECTED_SYSTEM_STATE_IDS = [
  "SYSTEM.not-found",
  "SYSTEM.forbidden",
  "SYSTEM.auth-required",
  "SYSTEM.subscription-required",
  "SYSTEM.feature-unavailable",
  "SYSTEM.private",
  "SYSTEM.blocked",
  "SYSTEM.deleted",
  "SYSTEM.invitation-expired",
  "SYSTEM.invitation-invalid",
  "SYSTEM.maintenance",
  "SYSTEM.offline",
  "SYSTEM.recoverable-error",
  "SYSTEM.unsupported-browser",
  "SYSTEM.auth-callback-loading",
  "SYSTEM.auth-callback-failure",
  "SYSTEM.billing-loading",
  "SYSTEM.billing-failure",
  "SYSTEM.upload-failure",
  "SYSTEM.rate-limit",
] as const;

assert.deepEqual(PRODUCT_SYSTEM_STATE_COVERAGE_REQUIREMENT_IDS, [
  "SYSTEM.design-lab",
  "SYSTEM.automated-tests",
]);
assert.deepEqual(
  Object.keys(PRODUCT_SYSTEM_STATE_COVERAGE_MASTER_EVIDENCE),
  PRODUCT_SYSTEM_STATE_COVERAGE_REQUIREMENT_IDS,
);
assert.match(PRODUCT_SYSTEM_STATE_COVERAGE_SCOPE, /source-static/i);
assert.match(PRODUCT_SYSTEM_STATE_COVERAGE_SCOPE, /does not prove browser rendering/i);

const masterIds = new Set(PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id));
for (const requirementId of [
  ...EXPECTED_SYSTEM_STATE_IDS,
  ...PRODUCT_SYSTEM_STATE_COVERAGE_REQUIREMENT_IDS,
]) {
  assert.ok(masterIds.has(requirementId), requirementId);
}

assert.deepEqual(
  DESIGN_LAB_SYSTEM_STATE_PRESENTATIONS.map(
    ({ requirementId }) => requirementId,
  ),
  EXPECTED_SYSTEM_STATE_IDS,
);
assert.equal(
  new Set(DESIGN_LAB_SYSTEM_STATE_PRESENTATIONS.map(({ state }) => state)).size,
  EXPECTED_SYSTEM_STATE_IDS.length,
  "Each system state needs a distinct synthetic presentation rather than a generic fallback.",
);
for (const presentation of DESIGN_LAB_SYSTEM_STATE_PRESENTATIONS) {
  assert.ok(
    DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES.includes(presentation.state),
    presentation.requirementId,
  );
  assert.ok(presentation.recovery.length >= 20, presentation.requirementId);
}

for (const requirementId of PRODUCT_SYSTEM_STATE_COVERAGE_REQUIREMENT_IDS) {
  const record = PRODUCT_SYSTEM_STATE_COVERAGE_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_SYSTEM_STATE_COVERAGE_EVIDENCE_FILE,
    PRODUCT_SYSTEM_STATE_COVERAGE_TEST_FILE,
  ]);
  for (const evidencePath of record.evidence) {
    assert.ok(existsSync(evidencePath), evidencePath);
  }
}

const controls = readFileSync(
  "src/components/design-lab-scenario-controls.tsx",
  "utf8",
);
assert.match(controls, /Next step: \{errorState\.recovery\}/);
assert.match(controls, /Reconnect, then refresh live information\./);

console.log(
  "Product system-state coverage passed: 20 distinct synthetic states, their recovery directions, and two source-static closure records.",
);
