export const VERIFIED_DATABASE_INVENTORY_REQUIREMENT_IDS = [
  "security.database-inventory.table",
  "security.database-inventory.view",
  "security.database-inventory.materialized-view",
  "security.database-inventory.function",
  "security.database-inventory.trigger",
  "security.database-inventory.index",
  "security.database-inventory.row-level-security-policy",
  "security.database-inventory.migration",
  "security.database-inventory.sequence",
] as const;

export const DATABASE_INVENTORY_NOT_APPLICABLE = {
  "security.database-inventory.stored-procedure":
    "The hash-frozen Prisma schema and complete migration source set contain PostgreSQL functions but no CREATE PROCEDURE declaration.",
} as const;

export const DATABASE_INVENTORY_EVIDENCE_PATHS = [
  "prisma/schema.prisma",
  "prisma/migrations/20260630093000_baseline/migration.sql",
  "output/database-audit/migration-replay.json",
  "scripts/check-database-compatibility-inventory.ts",
  "scripts/check-database-compatibility-inventory.test.ts",
  "security/database-inventory-evidence.test.ts",
  "docs/security/database-inventory.md",
  "security/database-sequence-inventory-evidence.ts",
  "security/database-sequence-inventory-evidence.json",
  "security/database-sequence-inventory-evidence.test.ts",
] as const;

export const DATABASE_INVENTORY_MASTER_EVIDENCE = {
  ...Object.fromEntries(
    VERIFIED_DATABASE_INVENTORY_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      {
        status: "verified" as const,
        evidence: DATABASE_INVENTORY_EVIDENCE_PATHS,
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(DATABASE_INVENTORY_NOT_APPLICABLE).map(
      ([requirementId, notApplicableJustification]) => [
        requirementId,
        {
          status: "not-applicable-with-justification" as const,
          evidence: DATABASE_INVENTORY_EVIDENCE_PATHS,
          notApplicableJustification,
        },
      ],
    ),
  ),
};
