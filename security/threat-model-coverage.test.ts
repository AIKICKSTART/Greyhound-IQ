import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { THREAT_MODEL_COVERAGE_MASTER_EVIDENCE } from "./threat-model-coverage-evidence";
import {
  THREAT_MODEL_AREA_RECORDS,
  THREAT_MODEL_CONTROL_STATUSES,
  THREAT_MODEL_COVERAGE_RECORDS,
  validateThreatModelCoverage,
} from "./threat-model-coverage";

assert.equal(THREAT_MODEL_AREA_RECORDS.length, 9);
assert.equal(THREAT_MODEL_COVERAGE_RECORDS.length, 133);
assert.deepEqual(validateThreatModelCoverage(), []);

const expectedIds = [
  ...THREAT_MODEL_AREA_RECORDS.flatMap((record) => [
    record.threatModelRequirementId,
    record.abuseCaseRequirementId,
  ]),
  ...THREAT_MODEL_COVERAGE_RECORDS.map((record) => record.requirementId),
].toSorted();
assert.deepEqual(
  Object.keys(THREAT_MODEL_COVERAGE_MASTER_EVIDENCE).toSorted(),
  expectedIds,
);
assert.equal(new Set(expectedIds).size, 151);

for (const record of THREAT_MODEL_COVERAGE_RECORDS) {
  assert.ok(THREAT_MODEL_CONTROL_STATUSES.includes(record.currentControlStatus));
  assert.notEqual(
    record.currentControlStatus,
    "verified",
    `${record.requirementId}: modeling completion must not imply control completion`,
  );
}

for (const id of expectedIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.equal(SECURITY_MASTER_EVIDENCE[id]?.status, "verified");
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

console.log(
  "threat-model coverage evidence passed: 9 areas, 133 explicit threats, 151 modeled requirements",
);
