import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { AUTHENTICATION_PATH_MASTER_EVIDENCE } from "./authentication-path-evidence";
import {
  AUTHENTICATION_PATH_REVIEW_RECORDS,
  AUTHENTICATION_PATH_REVIEW_STATUSES,
  validateAuthenticationPathReview,
} from "./authentication-path-review";

assert.equal(AUTHENTICATION_PATH_REVIEW_RECORDS.length, 21);
assert.deepEqual(validateAuthenticationPathReview(), []);
assert.deepEqual(
  Object.keys(AUTHENTICATION_PATH_MASTER_EVIDENCE).toSorted(),
  AUTHENTICATION_PATH_REVIEW_RECORDS.map((record) => record.requirementId).toSorted(),
);

for (const record of AUTHENTICATION_PATH_REVIEW_RECORDS) {
  assert.ok(AUTHENTICATION_PATH_REVIEW_STATUSES.includes(record.status));
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

console.log("authentication path review evidence passed: 21 exact paths audited");
