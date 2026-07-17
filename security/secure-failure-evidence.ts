const SECURE_FAILURE_EVIDENCE = [
  "src/lib/api-errors.ts",
  "src/lib/api-errors.test.ts",
  "src/lib/logger.ts",
  "src/lib/logger.test.ts",
  "src/lib/request-id.ts",
  "src/lib/request-id.test.ts",
  "src/lib/db-context.ts",
  "src/lib/conversation-service.ts",
  "src/lib/signup-acceptance-worker.ts",
  "src/lib/signup-acceptance-worker.test.ts",
  "src/lib/signup-acceptance-worker-store.ts",
  "output/database-audit/demo-fixture-idempotency.json",
  "security/secure-failure-evidence.test.ts",
] as const;

const VERIFIED_SECURE_FAILURE_IDS = [
  "security.secure-failure.deny",
  "security.secure-failure.rollback",
  "security.secure-failure.redact",
  "security.secure-failure.user-message",
  "security.secure-failure.correlation-id",
  "security.secure-failure.diagnostics",
  "security.secure-failure.existence-hiding",
  "security.secure-failure.retry-context",
] as const;

export const SECURE_FAILURE_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_SECURE_FAILURE_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: SECURE_FAILURE_EVIDENCE },
  ]),
);
