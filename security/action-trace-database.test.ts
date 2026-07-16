import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  ACTION_TRACE_DATABASE_FIELD_BINDINGS,
  ACTION_TRACE_DATABASE_MASTER_EVIDENCE,
} from "./action-trace-database-evidence";
import {
  ACTION_TRACE_DATABASE_ACTIVITY,
  ACTION_TRACE_DATABASE_FIELDS,
  validateActionTraceDatabaseActivity,
} from "./action-trace-database";
import { DATABASE_QUERY_RECORDS } from "./database-query-records";

const bindings = Object.entries(ACTION_TRACE_DATABASE_FIELD_BINDINGS);
assert.equal(bindings.length, 20);
assert.deepEqual(
  bindings.map(([, field]) => field).toSorted(),
  [...ACTION_TRACE_DATABASE_FIELDS].toSorted(),
);
assert.equal(ACTION_TRACE_DATABASE_ACTIVITY.length, DATABASE_QUERY_RECORDS.length);
assert.deepEqual(
  validateActionTraceDatabaseActivity(ACTION_TRACE_DATABASE_ACTIVITY),
  [],
);

for (const [id] of bindings) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    ACTION_TRACE_DATABASE_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of ACTION_TRACE_DATABASE_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

const forged = ACTION_TRACE_DATABASE_ACTIVITY.map((record) => ({ ...record }));
delete (forged[0] as Partial<(typeof forged)[number]>).queryTimeout;
assert.deepEqual(validateActionTraceDatabaseActivity(forged), [
  `${forged[0].queryId}:queryTimeout`,
]);

console.log(
  "action trace database evidence passed: 20 fields across 18 operations",
);
