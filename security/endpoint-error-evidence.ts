export const ENDPOINT_ERROR_EVIDENCE_FILE =
  "security/endpoint-error-evidence.ts" as const;
export const ENDPOINT_ERROR_TEST_FILE =
  "security/endpoint-error-evidence.test.ts" as const;

export const ENDPOINT_ERROR_EVIDENCE_SCOPE =
  "Representative executable, provider-free fault injection for seven endpoint error classes. The tests exercise the production database fail-closed wrapper, storage error normalization, authentication recovery screen, bounded racing-provider retry exhaustion, malformed racing-provider response rejection, generic internal-error response, and diagnostic-sink failure containment. This evidence does not claim cache, queue, payment-provider, AI-provider or mutation-audit failure behavior.";

export const ENDPOINT_ERROR_REQUIREMENT_IDS = [
  "security.endpoint-test-error.database-unavailable",
  "security.endpoint-test-error.storage-unavailable",
  "security.endpoint-test-error.authentication-provider-unavailable",
  "security.endpoint-test-error.racing-provider-unavailable",
  "security.endpoint-test-error.malformed-provider-response",
  "security.endpoint-test-error.internal-exception",
  "security.endpoint-test-error.logging-failure",
] as const;

export type EndpointErrorRequirementId =
  (typeof ENDPOINT_ERROR_REQUIREMENT_IDS)[number];

type EndpointErrorEvidenceRecord = Readonly<{
  status: "verified";
  evidence: readonly string[];
}>;

const COMMON_EVIDENCE = [
  ENDPOINT_ERROR_EVIDENCE_FILE,
  ENDPOINT_ERROR_TEST_FILE,
] as const;

function verified(...evidence: readonly string[]): EndpointErrorEvidenceRecord {
  return { status: "verified", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const ENDPOINT_ERROR_MASTER_EVIDENCE = {
  "security.endpoint-test-error.database-unavailable": verified(
    "src/lib/db.ts",
    "src/lib/api-errors.ts",
    "src/lib/api-errors.test.ts",
    "security/secure-failure-evidence.test.ts",
  ),
  "security.endpoint-test-error.storage-unavailable": verified(
    "src/lib/supabase-storage.ts",
    "src/lib/supabase-storage.test.ts",
    "src/lib/api-errors.ts",
    "src/lib/api-errors.test.ts",
  ),
  "security.endpoint-test-error.authentication-provider-unavailable": verified(
    "src/app/callback/route.ts",
    "src/app/auth/error/page.tsx",
    "src/lib/auth-callback-recovery.ts",
    "src/lib/auth-callback-recovery.test.ts",
    "src/lib/auth-callback-route-contract.test.ts",
  ),
  "security.endpoint-test-error.racing-provider-unavailable": verified(
    "src/lib/live/topaz.ts",
    "src/lib/live/topaz.test.ts",
    "src/app/api/internal/live-sync/route.ts",
    "src/lib/api-errors.ts",
  ),
  "security.endpoint-test-error.malformed-provider-response": verified(
    "src/lib/live/provider-response-validation.test.ts",
    "src/lib/live/watchdog-response.ts",
    "src/lib/remote-response.ts",
  ),
  "security.endpoint-test-error.internal-exception": verified(
    "src/lib/api-errors.ts",
    "src/lib/api-errors.test.ts",
    "src/lib/logger.ts",
    "src/lib/logger.test.ts",
    "security/secure-failure-evidence.test.ts",
  ),
  "security.endpoint-test-error.logging-failure": verified(
    "src/lib/logger.ts",
    "src/lib/logger.test.ts",
    "src/lib/api-errors.ts",
  ),
} as const satisfies Readonly<
  Record<EndpointErrorRequirementId, EndpointErrorEvidenceRecord>
>;

export const ENDPOINT_ERROR_EXPECTED_GAIN =
  ENDPOINT_ERROR_REQUIREMENT_IDS.length;
