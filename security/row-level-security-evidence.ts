const RLS_EVIDENCE = [
  "prisma/schema.prisma",
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  "prisma/migrations/20260714004000_add_signup_acceptance_outbox/migration.sql",
  "prisma/migrations/20260716120000_restrict_sensitive_rls_to_admin/migration.sql",
  "src/lib/db-context.ts",
  "scripts/check-rls-access-matrix-postgres.ts",
  "security/row-level-security-runtime-evidence.json",
  "security/row-level-security-evidence.test.ts",
] as const;

export const RLS_RUNTIME_VERIFIED_REQUIREMENT_IDS = [
  "security.row-level-security.defense-in-depth",
  "security.row-level-security.role-tests",
  "security.row-level-security.tenant-tests",
  "security.row-level-security.owner-tests",
  "security.row-level-security.privileged-tests",
  "security.row-level-security.worker-tests",
  "security.row-level-security.pool-context",
  "security.row-level-security.service-bypass",
  "security.row-level-security.exclusions",
] as const;

export const RLS_APPLICATION_AUTHORIZATION_REQUIREMENT_ID =
  "security.row-level-security.application-authz" as const;

export const ROW_LEVEL_SECURITY_BOUNDARY = {
  verifiedScope:
    "Current source plus the passwordless disposable loopback PostgreSQL 15 replay on port 55734, exercised as greyhoundiq_runtime with synthetic rows that were forcibly rolled back.",
  deployedScope:
    "No staging or production database was contacted. Deployed role, policy, migration and application-image parity remain separate release gates.",
  applicationAuthorizationGap:
    "The matrix proves database enforcement only. Endpoint-wide application-layer ownership, tenant and function authorization is not yet exhaustive, so application-authz remains partially verified.",
  exclusions: [
    {
      scope: "Prisma application row tables",
      excludedCount: 0,
      justification: "All 107 current Prisma models have ENABLE and FORCE RLS in the replayed catalog.",
    },
    {
      scope: "Five public racing materialized views",
      excludedCount: 5,
      justification:
        "Materialized views are public aggregate projections rather than mutable application rows; SELECT grants and the allowlisted refresh routine are their control boundary.",
    },
    {
      scope: "Public social profile projection view",
      excludedCount: 1,
      justification:
        "The security-barrier view exposes an intentionally reduced projection while direct anon/authenticated base-table reads are revoked.",
    },
  ],
} as const;

export const ROW_LEVEL_SECURITY_MASTER_EVIDENCE: Readonly<
  Record<
    string,
    {
      status: "verified" | "partially-verified";
      evidence: readonly string[];
    }
  >
> = {
  ...Object.fromEntries(
    RLS_RUNTIME_VERIFIED_REQUIREMENT_IDS.map((id) => [
      id,
      { status: "verified" as const, evidence: RLS_EVIDENCE },
    ]),
  ),
  [RLS_APPLICATION_AUTHORIZATION_REQUIREMENT_ID]: {
    status: "partially-verified" as const,
    evidence: [
      "scripts/check-db-context.ts",
      "security/database-operations.ts",
      "security/row-level-security-evidence.ts",
      "security/row-level-security-evidence.test.ts",
    ],
  },
} as const;
