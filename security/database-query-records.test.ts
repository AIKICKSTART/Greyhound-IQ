import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  DATABASE_QUERY_RECORD_FIELD_BINDINGS,
  DATABASE_QUERY_RECORD_MASTER_EVIDENCE,
} from "./database-query-record-evidence";
import {
  DATABASE_QUERY_RECORD_FIELDS,
  DATABASE_QUERY_RECORDS,
  validateDatabaseQueryRecords,
} from "./database-query-records";
import { DATABASE_OPERATIONS } from "./database-operations";

const bindingEntries = Object.entries(DATABASE_QUERY_RECORD_FIELD_BINDINGS);
assert.equal(bindingEntries.length, 41);
assert.deepEqual(
  bindingEntries.map(([, field]) => field).toSorted(),
  [...DATABASE_QUERY_RECORD_FIELDS].toSorted(),
);
assert.equal(DATABASE_QUERY_RECORDS.length, DATABASE_OPERATIONS.length);
assert.deepEqual(validateDatabaseQueryRecords(DATABASE_QUERY_RECORDS), []);
assert.equal(
  new Set(DATABASE_QUERY_RECORDS.map((record) => record.queryId)).size,
  DATABASE_QUERY_RECORDS.length,
);
assert.deepEqual(
  DATABASE_QUERY_RECORDS.filter((record) => record.normalisedSql.length === 0).map(
    (record) => record.queryId,
  ),
  [],
);

for (const [id] of bindingEntries) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    DATABASE_QUERY_RECORD_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of DATABASE_QUERY_RECORD_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

const forged = DATABASE_QUERY_RECORDS.map((record) => ({ ...record }));
delete (forged[0] as Partial<(typeof forged)[number]>).cacheInteraction;
assert.deepEqual(validateDatabaseQueryRecords(forged), [
  `${forged[0].queryId}:cacheInteraction`,
]);

console.log(
  `database query record evidence passed: 41 fields across ${DATABASE_QUERY_RECORDS.length} linked records`,
);
