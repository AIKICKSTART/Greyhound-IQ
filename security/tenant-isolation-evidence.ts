export const TENANT_ISOLATION_EVIDENCE_FILE =
  "security/tenant-isolation-evidence.ts" as const;
export const TENANT_ISOLATION_TEST_FILE =
  "security/tenant-isolation-evidence.test.ts" as const;

export const VERIFIED_TENANT_ISOLATION_IDS = [
  "security.tenant-isolation.repository",
  "security.tenant-isolation.cache-key",
  "security.tenant-isolation.search",
  "security.tenant-isolation.exports",
  "security.tenant-isolation.jobs",
  "security.tenant-isolation.websocket",
  "security.tenant-isolation.same-id-test",
] as const;

export type VerifiedTenantIsolationId =
  (typeof VERIFIED_TENANT_ISOLATION_IDS)[number];

export const TENANT_ISOLATION_SCOPE =
  "Source and focused local-unit evidence for the current organization, user, conversation, export, account-deletion, and Realtime controls. It verifies organization-plus-user repository lookups; user-keyed private notification caching while the marketplace cache is restricted to active, approved public listings; participant-gated conversation search; current-user-scoped exports; user-bound storage-deletion jobs; participant-only Realtime grants; and a same-user/different-organization compound-key regression assertion. This does not claim a deployed cache inventory, database RLS runtime coverage, provider enforcement, production job-worker behavior, or deployment parity.";

const EVIDENCE: Record<VerifiedTenantIsolationId, readonly string[]> = {
  "security.tenant-isolation.repository": [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
    "src/lib/organization-team-service.ts",
    "security/organization-team-authorization-evidence.test.ts",
  ],
  "security.tenant-isolation.cache-key": [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
    "src/components/site-header.tsx",
    "src/lib/queries.ts",
    "src/lib/ttl-cache.ts",
  ],
  "security.tenant-isolation.search": [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
    "src/lib/conversation-service.ts",
  ],
  "security.tenant-isolation.exports": [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
    "src/lib/user-export-service.ts",
    "src/lib/user-export-policy.test.ts",
  ],
  "security.tenant-isolation.jobs": [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
    "src/lib/account-service.ts",
    "src/lib/account-deletion.test.ts",
  ],
  "security.tenant-isolation.websocket": [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
    "src/lib/realtime-service.ts",
    "src/lib/realtime-authorization.test.ts",
    "security/realtime-control-evidence.test.ts",
  ],
  "security.tenant-isolation.same-id-test": [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
    "src/lib/organization-team-service.ts",
    "security/organization-team-authorization-evidence.test.ts",
  ],
};

export const TENANT_ISOLATION_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_TENANT_ISOLATION_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: EVIDENCE[requirementId] },
  ]),
);

export const TENANT_ISOLATION_EXPECTED_GAIN =
  VERIFIED_TENANT_ISOLATION_IDS.length;
