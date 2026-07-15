export const VERIFIED_ACTUAL_QUERY_CAPTURE_REQUIREMENT_IDS = [
  "security.actual-query-capture.generated-sql",
  "security.actual-query-capture.placeholders",
  "security.actual-query-capture.structure",
  "security.actual-query-capture.columns",
  "security.actual-query-capture.authz-predicates",
  "security.actual-query-capture.tenant-predicates",
  "security.actual-query-capture.visibility-predicates",
  "security.actual-query-capture.cardinality",
  "security.actual-query-capture.database-role",
  "security.actual-query-capture.indexes-constraints",
  "security.actual-query-capture.transaction-locking",
  "security.actual-query-capture.timeout",
  "security.actual-query-capture.response-map",
  "security.actual-query-capture.tests",
  "security.actual-query-capture.no-customer-values",
  "security.actual-query-capture.no-production-credentials",
  "security.actual-query-capture.no-production-query-logs",
] as const;

export const ACTUAL_QUERY_CAPTURE_RESIDUAL_GAPS = {
  "security.actual-query-capture.locate":
    "The 27 source-bound operation records cover the mandatory security traces, not every Prisma/ORM operation in production source.",
} as const;

export const ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS = [
  "output/database-audit/account-deletion-finalize.json",
  "output/database-audit/account-deletion-pending-select.json",
  "output/database-audit/account-storage-deletion-jobs.json",
  "output/database-audit/demo-fixture-idempotency.json",
  "output/database-audit/dog-public-detail.json",
  "output/database-audit/home-race-meetings-read.json",
  "output/database-audit/live-provider-ingest.json",
  "output/database-audit/onboarding-analytics-rate-limit.json",
  "output/database-audit/race-detail-read.json",
  "output/database-audit/race-search-read.json",
  "output/database-audit/realtime-grant-revoke.json",
  "output/database-audit/support-ticket-create.json",
  "output/database-audit/user-export-read.json",
] as const;

const ACTUAL_QUERY_CAPTURE_EVIDENCE = [
  "src/lib/db.ts",
  "src/lib/db-context.ts",
  "src/lib/queries.ts",
  "src/lib/realtime-service.ts",
  "security/database-operations.ts",
  "security/database-query-records.ts",
  ...ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS,
  "security/actual-query-capture-evidence.test.ts",
] as const;

export const ACTUAL_QUERY_CAPTURE_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_ACTUAL_QUERY_CAPTURE_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: ACTUAL_QUERY_CAPTURE_EVIDENCE,
    },
  ]),
);
