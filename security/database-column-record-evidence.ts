import type { DatabaseColumnRecordField } from "./database-column-records";

export const DATABASE_COLUMN_RECORD_REQUIREMENT_FIELD = {
  "security.database-column-record.field.purpose": "purpose",
  "security.database-column-record.field.data-owner": "dataOwner",
  "security.database-column-record.field.data-classification":
    "dataClassification",
  "security.database-column-record.field.personal-information-status":
    "personalInformationStatus",
  "security.database-column-record.field.sensitive-information-status":
    "sensitiveInformationStatus",
  "security.database-column-record.field.tenant-scope": "tenantScope",
  "security.database-column-record.field.ownership-field": "ownershipField",
  "security.database-column-record.field.foreign-keys": "foreignKeys",
  "security.database-column-record.field.unique-constraints":
    "uniqueConstraints",
  "security.database-column-record.field.nullability": "nullability",
  "security.database-column-record.field.default-values": "defaultValues",
  "security.database-column-record.field.encryption": "encryption",
  "security.database-column-record.field.retention": "retention",
  "security.database-column-record.field.deletion-or-deidentification-behaviour":
    "deletionOrDeidentificationBehaviour",
  "security.database-column-record.field.audit-requirement": "auditRequirement",
  "security.database-column-record.field.accessing-services": "accessingServices",
  "security.database-column-record.field.export-eligibility": "exportEligibility",
  "security.database-column-record.field.search-index-eligibility":
    "searchIndexEligibility",
  "security.database-column-record.field.log-eligibility": "logEligibility",
} as const satisfies Record<string, DatabaseColumnRecordField>;

export type DatabaseColumnRecordRequirementId =
  keyof typeof DATABASE_COLUMN_RECORD_REQUIREMENT_FIELD;

export const DATABASE_COLUMN_RECORD_REQUIREMENT_IDS = Object.keys(
  DATABASE_COLUMN_RECORD_REQUIREMENT_FIELD,
) as DatabaseColumnRecordRequirementId[];

export const DATABASE_COLUMN_RECORD_EVIDENCE_PATHS = [
  "prisma/schema.prisma",
  "security/database-column-records.ts",
  "security/database-column-record-evidence.ts",
  "security/database-column-records.test.ts",
] as const;

export const DATABASE_COLUMN_RECORD_EVIDENCE_SCOPE =
  "Source-static structural coverage only: every Prisma table and physical column receives every required record field. This does not prove deployed encryption, approved retention durations, runtime erasure, RLS, caller completeness or production readiness.";

export const DATABASE_COLUMN_RECORD_MASTER_EVIDENCE: Readonly<
  Record<
    DatabaseColumnRecordRequirementId,
    { readonly status: "verified"; readonly evidence: readonly string[] }
  >
> = Object.fromEntries(
  DATABASE_COLUMN_RECORD_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: DATABASE_COLUMN_RECORD_EVIDENCE_PATHS,
    },
  ]),
) as unknown as Record<
  DatabaseColumnRecordRequirementId,
  { readonly status: "verified"; readonly evidence: readonly string[] }
>;
