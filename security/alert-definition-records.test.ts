import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  validateSloAlertPolicy,
  validateSloAlertRunbookEvidence,
} from "../scripts/check-slo-alert-policy";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  ALERT_RECORD_FIELD_REQUIREMENT_IDS,
  ALERT_RECORD_MASTER_EVIDENCE,
} from "./alert-definition-evidence";
import {
  buildAlertDefinitionRecords,
  type SloAlertPolicySource,
} from "./alert-definition-records";

const policy = JSON.parse(
  readFileSync("config/slo-alert-policy.json", "utf8"),
) as SloAlertPolicySource;
const runbookSource = readFileSync("docs/architecture/slo-alert-policy.md", "utf8");
assert.deepEqual(validateSloAlertPolicy(policy), []);
assert.deepEqual(
  validateSloAlertRunbookEvidence(policy, {
    "docs/architecture/slo-alert-policy.md": runbookSource,
  }),
  [],
);

const records = buildAlertDefinitionRecords(policy);
assert.equal(records.length, 8);
assert.equal(new Set(records.map(({ id }) => id)).size, records.length);
for (const record of records) {
  assert.ok(record.owner.trim());
  assert.match(record.severity, /^sev[1-3]$/);
  assert.ok(record.threshold.trim());
  assert.ok(record.investigationSteps.length >= 2);
  assert.ok(record.containmentSteps.length >= 2);
  assert.ok(record.escalationPath.trim());
  assert.ok(record.falsePositiveReview.trim());
  assert.match(record.testMethod, /metric binding unverified; delivery unverified/);
}

assert.throws(
  () => buildAlertDefinitionRecords({ ...policy, runbooks: [] }),
  /alert\.runbook_missing/,
);

assert.equal(ALERT_RECORD_FIELD_REQUIREMENT_IDS.length, 8);
for (const requirementId of ALERT_RECORD_FIELD_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    ALERT_RECORD_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "alert definition records passed: 8 SLO policies normalized; deployment and delivery remain unverified",
);
