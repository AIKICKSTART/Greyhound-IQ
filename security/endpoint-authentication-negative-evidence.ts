export const ENDPOINT_AUTHENTICATION_NEGATIVE_EVIDENCE = [
  "src/app/sign-in/route.ts",
  "src/lib/workos-redirect.ts",
  "src/lib/workos-redirect.test.ts",
  "src/lib/request-security.ts",
  "src/lib/request-security.test.ts",
  "src/proxy.ts",
  "security/csrf-control-evidence.test.ts",
  "security/endpoint-authentication-negative-evidence.test.ts",
] as const;

export const ENDPOINT_AUTHENTICATION_NEGATIVE_REQUIREMENT_IDS = [
  "security.endpoint-test-authentication.unsafe-return-url",
  "security.endpoint-test-authentication.missing-csrf-protection",
  "security.endpoint-test-authentication.invalid-csrf-protection",
] as const;

export const ENDPOINT_AUTHENTICATION_NEGATIVE_BOUNDARY =
  "Source-static and executable local evidence only: the sole sign-in return target resolver rejects external, protocol-relative, encoded-separator, callback-loop and sign-in-loop destinations, while the shared proxy rejects cookie-authenticated mutations with missing same-origin evidence or invalid cross-origin evidence before authentication. This does not claim deployed WorkOS behavior, provider callback replay resistance, session revocation, or production traffic validation.";

export const ENDPOINT_AUTHENTICATION_NEGATIVE_MASTER_EVIDENCE =
  Object.fromEntries(
    ENDPOINT_AUTHENTICATION_NEGATIVE_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      {
        status: "verified" as const,
        evidence: ENDPOINT_AUTHENTICATION_NEGATIVE_EVIDENCE,
      },
    ]),
  );
