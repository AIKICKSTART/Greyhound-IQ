export const MIGRATION_DATA_LOSS_REVIEW_REQUIREMENT_ID =
  "security.migration-review.data-loss";

export const MIGRATION_DATA_LOSS_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_DATA_LOSS_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "package.json",
      "scripts/check-migrations.ts",
      "security/migration-data-loss-review-evidence.ts",
      "security/migration-data-loss-review-evidence.test.ts",
    ],
  },
};
