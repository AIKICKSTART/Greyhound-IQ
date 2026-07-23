import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { Prisma } from "@prisma/client";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { THIRD_PARTIES } from "./third-parties";
import {
  buildDatabaseColumnRecords,
  type PrismaModelSource,
} from "./database-column-records";
import {
  PERSONAL_INFORMATION_RECORD_EVIDENCE_PATHS,
  PERSONAL_INFORMATION_RECORD_EVIDENCE_SCOPE,
  PERSONAL_INFORMATION_RECORD_MASTER_EVIDENCE,
  PERSONAL_INFORMATION_RECORD_REQUIREMENT_FIELD,
  PERSONAL_INFORMATION_RECORD_REQUIREMENT_IDS,
} from "./personal-information-record-evidence";
import {
  PERSONAL_INFORMATION_RECORD_FIELDS,
  buildPersonalInformationRecords,
  validatePersonalInformationRecords,
  type PersonalInformationRecord,
} from "./personal-information-records";

const models = Prisma.dmmf.datamodel.models as unknown as PrismaModelSource[];
const databaseRecords = buildDatabaseColumnRecords(models);
const records = buildPersonalInformationRecords(databaseRecords, THIRD_PARTIES);
const databasePersonalCount = databaseRecords.filter(
  (record) =>
    record.recordKind === "column" &&
    record.personalInformationStatus !== "not-personal-by-schema",
).length;
const providerPersonalCount = THIRD_PARTIES.filter(
  (provider) => provider.personalInformation.length > 0,
).length;

assert.equal(databasePersonalCount, 143);
assert.equal(providerPersonalCount, 9);
assert.equal(records.length, databasePersonalCount + providerPersonalCount);
assert.deepEqual(
  validatePersonalInformationRecords(databaseRecords, THIRD_PARTIES, records),
  [],
);

assert.equal(PERSONAL_INFORMATION_RECORD_FIELDS.length, 20);
assert.equal(PERSONAL_INFORMATION_RECORD_REQUIREMENT_IDS.length, 20);
assert.deepEqual(
  Object.values(PERSONAL_INFORMATION_RECORD_REQUIREMENT_FIELD).toSorted(),
  [...PERSONAL_INFORMATION_RECORD_FIELDS].toSorted(),
);
assert.match(PERSONAL_INFORMATION_RECORD_EVIDENCE_SCOPE, /Source-static/);
assert.match(PERSONAL_INFORMATION_RECORD_EVIDENCE_SCOPE, /remain explicit/);

const requirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "personal-information-record",
);
assert.deepEqual(
  requirements.map((requirement) => requirement.id).toSorted(),
  [...PERSONAL_INFORMATION_RECORD_REQUIREMENT_IDS].toSorted(),
);
for (const requirementId of PERSONAL_INFORMATION_RECORD_REQUIREMENT_IDS) {
  const requirement = requirements.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    PERSONAL_INFORMATION_RECORD_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of PERSONAL_INFORMATION_RECORD_EVIDENCE_PATHS) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
}

const email = record("personal:database:User.email");
assert.equal(email.requiredOrOptionalStatus, "schema-required");
assert.match(email.collectionSource, /user|identity\/provider/);
assert.match(email.loggingBehaviour, /raw values prohibited/);
assert.match(email.aiUseBehaviour, /prohibited by default/);

for (const provider of THIRD_PARTIES.filter(
  (candidate) => candidate.personalInformation.length > 0,
)) {
  const providerRecord = record(`personal:third-party:${provider.providerId}`);
  assert.match(providerRecord.storageLocation, /not verified/);
  assert.match(providerRecord.thirdPartyDisclosure, new RegExp(provider.provider));
}

const missingPurpose = {
  ...records[0],
  purpose: "",
} satisfies PersonalInformationRecord;
assert.ok(
  validatePersonalInformationRecords(
    databaseRecords,
    THIRD_PARTIES,
    [missingPurpose, ...records.slice(1)],
  ).includes(`MISSING_FIELD:${records[0].recordId}:purpose`),
);
assert.ok(
  validatePersonalInformationRecords(
    databaseRecords,
    THIRD_PARTIES,
    records.slice(1),
  ).includes(`MISSING_RECORD:${records[0].recordId}`),
);
const unsafeAiUse = { ...records[0], aiUseBehaviour: "allowed" };
assert.ok(
  validatePersonalInformationRecords(
    databaseRecords,
    THIRD_PARTIES,
    records.map((candidate) =>
      candidate.recordId === unsafeAiUse.recordId ? unsafeAiUse : candidate,
    ),
  ).includes(`AI_USE_UNBOUNDED:${unsafeAiUse.recordId}`),
);

console.log(
  `personal information records passed: ${databasePersonalCount} database columns + ${providerPersonalCount} provider boundaries, ${PERSONAL_INFORMATION_RECORD_REQUIREMENT_IDS.length} exact structural gates`,
);

function record(recordId: string) {
  const value = records.find((candidate) => candidate.recordId === recordId);
  assert.ok(value, `${recordId}: personal-information record missing`);
  return value;
}
