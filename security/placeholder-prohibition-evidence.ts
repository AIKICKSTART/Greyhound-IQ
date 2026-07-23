export const GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS = [
  "security.placeholder-prohibition.add-authentication-later",
  "security.placeholder-prohibition.check-permissions",
  "security.placeholder-prohibition.validate-input",
  "security.placeholder-prohibition.secure-this-endpoint",
  "security.placeholder-prohibition.add-rate-limits",
  "security.placeholder-prohibition.use-encryption",
  "security.placeholder-prohibition.handle-errors",
  "security.placeholder-prohibition.add-database-security",
  "security.placeholder-prohibition.review-the-webhook",
  "security.placeholder-prohibition.test-for-idor",
] as const;

export const SECURITY_CONTROL_REFERENCE_REQUIREMENT_IDS = [
  "security.placeholder-prohibition.exact-file",
  "security.placeholder-prohibition.exact-function",
  "security.placeholder-prohibition.exact-policy",
  "security.placeholder-prohibition.exact-query",
  "security.placeholder-prohibition.exact-schema",
  "security.placeholder-prohibition.exact-role",
  "security.placeholder-prohibition.exact-test",
  "security.placeholder-prohibition.exact-evidence",
  "security.placeholder-prohibition.exact-owner",
] as const;

export const OPEN_EXACT_CONTROL_REFERENCE_REQUIREMENT_IDS = [] as const;

export const GENERIC_SECURITY_PLACEHOLDER_EXPECTED_GAIN =
  GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS.length;

export const SECURITY_CONTROL_REFERENCE_EXPECTED_GAIN =
  SECURITY_CONTROL_REFERENCE_REQUIREMENT_IDS.length;

export const GENERIC_SECURITY_PLACEHOLDER_EVIDENCE_SCOPE =
  "Source-static absence of the ten exact generic placeholder directives in owned repository files, plus exhaustive registry proof that every canonical security trace and its linked database operation names exact source files, functions, policies, queries, schemas, database roles, tests, evidence and owners. The three formerly uncaptured database operations bind to hash-validated disposable query artifacts with 44 exact normalized statements; the two previously incomplete schema references bind to the local DesignLabSearchParams source and package-lock-pinned AuthKit 4.1.4 callback source. This does not verify control implementation, runtime behavior, provider or deployment boundaries.";

const GENERIC_SECURITY_PLACEHOLDER_EVIDENCE = [
  "security/placeholder-prohibition-evidence.ts",
  "security/placeholder-prohibition-evidence.test.ts",
  "security/database-query-captures.ts",
  "security/database-query-records.ts",
] as const;

export const GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE =
  Object.fromEntries(
    [
      ...GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS,
      ...SECURITY_CONTROL_REFERENCE_REQUIREMENT_IDS,
    ].map((requirementId) => [
      requirementId,
      {
        status: "verified" as const,
        evidence: GENERIC_SECURITY_PLACEHOLDER_EVIDENCE,
      },
    ]),
  );
