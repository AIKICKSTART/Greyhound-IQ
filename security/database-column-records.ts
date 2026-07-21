export const DATABASE_COLUMN_RECORD_FIELDS = [
  "purpose",
  "dataOwner",
  "dataClassification",
  "personalInformationStatus",
  "sensitiveInformationStatus",
  "tenantScope",
  "ownershipField",
  "foreignKeys",
  "uniqueConstraints",
  "nullability",
  "defaultValues",
  "encryption",
  "retention",
  "deletionOrDeidentificationBehaviour",
  "auditRequirement",
  "accessingServices",
  "exportEligibility",
  "searchIndexEligibility",
  "logEligibility",
] as const;

export type DatabaseColumnRecordField =
  (typeof DATABASE_COLUMN_RECORD_FIELDS)[number];

export type PrismaFieldSource = {
  readonly name: string;
  readonly kind: string;
  readonly type: string;
  readonly isList: boolean;
  readonly isRequired: boolean;
  readonly isUnique: boolean;
  readonly isId: boolean;
  readonly hasDefaultValue: boolean;
  readonly default?: unknown;
  readonly relationFromFields?: readonly string[];
  readonly relationToFields?: readonly string[];
};

export type PrismaModelSource = {
  readonly name: string;
  readonly fields: readonly PrismaFieldSource[];
  readonly uniqueFields: readonly (readonly string[])[];
  readonly primaryKey: { readonly fields: readonly string[] } | null;
};

export type DatabaseColumnRecord = Record<DatabaseColumnRecordField, string> & {
  readonly recordId: string;
  readonly recordKind: "table" | "column";
  readonly table: string;
  readonly column: string | null;
  readonly source: "prisma-dmmf";
};

type DomainPolicy = {
  readonly owner: string;
  readonly classification: string;
  readonly retentionClass: string;
  readonly accessingServices: string;
};

const SECRET_FIELD =
  /(?:password|secret|token|signature|credential|session|cookie|privatekey|apikey|leasekey|salt|digest|hash)$/i;
const DIRECT_PERSONAL_FIELD =
  /(?:email|phone|mobile|address|postcode|birth|dob|firstname|lastname|displayname|legalname|ipaddress|useragent)$/i;
const LINKED_PERSONAL_FIELD =
  /(?:user|owner|actor|member|profile|requester|recipient|sender|participant|invitee|createdby|updatedby|moderator|administrator)id$/i;
const FINANCIAL_FIELD =
  /(?:amount|price|currency|invoice|payment|refund|credit|tax|billing|stripe|lago)/i;
const USER_CONTENT_FIELD =
  /(?:body|content|message|description|notes|reason|prompt|response|transcript|metadata|payload|answer|comment|bio)$/i;
const SEARCHABLE_PUBLIC_FIELD =
  /(?:name|title|slug|summary|description|breed|track|venue|suburb|state|status)$/i;

export function buildDatabaseColumnRecords(
  models: readonly PrismaModelSource[],
): DatabaseColumnRecord[] {
  return models.flatMap((model) => {
    const columns = model.fields.filter((field) => field.kind !== "object");
    const relations = relationDecisions(model);
    const uniqueConstraints = uniqueConstraintDecisions(model, columns);
    const ownershipFields = findOwnershipFields(columns);
    const policy = domainPolicyFor(model.name);
    const tableContext = {
      model,
      policy,
      ownershipFields,
      relations,
      uniqueConstraints,
    };

    return [
      tableRecord(tableContext),
      ...columns.map((field) => columnRecord(tableContext, field)),
    ];
  });
}

export function validateDatabaseColumnRecords(
  models: readonly PrismaModelSource[],
  records: readonly DatabaseColumnRecord[],
) {
  const issues: string[] = [];
  const expectedIds = new Set(
    models.flatMap((model) => [
      `table:${model.name}`,
      ...model.fields
        .filter((field) => field.kind !== "object")
        .map((field) => `column:${model.name}.${field.name}`),
    ]),
  );
  const seen = new Set<string>();

  for (const record of records) {
    if (seen.has(record.recordId)) issues.push(`DUPLICATE:${record.recordId}`);
    seen.add(record.recordId);
    if (!expectedIds.has(record.recordId)) {
      issues.push(`UNEXPECTED:${record.recordId}`);
    }
    for (const field of DATABASE_COLUMN_RECORD_FIELDS) {
      if (
        !Object.prototype.hasOwnProperty.call(record, field) ||
        typeof record[field] !== "string" ||
        !record[field].trim()
      ) {
        issues.push(`MISSING_FIELD:${record.recordId}:${field}`);
      }
    }
    if (SECRET_FIELD.test(record.column ?? "")) {
      if (!record.sensitiveInformationStatus.startsWith("sensitive")) {
        issues.push(`SECRET_NOT_SENSITIVE:${record.recordId}`);
      }
      if (record.logEligibility !== "prohibited") {
        issues.push(`SECRET_LOGGABLE:${record.recordId}`);
      }
      if (record.exportEligibility !== "prohibited") {
        issues.push(`SECRET_EXPORTABLE:${record.recordId}`);
      }
    }
  }

  for (const expectedId of expectedIds) {
    if (!seen.has(expectedId)) issues.push(`MISSING_RECORD:${expectedId}`);
  }
  return issues.sort();
}

function tableRecord(context: TableContext): DatabaseColumnRecord {
  const { model, policy, ownershipFields, relations, uniqueConstraints } = context;
  const personal = model.fields.some((field) => personalStatus(model.name, field.name) !== "not-personal-by-schema");
  const sensitive = model.fields.some((field) => sensitiveStatus(model.name, field.name) !== "not-sensitive-by-schema");
  return {
    recordId: `table:${model.name}`,
    recordKind: "table",
    table: model.name,
    column: null,
    source: "prisma-dmmf",
    purpose: `${humanize(model.name)} domain record owned by ${policy.owner}.`,
    dataOwner: policy.owner,
    dataClassification: policy.classification,
    personalInformationStatus: personal
      ? "contains-or-links-personal-information"
      : "not-personal-by-schema",
    sensitiveInformationStatus: sensitive
      ? "contains-or-links-sensitive-information"
      : "not-sensitive-by-schema",
    tenantScope: tenantScopeDecision(ownershipFields),
    ownershipField: ownershipDecision(ownershipFields),
    foreignKeys: listDecision(relations),
    uniqueConstraints: listDecision(uniqueConstraints),
    nullability: "recorded per column; not applicable to the table record",
    defaultValues: "recorded per column; not applicable to the table record",
    encryption: encryptionDecision(policy.classification),
    retention: retentionDecision(policy.retentionClass),
    deletionOrDeidentificationBehaviour:
      "domain retention and erasure policy applies; runtime enforcement is not asserted by this source-static record",
    auditRequirement: sensitive
      ? "audit privileged reads, exports, destructive changes and policy changes"
      : "audit privileged or destructive changes",
    accessingServices: policy.accessingServices,
    exportEligibility: personal
      ? "subject-access export only after server-side identity and ownership checks"
      : "domain export only after server-side authorization",
    searchIndexEligibility:
      "only explicitly allowlisted columns; this table record grants no index permission",
    logEligibility:
      "identifiers and outcomes only; column-level prohibitions remain authoritative",
  };
}

function columnRecord(
  context: TableContext,
  field: PrismaFieldSource,
): DatabaseColumnRecord {
  const { model, policy, ownershipFields, relations, uniqueConstraints } = context;
  const personal = personalStatus(model.name, field.name);
  const sensitive = sensitiveStatus(model.name, field.name);
  const secret = SECRET_FIELD.test(field.name);
  return {
    recordId: `column:${model.name}.${field.name}`,
    recordKind: "column",
    table: model.name,
    column: field.name,
    source: "prisma-dmmf",
    purpose: `${humanize(field.name)} value for the ${humanize(model.name)} record.`,
    dataOwner: policy.owner,
    dataClassification: columnClassification(policy, personal, sensitive),
    personalInformationStatus: personal,
    sensitiveInformationStatus: sensitive,
    tenantScope: tenantScopeDecision(ownershipFields),
    ownershipField: ownershipFields.includes(field.name)
      ? "this column participates in row ownership or tenant scope"
      : ownershipDecision(ownershipFields),
    foreignKeys: listDecision(
      relations.filter((relation) => relation.startsWith(`${field.name} ->`)),
    ),
    uniqueConstraints: listDecision(
      uniqueConstraints.filter((constraint) =>
        constraint.split(/[(), ]+/).includes(field.name),
      ),
    ),
    nullability: field.isRequired ? "required" : "nullable",
    defaultValues: field.hasDefaultValue
      ? stableDefault(field.default)
      : "no Prisma default declared",
    encryption: encryptionDecision(columnClassification(policy, personal, sensitive)),
    retention: retentionDecision(policy.retentionClass),
    deletionOrDeidentificationBehaviour: deletionDecision(personal, sensitive),
    auditRequirement:
      sensitive !== "not-sensitive-by-schema" || personal !== "not-personal-by-schema"
        ? "audit privileged disclosure, export and destructive mutation; never log the raw value"
        : "audit privileged or destructive mutation",
    accessingServices: policy.accessingServices,
    exportEligibility: secret
      ? "prohibited"
      : personal !== "not-personal-by-schema"
        ? "subject-access export only after server-side authorization and redaction policy"
        : "allowlist-only domain export",
    searchIndexEligibility:
      secret || sensitive.startsWith("sensitive")
        ? "prohibited"
        : SEARCHABLE_PUBLIC_FIELD.test(field.name)
          ? "eligible only through an explicit bounded index mapping"
          : "not approved by this inventory",
    logEligibility: secret
      ? "prohibited"
      : personal !== "not-personal-by-schema" || sensitive !== "not-sensitive-by-schema"
        ? "prohibited as a raw value; redacted event metadata only"
        : "allowlisted operational metadata only",
  };
}

type TableContext = {
  readonly model: PrismaModelSource;
  readonly policy: DomainPolicy;
  readonly ownershipFields: readonly string[];
  readonly relations: readonly string[];
  readonly uniqueConstraints: readonly string[];
};

function domainPolicyFor(model: string): DomainPolicy {
  if (/^(Dog|Trainer|Track|Meeting|Race|Runner|Result|FormEntry)/.test(model)) {
    return policy("racing-data", "PUBLIC_OR_INTERNAL_RACING", "racing-data", "racing ingestion and read services");
  }
  if (/^(Plan|PriceCatalog|PlanEntitlement|Billing|Subscription|Entitlement|WebhookEvent|Invoice|Payment|Refund|CreditNote|Usage)/.test(model)) {
    return policy("billing-platform", "CONFIDENTIAL_FINANCIAL", "billing-records", "billing routes, webhook workers and entitlement services");
  }
  if (/^(Listing|Marketplace|SavedListing|DogOwnership)/.test(model)) {
    return policy("marketplace", "CONFIDENTIAL_MARKETPLACE", "marketplace", "marketplace application services");
  }
  if (/^(Message|Conversation|Call|UserPresence|UserBlock)/.test(model)) {
    return policy("communications", "CONFIDENTIAL_COMMUNICATIONS", "communications", "messaging, realtime and call services");
  }
  if (/^(Feed|Forum|Thread|Post|SocialActor|Actor|Friendship|Notification)/.test(model)) {
    return policy("community", "CONFIDENTIAL_USER_CONTENT", "community-content", "community and feed services");
  }
  if (/^(AgentRun|MemoryEntry|ConversationContext)/.test(model)) {
    return policy("ai-platform", "CONFIDENTIAL_AI_CONTEXT", "ai-context", "AI orchestration and memory services");
  }
  if (/^(Support|Feedback|BugReport|Report|TrustSafety|BannedPhrase|MessageModeration|ListingModeration)/.test(model)) {
    return policy("trust-support", "CONFIDENTIAL_SUPPORT_SAFETY", "support-and-safety", "support, moderation and trust-safety services");
  }
  if (/^(AuditLog|AdminAction|JobRun|DataSourceHealth|RateLimit|PlatformSetting|RetentionPolicy|DeletionJob|ExportArtifact|LiveFeedQuarantine)/.test(model)) {
    return policy("platform-operations", "RESTRICTED_OPERATIONAL", "security-and-operations", "administration, security and operations services");
  }
  return policy("identity-platform", "CONFIDENTIAL_IDENTITY", "identity-and-account", "identity, account and organization services");
}

function policy(
  owner: string,
  classification: string,
  retentionClass: string,
  accessingServices: string,
): DomainPolicy {
  return { owner, classification, retentionClass, accessingServices };
}

function personalStatus(model: string, field: string) {
  if (DIRECT_PERSONAL_FIELD.test(field)) return "direct-personal-information";
  if (LINKED_PERSONAL_FIELD.test(field)) return "linked-personal-information";
  if (
    USER_CONTENT_FIELD.test(field) &&
    !/^(Dog|Track|Meeting|Race|Runner|Result)$/.test(model)
  ) {
    return "may-contain-personal-information";
  }
  return "not-personal-by-schema";
}

function sensitiveStatus(model: string, field: string) {
  if (SECRET_FIELD.test(field)) return "sensitive-authentication-or-security-data";
  if (FINANCIAL_FIELD.test(field) || /^(Billing|Payment|Refund|Invoice|CreditNote)/.test(model)) {
    return "sensitive-financial-data";
  }
  if (DIRECT_PERSONAL_FIELD.test(field)) return "sensitive-personal-data";
  if (USER_CONTENT_FIELD.test(field)) return "may-contain-sensitive-user-content";
  return "not-sensitive-by-schema";
}

function columnClassification(
  policy: DomainPolicy,
  personal: string,
  sensitive: string,
) {
  if (sensitive.startsWith("sensitive-authentication")) return "RESTRICTED_SECURITY";
  if (sensitive.startsWith("sensitive-financial")) return "CONFIDENTIAL_FINANCIAL";
  if (personal !== "not-personal-by-schema") return "CONFIDENTIAL_PERSONAL";
  if (sensitive !== "not-sensitive-by-schema") return "CONFIDENTIAL_SENSITIVE_CONTENT";
  return policy.classification;
}

function findOwnershipFields(fields: readonly PrismaFieldSource[]) {
  const priorities = [
    "organizationId",
    "ownerId",
    "userId",
    "actorId",
    "profileId",
    "sellerId",
    "requesterId",
    "createdById",
  ];
  const names = new Set(fields.map((field) => field.name));
  return priorities.filter((field) => names.has(field));
}

function relationDecisions(model: PrismaModelSource) {
  return model.fields
    .filter((field) => field.kind === "object")
    .flatMap((field) =>
      (field.relationFromFields ?? []).map((from, index) =>
        `${from} -> ${field.type}.${field.relationToFields?.[index] ?? "unknown"}`,
      ),
    )
    .sort();
}

function uniqueConstraintDecisions(
  model: PrismaModelSource,
  columns: readonly PrismaFieldSource[],
) {
  const constraints = new Set<string>();
  for (const field of columns) {
    if (field.isId) constraints.add(`PRIMARY KEY (${field.name})`);
    if (field.isUnique) constraints.add(`UNIQUE (${field.name})`);
  }
  for (const fields of model.uniqueFields) {
    constraints.add(`UNIQUE (${fields.join(", ")})`);
  }
  if (model.primaryKey?.fields.length) {
    constraints.add(`PRIMARY KEY (${model.primaryKey.fields.join(", ")})`);
  }
  return [...constraints].sort();
}

function tenantScopeDecision(ownershipFields: readonly string[]) {
  return ownershipFields.length
    ? `row-scoped through ${ownershipFields.join(", ")}; RLS/runtime proof remains separate`
    : "global, reference or system-scoped; no ownership column inferred from schema names";
}

function ownershipDecision(ownershipFields: readonly string[]) {
  return ownershipFields.length
    ? ownershipFields.join(", ")
    : "none inferred; explicit authorization policy still required";
}

function encryptionDecision(classification: string) {
  return classification.startsWith("PUBLIC")
    ? "managed database encryption at rest and TLS in transit required"
    : "managed database encryption at rest and TLS in transit required; field-level or one-way protection decision remains classification-specific";
}

function retentionDecision(retentionClass: string) {
  return `RetentionPolicy class ${retentionClass}; approved duration, backup treatment and deletion-job runtime proof remain separate`;
}

function deletionDecision(personal: string, sensitive: string) {
  if (sensitive.startsWith("sensitive-authentication")) {
    return "revoke, rotate or irreversibly destroy when no longer required; never deidentify for reuse";
  }
  if (personal !== "not-personal-by-schema") {
    return "delete or irreversibly deidentify under the account/data-subject workflow, subject to approved legal retention";
  }
  return "delete with the owning record or retain only under the approved domain retention class";
}

function stableDefault(value: unknown): string {
  if (value === undefined) return "default declared but unavailable in DMMF";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const record = value as { name?: unknown; args?: unknown };
    if (typeof record.name === "string") {
      return `${record.name}(${Array.isArray(record.args) ? record.args.join(",") : ""})`;
    }
  }
  return "structured Prisma default declared";
}

function listDecision(values: readonly string[]) {
  return values.length ? values.join("; ") : "none declared in Prisma DMMF";
}

function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}
