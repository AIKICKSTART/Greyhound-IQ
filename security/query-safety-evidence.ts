import { ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS } from "./actual-query-capture-evidence";

export const VERIFIED_QUERY_SAFETY_REQUIREMENT_IDS = [
  "security.query-safety.allowlisted-identifiers",
  "security.query-safety.bounded-collections",
  "security.query-safety.pagination-max",
  "security.query-safety.export-limits",
  "security.query-safety.redact-db-errors",
  "security.query-safety.no-production-impact",
] as const;

export const QUERY_SAFETY_RESIDUAL_GAPS = {
  "security.query-safety.permission-before-exposure":
    "Forced RLS is verified, but endpoint-wide application authorization remains explicitly incomplete.",
  "security.query-safety.unomittable-scope":
    "DB-context wrappers and forced RLS exist, but every ownership and tenant policy has not been traced to every production query.",
  "security.query-safety.narrow-columns":
    "The mandatory query registry and user export use explicit projections; broad selection has not been excluded across the full ORM surface.",
  "security.query-safety.timeouts":
    "Every mandatory operation records a bounded timeout, but deployed enforcement has not been independently verified across every execution path.",
  "security.query-safety.cancellation":
    "Request cancellation is not propagated through the Prisma query boundary.",
  "security.query-safety.bounded-pools":
    "The runtime URL defaults to a bounded pool, but a supplied connection_limit is not capped and the deployed role/pooler limit is unverified.",
  "security.query-safety.n-plus-one":
    "There is no exhaustive direct-and-indirect ORM-in-loop inventory.",
  "security.query-safety.indexes":
    "Expected indexes are recorded for mandatory operations, but expensive queries have not been identified under representative volume.",
  "security.query-safety.plans":
    "Sanitized cost plans use small disposable fixtures; representative-volume plan review remains open.",
  "security.query-safety.replica-safety":
    "No deployed read-replica routing and consistency contract has been verified.",
} as const;

const EVIDENCE_BY_REQUIREMENT = {
  "security.query-safety.allowlisted-identifiers": [
    "scripts/check-production-sql-safety.ts",
    "scripts/check-production-sql-safety.test.ts",
    "security/orm-injection-control-evidence.ts",
    "security/orm-injection-control-evidence.test.ts",
    "security/query-safety-evidence.test.ts",
  ],
  "security.query-safety.bounded-collections": [
    "security/collection-query-bound-evidence.ts",
    "security/collection-query-bound-evidence.test.ts",
    "security/query-safety-evidence.test.ts",
  ],
  "security.query-safety.pagination-max": [
    "security/collection-query-bound-evidence.ts",
    "security/collection-query-bound-evidence.test.ts",
    "security/query-safety-evidence.test.ts",
  ],
  "security.query-safety.export-limits": [
    "src/lib/user-export-policy.ts",
    "src/lib/user-export-policy.test.ts",
    "src/lib/user-export-service.ts",
    "src/app/api/users/me/export/route.test.ts",
    "output/database-audit/user-export-read.json",
    "security/query-safety-evidence.test.ts",
  ],
  "security.query-safety.redact-db-errors": [
    "src/lib/api-errors.ts",
    "src/lib/api-errors.test.ts",
    "src/lib/db.ts",
    "src/lib/logger.test.ts",
    "security/secure-failure-evidence.test.ts",
    "security/query-safety-evidence.test.ts",
  ],
  "security.query-safety.no-production-impact": [
    "src/lib/db.ts",
    "security/actual-query-capture-evidence.ts",
    "security/actual-query-capture-evidence.test.ts",
    ...ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS,
    "security/query-safety-evidence.test.ts",
  ],
} as const;

export const QUERY_SAFETY_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_QUERY_SAFETY_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: EVIDENCE_BY_REQUIREMENT[requirementId],
    },
  ]),
);
