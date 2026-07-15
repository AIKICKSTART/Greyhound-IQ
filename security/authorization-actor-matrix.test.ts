import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { AUTHORIZATION_ACTOR_MASTER_EVIDENCE } from "./authorization-actor-evidence";
import {
  AUTHORIZATION_ACTOR_RECORDS,
  AUTHORIZATION_ACTOR_STATUSES,
  validateAuthorizationActorMatrix,
} from "./authorization-actor-matrix";

assert.equal(AUTHORIZATION_ACTOR_RECORDS.length, 24);
assert.deepEqual(validateAuthorizationActorMatrix(), []);
assert.deepEqual(
  Object.keys(AUTHORIZATION_ACTOR_MASTER_EVIDENCE).toSorted(),
  AUTHORIZATION_ACTOR_RECORDS.map((record) => record.requirementId).toSorted(),
);

for (const record of AUTHORIZATION_ACTOR_RECORDS) {
  assert.ok(AUTHORIZATION_ACTOR_STATUSES.includes(record.status));
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

console.log("authorization actor matrix evidence passed: 24 exact actor mappings");
