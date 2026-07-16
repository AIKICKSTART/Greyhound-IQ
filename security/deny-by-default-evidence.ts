export const DENY_BY_DEFAULT_EVIDENCE_TEST =
  "security/deny-by-default-evidence.test.ts" as const;

export const DENY_BY_DEFAULT_REQUIREMENT_IDS = [
  "security.deny-by-default.policy",
  "security.deny-by-default.ownership",
  "security.deny-by-default.entitlement",
  "security.deny-by-default.verification",
  "security.deny-by-default.relationship",
  "security.deny-by-default.state",
  "security.deny-by-default.lookup-not-permission",
] as const;

export const DENY_BY_DEFAULT_EVIDENCE_SCOPE =
  "Deterministic source and pure-policy proof for the named authorization boundaries only: inactive or absent team authority, media ownership, unknown paid tiers, approved dog ownership, conversation participants and blocks, billing status transitions, and team invitation policy before persistence. It does not claim deployed-provider, full-route, browser, or cross-database runtime coverage.";

const COMMON_EVIDENCE = [
  "security/deny-by-default-evidence.ts",
  DENY_BY_DEFAULT_EVIDENCE_TEST,
  "src/lib/organization-team-policy.ts",
  "src/lib/organization-team-service.ts",
  "src/lib/media-service.ts",
  "src/lib/tier-access.ts",
  "src/lib/listing-service.ts",
  "src/lib/conversation-service.ts",
  "src/lib/billing/subscription-state-machine.ts",
] as const;

export const DENY_BY_DEFAULT_MASTER_EVIDENCE = Object.fromEntries(
  DENY_BY_DEFAULT_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: COMMON_EVIDENCE },
  ]),
);

export const DENY_BY_DEFAULT_EXPECTED_GAIN =
  DENY_BY_DEFAULT_REQUIREMENT_IDS.length;
