import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { Prisma } from "@prisma/client";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  DATABASE_COLUMN_RECORD_EVIDENCE_PATHS,
  DATABASE_COLUMN_RECORD_EVIDENCE_SCOPE,
  DATABASE_COLUMN_RECORD_MASTER_EVIDENCE,
  DATABASE_COLUMN_RECORD_REQUIREMENT_FIELD,
  DATABASE_COLUMN_RECORD_REQUIREMENT_IDS,
} from "./database-column-record-evidence";
import {
  DATABASE_COLUMN_RECORD_FIELDS,
  buildDatabaseColumnRecords,
  validateDatabaseColumnRecords,
  type DatabaseColumnRecord,
  type PrismaModelSource,
} from "./database-column-records";

const models = Prisma.dmmf.datamodel.models as unknown as PrismaModelSource[];
const physicalColumnCount = models.reduce(
  (count, model) =>
    count + model.fields.filter((field) => field.kind !== "object").length,
  0,
);
const records = buildDatabaseColumnRecords(models);

assert.equal(models.length, 113, "the inventory must retain every Prisma model");
assert.equal(
  physicalColumnCount,
  1200,
  "the inventory must retain every physical Prisma column",
);
assert.equal(records.length, models.length + physicalColumnCount);
assert.equal(
  records.filter((record) => record.recordKind === "table").length,
  models.length,
);
assert.equal(
  records.filter((record) => record.recordKind === "column").length,
  physicalColumnCount,
);
assert.deepEqual(validateDatabaseColumnRecords(models, records), []);

assert.equal(DATABASE_COLUMN_RECORD_FIELDS.length, 19);
assert.equal(DATABASE_COLUMN_RECORD_REQUIREMENT_IDS.length, 19);
assert.deepEqual(
  Object.values(DATABASE_COLUMN_RECORD_REQUIREMENT_FIELD).toSorted(),
  [...DATABASE_COLUMN_RECORD_FIELDS].toSorted(),
  "the immutable requirement mapping must cover every record field exactly once",
);
assert.match(DATABASE_COLUMN_RECORD_EVIDENCE_SCOPE, /Source-static structural/);
assert.match(DATABASE_COLUMN_RECORD_EVIDENCE_SCOPE, /does not prove/i);

const requirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "database-column-record",
);
assert.deepEqual(
  requirements.map((requirement) => requirement.id).toSorted(),
  [...DATABASE_COLUMN_RECORD_REQUIREMENT_IDS].toSorted(),
);
assert.deepEqual(
  Object.keys(DATABASE_COLUMN_RECORD_MASTER_EVIDENCE).toSorted(),
  [...DATABASE_COLUMN_RECORD_REQUIREMENT_IDS].toSorted(),
);
for (const requirementId of DATABASE_COLUMN_RECORD_REQUIREMENT_IDS) {
  const requirement = requirements.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    DATABASE_COLUMN_RECORD_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of DATABASE_COLUMN_RECORD_EVIDENCE_PATHS) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
}

const userEmail = record("column:User.email");
assert.equal(userEmail.personalInformationStatus, "direct-personal-information");
assert.equal(userEmail.sensitiveInformationStatus, "sensitive-personal-data");
assert.equal(userEmail.logEligibility, "prohibited as a raw value; redacted event metadata only");

const sensitiveColumn = records.find(
  (candidate) =>
    candidate.recordKind === "column" &&
    /(?:token|secret|signature|credential|session|cookie|hash)$/i.test(
      candidate.column ?? "",
    ),
);
assert.ok(sensitiveColumn, "the schema must contain a sensitive security column");
assert.match(sensitiveColumn.sensitiveInformationStatus, /^sensitive/);
assert.equal(sensitiveColumn.exportEligibility, "prohibited");
assert.equal(sensitiveColumn.logEligibility, "prohibited");

const dogSireId = record("column:Dog.sireId");
assert.match(dogSireId.foreignKeys, /sireId -> Dog\.id/);
assert.match(record("table:User").uniqueConstraints, /UNIQUE \(email\)/);
assert.equal(record("column:User.id").nullability, "required");

const missingPurpose = {
  ...records[0],
  purpose: "",
} satisfies DatabaseColumnRecord;
assert.ok(
  validateDatabaseColumnRecords(models, [missingPurpose, ...records.slice(1)]).includes(
    `MISSING_FIELD:${records[0].recordId}:purpose`,
  ),
);
assert.ok(
  validateDatabaseColumnRecords(models, records.slice(1)).includes(
    `MISSING_RECORD:${records[0].recordId}`,
  ),
);
assert.ok(
  validateDatabaseColumnRecords(models, [records[0], ...records]).includes(
    `DUPLICATE:${records[0].recordId}`,
  ),
);
const unsafeSecret = { ...sensitiveColumn, logEligibility: "allowlisted" };
assert.ok(
  validateDatabaseColumnRecords(
    models,
    records.map((candidate) =>
      candidate.recordId === unsafeSecret.recordId ? unsafeSecret : candidate,
    ),
  ).includes(`SECRET_LOGGABLE:${unsafeSecret.recordId}`),
);

console.log(
  `database column records passed: ${models.length} tables + ${physicalColumnCount} columns, ${DATABASE_COLUMN_RECORD_REQUIREMENT_IDS.length} exact structural gates`,
);

function record(recordId: string) {
  const value = records.find((candidate) => candidate.recordId === recordId);
  assert.ok(value, `${recordId}: inventory record missing`);
  return value;
}
