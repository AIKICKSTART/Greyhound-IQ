export const DATABASE_SCHEMA_INVENTORY_REQUIREMENT_ID =
  "security.database-inventory.schema" as const;

export const DATABASE_SCHEMA_INVENTORY_EVIDENCE_PATHS = [
  "prisma/schema.prisma",
  "prisma/migrations/20260630093000_baseline/migration.sql",
  "prisma/migrations/20260630170000_supabase_storage/migration.sql",
  "output/database-audit/migration-replay.json",
  "security/database-schema-inventory-evidence.json",
  "security/database-schema-inventory-evidence.test.ts",
] as const;

export const EXPECTED_APPLICATION_OWNED_SCHEMAS = [
  {
    name: "public",
    sourceDeclaration: "CREATE SCHEMA IF NOT EXISTS public",
    observedInDisposableReplay: true,
  },
] as const;

export const EXPECTED_CONDITIONAL_EXTERNAL_SCHEMAS = [
  {
    name: "auth",
    owner: "Supabase",
    sourceUse: "auth.jwt()",
    guardedWhenAbsent: true,
    observedInDisposableReplay: false,
  },
  {
    name: "storage",
    owner: "Supabase",
    sourceUse: "storage.buckets, storage.objects and storage.foldername(text)",
    guardedWhenAbsent: true,
    observedInDisposableReplay: false,
  },
] as const;

export const EXPECTED_EXCLUDED_PLATFORM_SCHEMA_CLASSES = [
  "information_schema",
  "pg_catalog",
  "pg_toast and pg_toast_temp_*",
  "pg_temp_*",
] as const;

type SourceBinding = {
  prismaSchemaSha256: string;
  migrationsSha256: string;
  migrationCount: number;
};

export function findDatabaseSchemaInventoryIssues(
  value: unknown,
  expectedSource: SourceBinding,
) {
  const issues: string[] = [];
  const evidence = record(value);
  if (!evidence) return ["Evidence must be an object."];
  if (evidence.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (evidence.auditKind !== "database-schema-inventory") {
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
  if (
    JSON.stringify(evidence.applicationOwnedSchemas) !==
    JSON.stringify(EXPECTED_APPLICATION_OWNED_SCHEMAS)
  ) {
    issues.push("Application-owned schema inventory is not the exact approved set.");
  }
  if (
    JSON.stringify(evidence.conditionalExternalSchemas) !==
    JSON.stringify(EXPECTED_CONDITIONAL_EXTERNAL_SCHEMAS)
  ) {
    issues.push("Conditional external schema inventory is not the exact approved set.");
  }
  if (
    JSON.stringify(evidence.excludedPlatformManagedSchemaClasses) !==
    JSON.stringify(EXPECTED_EXCLUDED_PLATFORM_SCHEMA_CLASSES)
  ) {
    issues.push("Platform-managed schema exclusions are not the exact approved set.");
  }
  return issues;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
