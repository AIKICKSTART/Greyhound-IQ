import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { DELETION_LIFECYCLE_MASTER_EVIDENCE } from "./deletion-lifecycle-evidence";
import {
  DELETION_LIFECYCLE_RECORDS,
  DELETION_LIFECYCLE_STATUSES,
  validateDeletionLifecycleCoverage,
} from "./deletion-lifecycle-coverage";

assert.equal(DELETION_LIFECYCLE_RECORDS.length, 12);
assert.deepEqual(validateDeletionLifecycleCoverage(), []);
assert.deepEqual(
  Object.keys(DELETION_LIFECYCLE_MASTER_EVIDENCE).toSorted(),
  [
    ...DELETION_LIFECYCLE_RECORDS.map((record) => record.requirementId),
    "security.deletion-lifecycle.truthful-interface",
  ].toSorted(),
);

for (const record of DELETION_LIFECYCLE_RECORDS) {
  assert.ok(DELETION_LIFECYCLE_STATUSES.includes(record.status));
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

const truthfulInterface = MASTER_AUDIT_REQUIREMENTS.find(
  (requirement) => requirement.id === "security.deletion-lifecycle.truthful-interface",
);
assert.ok(truthfulInterface);
assert.equal(
  isMasterRequirementComplete(truthfulInterface),
  true,
  "the account interface states the grace, de-identification, storage queue, and longer provider/backup retention",
);
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const deletionRoute = readFileSync(
  "src/app/api/users/me/delete/route.ts",
  "utf8",
);
assert.match(accountPage, /30-day grace window/);
assert.match(accountPage, /Profile data is then de-identified/);
assert.match(accountPage, /storage removal is queued/);
assert.match(accountPage, /provider and backup retention may take longer/);
assert.match(deletionRoute, /graceDays: 30/);
assert.doesNotMatch(accountPage, /immediate(?:ly)? permanently delete/i);

console.log("deletion lifecycle evidence passed: 12 documented behaviors and truthful account interface");
