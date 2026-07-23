export const DATABASE_SEQUENCE_INVENTORY_REQUIREMENT_ID =
  "security.database-inventory.sequence" as const;

export const DATABASE_SEQUENCE_INVENTORY_EVIDENCE_PATHS = [
  "prisma/schema.prisma",
  "prisma/migrations/20260630093000_baseline/migration.sql",
  "output/database-audit/migration-replay.json",
  "security/database-sequence-inventory-evidence.json",
  "security/database-sequence-inventory-evidence.test.ts",
] as const;

export const EXPECTED_DATABASE_SEQUENCES = [
  {
    schema: "public",
    name: "AuditLog_id_seq",
    dataType: "bigint",
    sourceModel: "AuditLog",
    sourceField: "id",
    sourceDeclaration: "BIGSERIAL",
  },
] as const;

type SourceBinding = {
  prismaSchemaSha256: string;
  migrationsSha256: string;
  migrationCount: number;
  baselineMigrationSha256: string;
};

export function findDatabaseSequenceInventoryIssues(
  value: unknown,
  expectedSource: SourceBinding,
) {
  const issues: string[] = [];
  const evidence = record(value);
  if (!evidence) return ["Evidence must be an object."];
  if (evidence.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (evidence.auditKind !== "database-sequence-inventory") {
    issues.push("auditKind is invalid.");
  }
  if (evidence.verdict !== "verified") issues.push("verdict must be verified.");

  const safety = record(evidence.safety);
  if (
    safety?.scope !== "literal-loopback-disposable-replay-read-only" ||
    safety.host !== "127.0.0.1" ||
    safety.port !== 55734 ||
    safety.database !== "greyhoundiq" ||
    safety.readOnlySession !== true ||
    safety.productionOrProviderSystemsContacted !== false
  ) {
    issues.push("Safety boundary must be read-only disposable loopback.");
  }
  const identity = record(evidence.runtimeIdentity);
  if (identity?.role !== "greyhoundiq_runtime") {
    issues.push("Runtime identity must be greyhoundiq_runtime.");
  }

  if (JSON.stringify(evidence.sourceBinding) !== JSON.stringify(expectedSource)) {
    issues.push("Source binding is stale.");
  }
  if (JSON.stringify(evidence.sequences) !== JSON.stringify(EXPECTED_DATABASE_SEQUENCES)) {
    issues.push("Sequence inventory is not the exact approved set.");
  }
  return issues;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
