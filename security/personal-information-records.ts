import type { DatabaseColumnRecord } from "./database-column-records";

export const PERSONAL_INFORMATION_RECORD_FIELDS = [
  "name",
  "purpose",
  "collectionSource",
  "legalOrOperationalBasis",
  "requiredOrOptionalStatus",
  "userVisibility",
  "staffVisibility",
  "thirdPartyDisclosure",
  "storageLocation",
  "encryption",
  "retention",
  "deletion",
  "deidentification",
  "backupBehaviour",
  "exportBehaviour",
  "correctionBehaviour",
  "loggingBehaviour",
  "analyticsBehaviour",
  "aiUseBehaviour",
  "dataOwner",
] as const;

export type PersonalInformationRecordField =
  (typeof PERSONAL_INFORMATION_RECORD_FIELDS)[number];

export type PersonalInformationRecord = Record<
  PersonalInformationRecordField,
  string
> & {
  readonly recordId: string;
  readonly sourceKind: "database-column" | "third-party";
  readonly sourceReference: string;
};

export type PersonalInformationThirdPartySource = {
  readonly providerId: string;
  readonly provider: string;
  readonly purpose: string;
  readonly dataSent: readonly string[];
  readonly dataReceived: readonly string[];
  readonly personalInformation: readonly string[];
  readonly dataRetention: string;
  readonly providerLogging: string;
  readonly knownSubprocessors: readonly string[];
  readonly responsibleOwner: string;
  readonly tlsVerification: string;
};

export function buildPersonalInformationRecords(
  databaseRecords: readonly DatabaseColumnRecord[],
  thirdParties: readonly PersonalInformationThirdPartySource[],
): PersonalInformationRecord[] {
  const databasePersonalInformation = databaseRecords
    .filter(
      (record) =>
        record.recordKind === "column" &&
        record.personalInformationStatus !== "not-personal-by-schema",
    )
    .map(databasePersonalInformationRecord);
  const providerPersonalInformation = thirdParties
    .filter((provider) => provider.personalInformation.length > 0)
    .map(thirdPartyPersonalInformationRecord);
  return [...databasePersonalInformation, ...providerPersonalInformation].sort(
    (left, right) => left.recordId.localeCompare(right.recordId),
  );
}

export function validatePersonalInformationRecords(
  databaseRecords: readonly DatabaseColumnRecord[],
  thirdParties: readonly PersonalInformationThirdPartySource[],
  records: readonly PersonalInformationRecord[],
) {
  const expectedIds = new Set([
    ...databaseRecords
      .filter(
        (record) =>
          record.recordKind === "column" &&
          record.personalInformationStatus !== "not-personal-by-schema",
      )
      .map((record) => `personal:database:${record.table}.${record.column}`),
    ...thirdParties
      .filter((provider) => provider.personalInformation.length > 0)
      .map((provider) => `personal:third-party:${provider.providerId}`),
  ]);
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const record of records) {
    if (seen.has(record.recordId)) issues.push(`DUPLICATE:${record.recordId}`);
    seen.add(record.recordId);
    if (!expectedIds.has(record.recordId)) issues.push(`UNEXPECTED:${record.recordId}`);
    for (const field of PERSONAL_INFORMATION_RECORD_FIELDS) {
      if (
        !Object.prototype.hasOwnProperty.call(record, field) ||
        typeof record[field] !== "string" ||
        !record[field].trim()
      ) {
        issues.push(`MISSING_FIELD:${record.recordId}:${field}`);
      }
    }
    if (!/raw values prohibited|provider logging unverified/i.test(record.loggingBehaviour)) {
      issues.push(`UNSAFE_LOG_DECISION:${record.recordId}`);
    }
    if (!/prohibited by default|explicit user-facing feature/i.test(record.aiUseBehaviour)) {
      issues.push(`AI_USE_UNBOUNDED:${record.recordId}`);
    }
  }
  for (const expectedId of expectedIds) {
    if (!seen.has(expectedId)) issues.push(`MISSING_RECORD:${expectedId}`);
  }
  return issues.sort();
}

function databasePersonalInformationRecord(
  column: DatabaseColumnRecord,
): PersonalInformationRecord {
  const direct = column.personalInformationStatus === "direct-personal-information";
  const linked = column.personalInformationStatus === "linked-personal-information";
  return {
    recordId: `personal:database:${column.table}.${column.column}`,
    sourceKind: "database-column",
    sourceReference: `${column.table}.${column.column}`,
    name: `${column.table}.${column.column}`,
    purpose: column.purpose,
    collectionSource: direct
      ? "user, authorized staff workflow or identity/provider synchronization"
      : linked
        ? "server-derived relationship to an authenticated actor or owned object"
        : "user-supplied feature content or external provider payload",
    legalOrOperationalBasis:
      "necessary for the named product operation; Australian privacy/legal approval remains required before production",
    requiredOrOptionalStatus:
      column.nullability === "required" ? "schema-required" : "schema-optional",
    userVisibility: direct
      ? "visible through the owning account feature and authorized subject export where implemented"
      : "visible only through the owning feature or authorized subject export",
    staffVisibility:
      "least-privilege support, security or operations access only; role/runtime proof remains separate",
    thirdPartyDisclosure:
      "no disclosure is granted by the database record; any provider transfer requires a linked third-party record",
    storageLocation: `managed PostgreSQL column ${column.table}.${column.column}; deployed project and region are not asserted`,
    encryption: column.encryption,
    retention: column.retention,
    deletion: column.deletionOrDeidentificationBehaviour,
    deidentification: direct
      ? "irreversible deidentification where deletion is not legally permitted; re-identification prohibited"
      : "remove or irreversibly replace the subject linkage where the approved retention policy permits",
    backupBehaviour:
      "included in encrypted database backups; backup expiry and deletion propagation require separate runtime proof",
    exportBehaviour: column.exportEligibility,
    correctionBehaviour: direct
      ? "correct through the owning account/admin workflow with server-side authorization and audit"
      : "correct by updating the authoritative owning object; derived copies must be reconciled",
    loggingBehaviour: `${column.logEligibility}; raw values prohibited`,
    analyticsBehaviour:
      "prohibited by default; use only approved minimized or deidentified aggregates",
    aiUseBehaviour:
      "prohibited by default; any explicit user-facing feature requires purpose notice, minimization and tenant isolation",
    dataOwner: column.dataOwner,
  };
}

function thirdPartyPersonalInformationRecord(
  provider: PersonalInformationThirdPartySource,
): PersonalInformationRecord {
  return {
    recordId: `personal:third-party:${provider.providerId}`,
    sourceKind: "third-party",
    sourceReference: provider.providerId,
    name: `${provider.provider} personal-information boundary`,
    purpose: provider.purpose,
    collectionSource: `application sends: ${list(provider.dataSent)}; provider returns: ${list(provider.dataReceived)}`,
    legalOrOperationalBasis:
      "necessary for the named provider-backed feature; contract, privacy notice and Australian legal basis require owner approval",
    requiredOrOptionalStatus:
      "required only when the user invokes the provider-backed feature",
    userVisibility:
      "visible through the owning feature and privacy notice; provider-console visibility is not asserted",
    staffVisibility:
      "least-privilege provider and application operators; access review evidence remains separate",
    thirdPartyDisclosure: `${provider.provider}; known subprocessors: ${list(provider.knownSubprocessors)}`,
    storageLocation: `${provider.provider} managed service; exact region and residency are not verified`,
    encryption: `TLS status: ${provider.tlsVerification}; provider at-rest/key controls are not verified`,
    retention: provider.dataRetention,
    deletion:
      "delete through the provider and local lifecycle where supported; completion evidence remains separate",
    deidentification:
      "minimize identifiers before transfer; deidentified reuse is prohibited without approved purpose",
    backupBehaviour:
      "provider backup behaviour is not verified and must be covered by contract and deletion terms",
    exportBehaviour:
      "include provider-held subject data only through an authorized export/reconciliation process",
    correctionBehaviour:
      "correct the authoritative local record and reconcile the provider copy where supported",
    loggingBehaviour: `provider logging unverified (${provider.providerLogging}); application raw values prohibited`,
    analyticsBehaviour:
      "prohibited by default; provider analytics requires disclosed, minimized and approved use",
    aiUseBehaviour:
      "prohibited by default; provider data must not train or enrich AI without explicit approved purpose",
    dataOwner: provider.responsibleOwner,
  };
}

function list(values: readonly string[]) {
  return values.length ? values.join(", ") : "none recorded";
}
