const DATABASE_ROLE_SEPARATION_EVIDENCE = [
  "prisma/schema.prisma",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "prisma/migrations/20260714020000_harden_runtime_catalog_privileges/migration.sql",
  "prisma/migrations/20260714021500_pin_runtime_routine_allowlist/migration.sql",
  "prisma/migrations/20260714023000_revoke_public_database_temporary/migration.sql",
  "src/lib/db-context.ts",
  "scripts/check-rls-access-matrix-postgres.ts",
  "security/row-level-security-runtime-evidence.json",
  "security/database-role-separation-evidence.test.ts",
] as const;

export const DATABASE_RUNTIME_ROLE_VERIFIED_REQUIREMENT_IDS = [
  "security.database-role-separation.app",
  "security.database-role-separation.no-schema-ddl",
  "security.database-role-separation.no-functions",
  "security.database-role-separation.no-user-management",
  "security.database-role-separation.no-policy-disable",
  "security.database-role-separation.no-system-tables",
  "security.database-role-separation.no-tenant-bypass",
] as const;

export const DATABASE_SPECIALIST_ROLE_OPEN_REQUIREMENT_IDS = [
  "security.database-role-separation.migrations",
  "security.database-role-separation.reporting",
  "security.database-role-separation.workers",
  "security.database-role-separation.ingestion",
  "security.database-role-separation.administration",
  "security.database-role-separation.backups",
  "security.database-role-separation.monitoring",
  "security.database-role-separation.incident",
] as const;

export const DATABASE_ROLE_SEPARATION_BOUNDARY = {
  verifiedScope:
    "Current source plus the passwordless disposable loopback PostgreSQL 15 replay on port 55734, connected as greyhoundiq_runtime. Catalog assertions and denied-operation probes prove the ordinary runtime boundary only.",
  deployedScope:
    "No staging or production database was contacted. Deployed IAM, role grants, migration metadata and application-image parity remain separate release gates.",
  ordinaryRuntime:
    "greyhoundiq_runtime owns no database, schema, relation or routine; holds no inherited role; has no grant option, database CREATE, TEMPORARY, schema CREATE, CREATEROLE, CREATEDB, REPLICATION, SUPERUSER or BYPASSRLS capability; and receives direct grants only on current public application relations and giq_ routines.",
  systemCatalog:
    "The runtime has no direct pg_catalog or information_schema grants and a live pg_authid read is denied. PostgreSQL's default PUBLIC metadata visibility remains and is not represented as a zero-catalog-access claim.",
  tenantBoundary:
    "Owner A and owner B cannot cross tenant boundaries in ordinary member contexts. The same role has a documented app.system worker context, so the separate workers-role requirement remains open even though undocumented member-context bypass is denied.",
  specialistRoleGap:
    "Only greyhoundiq_runtime exists in the source-defined greyhoundiq role namespace. Migration, reporting, worker, ingestion, administration, backup, monitoring and incident identities are not implemented or exercised and remain open.",
} as const;

export const DATABASE_ROLE_SEPARATION_MASTER_EVIDENCE: Readonly<
  Record<
    string,
    {
      status: "verified";
      evidence: readonly string[];
    }
  >
> = Object.fromEntries(
  DATABASE_RUNTIME_ROLE_VERIFIED_REQUIREMENT_IDS.map((id) => [
    id,
    { status: "verified" as const, evidence: DATABASE_ROLE_SEPARATION_EVIDENCE },
  ]),
);
