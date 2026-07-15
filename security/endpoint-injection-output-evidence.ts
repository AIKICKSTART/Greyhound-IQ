export const ENDPOINT_INJECTION_OUTPUT_EVIDENCE_FILE =
  "security/endpoint-injection-output-evidence.ts" as const;
export const ENDPOINT_INJECTION_OUTPUT_TEST_FILE =
  "security/endpoint-injection-output-evidence.test.ts" as const;

export const ENDPOINT_INJECTION_OUTPUT_EVIDENCE_SCOPE =
  "Representative executable regression coverage for twelve injection and output-handling classes. The tests exercise the production SQL-template policy, plain-text React rendering, callback query normalization, upload and delivery path normalization, header and structured-log boundaries, authentication return-path validation, link-preview SSRF denial, JSON export handling for spreadsheet-formula strings, and provider snapshot allowlisting. This is bounded test evidence: it does not claim that every endpoint, browser renderer, deployed edge control, database engine, external provider, or production response has been penetration-tested.";

export const ENDPOINT_INJECTION_OUTPUT_REQUIREMENT_IDS = [
  "security.endpoint-test-injection-output.sql-injection-attempts",
  "security.endpoint-test-injection-output.stored-xss-content",
  "security.endpoint-test-injection-output.reflected-xss-content",
  "security.endpoint-test-injection-output.unsafe-markdown",
  "security.endpoint-test-injection-output.unsafe-html",
  "security.endpoint-test-injection-output.path-traversal",
  "security.endpoint-test-injection-output.header-injection",
  "security.endpoint-test-injection-output.log-injection",
  "security.endpoint-test-injection-output.unsafe-redirect-destinations",
  "security.endpoint-test-injection-output.ssrf-destinations",
  "security.endpoint-test-injection-output.spreadsheet-formula-content-in-exports",
  "security.endpoint-test-injection-output.external-api-responses-with-unexpected-values",
] as const;

export const OPEN_REDIRECT_REQUIREMENT_IDS = [
  "ROUTE.PUBLIC.no-open-redirect",
  "ROUTE.ACCOUNT.safe-auth-return",
  "GLOBAL.SEC.open-redirect",
] as const;

export type EndpointInjectionOutputRequirementId =
  | (typeof ENDPOINT_INJECTION_OUTPUT_REQUIREMENT_IDS)[number]
  | (typeof OPEN_REDIRECT_REQUIREMENT_IDS)[number];

type EndpointInjectionOutputEvidenceRecord = Readonly<{
  status: "verified";
  evidence: readonly string[];
}>;

const COMMON_EVIDENCE = [
  ENDPOINT_INJECTION_OUTPUT_EVIDENCE_FILE,
  ENDPOINT_INJECTION_OUTPUT_TEST_FILE,
] as const;

function verified(
  ...evidence: readonly string[]
): EndpointInjectionOutputEvidenceRecord {
  return { status: "verified", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const ENDPOINT_INJECTION_OUTPUT_MASTER_EVIDENCE = {
  "security.endpoint-test-injection-output.sql-injection-attempts": verified(
    "scripts/check-production-sql-safety.ts",
    "scripts/check-production-sql-safety.test.ts",
    "security/sql-injection-control-evidence.test.ts",
  ),
  "security.endpoint-test-injection-output.stored-xss-content": verified(
    "security/xss-surface-review.ts",
    "security/xss-surface-evidence.test.ts",
    "src/lib/feed-validation.ts",
    "src/components/feed-post-card.tsx",
  ),
  "security.endpoint-test-injection-output.reflected-xss-content": verified(
    "src/lib/auth-callback-recovery.ts",
    "src/app/auth/error/page.tsx",
    "src/lib/auth-callback-recovery.test.ts",
  ),
  "security.endpoint-test-injection-output.unsafe-markdown": verified(
    "security/xss-surface-evidence.test.ts",
    "src/lib/feed-validation.ts",
    "src/components/feed-post-card.tsx",
  ),
  "security.endpoint-test-injection-output.unsafe-html": verified(
    "security/xss-surface-evidence.test.ts",
    "src/lib/content.ts",
    "src/lib/feed-validation.ts",
  ),
  "security.endpoint-test-injection-output.path-traversal": verified(
    "src/lib/media-validation.ts",
    "src/lib/media-service.ts",
    "src/lib/media-service.test.ts",
  ),
  "security.endpoint-test-injection-output.header-injection": verified(
    "src/lib/http-header-security.ts",
    "src/lib/http-header-security.test.ts",
    "security/header-injection-control-evidence.test.ts",
  ),
  "security.endpoint-test-injection-output.log-injection": verified(
    "src/lib/logger.ts",
    "src/lib/logger.test.ts",
    "security/injection-surface-control-evidence.test.ts",
  ),
  "security.endpoint-test-injection-output.unsafe-redirect-destinations": verified(
    "src/lib/workos-redirect.ts",
    "src/lib/workos-redirect.test.ts",
  ),
  "security.endpoint-test-injection-output.ssrf-destinations": verified(
    "src/lib/link-preview.ts",
    "src/lib/link-preview.test.ts",
    "security/ssrf-control-evidence.test.ts",
  ),
  "security.endpoint-test-injection-output.spreadsheet-formula-content-in-exports": verified(
    "src/lib/user-export-policy.ts",
    "src/lib/user-export-policy.test.ts",
    "src/app/api/users/me/export/route.ts",
    "src/app/api/users/me/export/route.test.ts",
  ),
  "security.endpoint-test-injection-output.external-api-responses-with-unexpected-values": verified(
    "src/lib/live/raw-sanitizer.ts",
    "src/lib/live/raw-sanitizer.test.ts",
    "src/lib/remote-response.ts",
    "src/lib/remote-response.test.ts",
  ),
  "ROUTE.PUBLIC.no-open-redirect": verified(
    "src/lib/workos-redirect.ts",
    "src/lib/workos-redirect.test.ts",
    "src/app/sign-in/route.ts",
    "src/app/callback/route.ts",
  ),
  "ROUTE.ACCOUNT.safe-auth-return": verified(
    "src/lib/workos-redirect.ts",
    "src/lib/workos-redirect.test.ts",
    "src/app/sign-in/route.ts",
    "src/app/account/page.tsx",
  ),
  "GLOBAL.SEC.open-redirect": verified(
    "src/lib/workos-redirect.ts",
    "src/lib/workos-redirect.test.ts",
    "src/app/sign-in/route.ts",
    "src/app/callback/route.ts",
  ),
} as const satisfies Readonly<
  Record<
    EndpointInjectionOutputRequirementId,
    EndpointInjectionOutputEvidenceRecord
  >
>;

export const ENDPOINT_INJECTION_OUTPUT_EXPECTED_GAIN =
  ENDPOINT_INJECTION_OUTPUT_REQUIREMENT_IDS.length +
  OPEN_REDIRECT_REQUIREMENT_IDS.length;
