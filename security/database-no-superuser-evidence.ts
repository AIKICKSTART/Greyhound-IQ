export const DATABASE_NO_SUPERUSER_REQUIREMENT_ID =
  "security.least-privilege.no-app-superuser" as const;

export const DATABASE_NO_SUPERUSER_EVIDENCE = [
  "prisma/migrations/20260714020000_harden_runtime_catalog_privileges/migration.sql",
  "src/lib/db.ts",
  "src/lib/db-context.ts",
  "scripts/check-rls-access-matrix-postgres.ts",
  "security/row-level-security-runtime-evidence.json",
  "security/database-no-superuser-evidence.test.ts",
] as const;

export function findDatabaseNoSuperuserEvidenceIssues(value: unknown) {
  const issues: string[] = [];
  const report = record(value);
  if (!report) return ["Evidence must be an object."];
  if (report.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (report.auditKind !== "rls-access-matrix") {
    issues.push("auditKind must be rls-access-matrix.");
  }
  if (report.verdict !== "verified") issues.push("verdict must be verified.");
  if (
    !Array.isArray(report.sourceDefinedApplicationRoles) ||
    report.sourceDefinedApplicationRoles.length !== 1 ||
    report.sourceDefinedApplicationRoles[0] !== "greyhoundiq_runtime"
  ) {
    issues.push("The source-defined application role must be greyhoundiq_runtime.");
  }

  const identity = record(report.runtimeIdentity);
  if (
    identity?.currentRole !== "greyhoundiq_runtime" ||
    identity.sessionRole !== "greyhoundiq_runtime" ||
    identity.canLogin !== true
  ) {
    issues.push("The observed login identity must be greyhoundiq_runtime.");
  }
  for (const capability of [
    "superuser",
    "bypassRls",
    "createRole",
    "createDatabase",
    "replication",
  ]) {
    if (identity?.[capability] !== false) {
      issues.push(`Runtime capability ${capability} must be false.`);
    }
  }

  const separation = record(report.roleSeparation);
  const ownership = record(separation?.ownership);
  for (const objectType of ["databaseCount", "schemaCount", "relationCount", "routineCount"]) {
    if (ownership?.[objectType] !== 0) {
      issues.push(`Runtime ownership ${objectType} must be zero.`);
    }
  }
  const memberships = record(separation?.memberships);
  if (memberships?.membershipCount !== 0 || memberships.adminOptionCount !== 0) {
    issues.push("Runtime role memberships and admin options must be zero.");
  }
  const privileges = record(separation?.effectivePrivileges);
  if (
    privileges?.databaseCreate !== false ||
    privileges.databaseTemporary !== false ||
    privileges.publicSchemaCreate !== false ||
    privileges.schemaCreateCount !== 0
  ) {
    issues.push("Runtime database and schema creation privileges must be absent.");
  }
  const directGrants = record(separation?.directGrants);
  if (directGrants?.grantableCount !== 0) {
    issues.push("Runtime grant options must be zero.");
  }
  return issues;
}

export const DATABASE_NO_SUPERUSER_MASTER_EVIDENCE = {
  [DATABASE_NO_SUPERUSER_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: DATABASE_NO_SUPERUSER_EVIDENCE,
  },
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
