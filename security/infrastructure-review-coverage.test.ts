import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { INFRASTRUCTURE_REVIEW_MASTER_EVIDENCE } from "./infrastructure-review-evidence";
import {
  INFRASTRUCTURE_REVIEW_RECORDS,
  INFRASTRUCTURE_REVIEW_STATUSES,
  validateInfrastructureReviewCoverage,
} from "./infrastructure-review-coverage";

assert.equal(INFRASTRUCTURE_REVIEW_RECORDS.length, 23);
assert.deepEqual(validateInfrastructureReviewCoverage(), []);
assert.equal(new Set(INFRASTRUCTURE_REVIEW_RECORDS.map((record) => record.requirementId)).size, 23);
assert.deepEqual(
  Object.keys(INFRASTRUCTURE_REVIEW_MASTER_EVIDENCE).toSorted(),
  INFRASTRUCTURE_REVIEW_RECORDS.map((record) => record.requirementId).toSorted(),
);

for (const record of INFRASTRUCTURE_REVIEW_RECORDS) {
  assert.ok(INFRASTRUCTURE_REVIEW_STATUSES.includes(record.status));
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === record.requirementId,
  );
  assert.ok(requirement, `${record.requirementId}: missing immutable requirement`);
  assert.equal(SECURITY_MASTER_EVIDENCE[record.requirementId]?.status, "verified");
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_MASTER_EVIDENCE[record.requirementId].evidence) {
    assert.ok(existsSync(evidencePath), `${record.requirementId}: missing ${evidencePath}`);
  }
}

console.log("infrastructure review evidence passed: 23 exact reviewed surfaces");
