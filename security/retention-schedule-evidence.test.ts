import assert from "node:assert/strict";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { RETENTION_SCHEDULE_MASTER_EVIDENCE } from "./retention-schedule-evidence";
import { RETENTION_SCHEDULES } from "./retention-schedule";

const expectedIds = [
  "user-profiles",
  "sessions",
  "authentication-events",
  "posts",
  "comments",
  "messages",
  "media",
  "listings",
  "enquiries",
  "support-tickets",
  "moderation-records",
  "audit-logs",
  "security-logs",
  "billing-records",
  "invoices",
  "webhook-payloads",
  "racing-data-snapshots",
  "ai-prompts-and-responses",
  "exports",
  "deleted-account-data",
  "backups",
].map((id) => `security.retention-schedule.${id}`);

assert.deepEqual(
  RETENTION_SCHEDULES.map((record) => record.requirementId),
  expectedIds,
);
assert.equal(new Set(expectedIds).size, 21);

for (const record of RETENTION_SCHEDULES) {
  assert.ok(record.category.length >= 5, `${record.requirementId}: category`);
  assert.ok(record.recordScope.length >= 20, `${record.requirementId}: scope`);
  assert.ok(record.primaryPurpose.length >= 20, `${record.requirementId}: purpose`);
  assert.ok(
    record.activeRetentionCondition.length >= 20,
    `${record.requirementId}: active condition`,
  );
  assert.ok(record.retentionTrigger.length >= 10, `${record.requirementId}: trigger`);
  assert.ok(
    Number.isSafeInteger(record.maximumDaysAfterTrigger) &&
      record.maximumDaysAfterTrigger > 0 &&
      record.maximumDaysAfterTrigger <= 2555,
    `${record.requirementId}: finite maximum`,
  );
  if (record.contentReductionAfterDays !== undefined) {
    assert.ok(record.contentReductionAfterDays > 0);
    assert.ok(
      record.contentReductionAfterDays < record.maximumDaysAfterTrigger,
      `${record.requirementId}: content reduction precedes receipt deletion`,
    );
  }
  assert.ok(record.disposition.length >= 20, `${record.requirementId}: disposition`);
  assert.ok(record.systems.length > 0, `${record.requirementId}: systems`);
  assert.ok(record.owner.endsWith("Owner"), `${record.requirementId}: owner`);
  assert.match(record.legalHoldRule, /minimum necessary scope and duration/);
  assert.equal(record.reviewCadenceDays, 365);
  assert.match(record.enforcementStatus, /-open$/);
  assert.doesNotMatch(
    JSON.stringify(record),
    /\b(?:TBD|unknown|indefinite|forever|as needed)\b/i,
    `${record.requirementId}: prohibited open-ended wording`,
  );

  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[record.requirementId],
    RETENTION_SCHEDULE_MASTER_EVIDENCE[record.requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === record.requirementId,
  );
  assert.ok(requirement, `${record.requirementId}: immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

// A schedule is not evidence that restore behavior is deployed and exercised.
const restoreTest = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === "security.infrastructure-control.restore-test",
);
assert.ok(restoreTest);
assert.equal(isMasterRequirementComplete(restoreTest), false);

console.log(
  "retention schedule passed: 21 finite, owned record policies defined; automation and restore gates remain open",
);
