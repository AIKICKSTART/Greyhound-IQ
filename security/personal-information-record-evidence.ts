import type { PersonalInformationRecordField } from "./personal-information-records";

export const PERSONAL_INFORMATION_RECORD_REQUIREMENT_FIELD = {
  "security.personal-information-record.field.name": "name",
  "security.personal-information-record.field.purpose": "purpose",
  "security.personal-information-record.field.collection-source":
    "collectionSource",
  "security.personal-information-record.field.legal-or-operational-basis":
    "legalOrOperationalBasis",
  "security.personal-information-record.field.required-or-optional-status":
    "requiredOrOptionalStatus",
  "security.personal-information-record.field.user-visibility": "userVisibility",
  "security.personal-information-record.field.staff-visibility": "staffVisibility",
  "security.personal-information-record.field.third-party-disclosure":
    "thirdPartyDisclosure",
  "security.personal-information-record.field.storage-location": "storageLocation",
  "security.personal-information-record.field.encryption": "encryption",
  "security.personal-information-record.field.retention": "retention",
  "security.personal-information-record.field.deletion": "deletion",
  "security.personal-information-record.field.deidentification":
    "deidentification",
  "security.personal-information-record.field.backup-behaviour": "backupBehaviour",
  "security.personal-information-record.field.export-behaviour": "exportBehaviour",
  "security.personal-information-record.field.correction-behaviour":
    "correctionBehaviour",
  "security.personal-information-record.field.logging-behaviour": "loggingBehaviour",
  "security.personal-information-record.field.analytics-behaviour":
    "analyticsBehaviour",
  "security.personal-information-record.field.ai-use-behaviour": "aiUseBehaviour",
  "security.personal-information-record.field.data-owner": "dataOwner",
} as const satisfies Record<string, PersonalInformationRecordField>;

export type PersonalInformationRecordRequirementId =
  keyof typeof PERSONAL_INFORMATION_RECORD_REQUIREMENT_FIELD;

export const PERSONAL_INFORMATION_RECORD_REQUIREMENT_IDS = Object.keys(
  PERSONAL_INFORMATION_RECORD_REQUIREMENT_FIELD,
) as PersonalInformationRecordRequirementId[];

export const PERSONAL_INFORMATION_RECORD_EVIDENCE_PATHS = [
  "prisma/schema.prisma",
  "security/third-parties.ts",
  "security/database-column-records.ts",
  "security/personal-information-records.ts",
  "security/personal-information-record-evidence.ts",
  "security/personal-information-records.test.ts",
] as const;

export const PERSONAL_INFORMATION_RECORD_EVIDENCE_SCOPE =
  "Source-static structural coverage of schema-identified personal data and every registered personal-data third-party boundary. Unknown legal basis, residency, retention, provider logging and runtime deletion remain explicit and are not promoted by these field-presence gates.";

export const PERSONAL_INFORMATION_RECORD_MASTER_EVIDENCE: Readonly<
  Record<
    PersonalInformationRecordRequirementId,
    { readonly status: "verified"; readonly evidence: readonly string[] }
  >
> = Object.fromEntries(
  PERSONAL_INFORMATION_RECORD_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: PERSONAL_INFORMATION_RECORD_EVIDENCE_PATHS,
    },
  ]),
) as unknown as Record<
  PersonalInformationRecordRequirementId,
  { readonly status: "verified"; readonly evidence: readonly string[] }
>;
