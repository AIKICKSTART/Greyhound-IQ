export const AUDIT_INTEGRITY_REQUIREMENT_ID =
  "security.audit-integrity.append-only" as const;

export const AUDIT_INTEGRITY_MASTER_EVIDENCE = {
  [AUDIT_INTEGRITY_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/schema.prisma",
      "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
      "prisma/migrations/20260708170000_force_row_level_security/migration.sql",
      "prisma/migrations/20260708192000_restrict_audit_ratelimit_rls/migration.sql",
      "security/audit-integrity-evidence.test.ts",
    ],
  },
} as const;
