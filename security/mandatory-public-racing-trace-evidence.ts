export const MANDATORY_PUBLIC_RACING_TRACE_BINDINGS = {
  "security.trace.01.homepage-read": "PUBLIC.HOME.READ",
  "security.trace.02.contact-submit": "SUPPORT.TICKET.CREATE",
  "security.trace.03.sign-in-start": "AUTH.SIGN_IN.START",
  "security.trace.05.signed-out-protected-route":
    "ACCOUNT.PROTECTED.SIGNED_OUT_DENY",
  "security.trace.06.race-search": "RACING.RACE.SEARCH",
  "security.trace.07.open-race": "RACING.RACE.OPEN",
  "security.trace.08.open-dog": "RACING.DOG.OPEN",
  "security.trace.09.open-track": "RACING.TRACK.OPEN",
  "security.trace.10.racing-provider-ingest": "RACING.PROVIDER.INGEST",
} as const;

export const MANDATORY_PUBLIC_RACING_TRACE_REQUIREMENT_IDS = Object.keys(
  MANDATORY_PUBLIC_RACING_TRACE_BINDINGS,
) as (keyof typeof MANDATORY_PUBLIC_RACING_TRACE_BINDINGS)[];

/**
 * Residuals are deliberately requirement-specific. The requirement evidence
 * verifies the source-to-output trace, not deployed runtime behavior.
 */
export const MANDATORY_PUBLIC_RACING_TRACE_RESIDUALS = {
  "security.trace.01.homepage-read": [
    "Representative-volume planning, production deployment parity, page-specific overload controls and query-failure telemetry remain unverified; the bounded source and disposable runtime-role SQL/plan evidence are captured separately.",
  ],
  "security.trace.02.contact-submit": [
    "No idempotency key, persisted audit event, byte-level request cap or safe support-specific log-envelope test is captured; the source-bound disposable runtime-role database transaction is verified separately.",
  ],
  "security.trace.03.sign-in-start": [
    "WorkOS runtime behavior, route-specific abuse limiting, safe provider-failure logging and deployed callback-origin parity are not captured.",
  ],
  "security.trace.05.signed-out-protected-route": [
    "Live WorkOS session/redirect integration, exact redirect status and safe identity-provider failure telemetry are not captured.",
  ],
  "security.trace.06.race-search": [
    "No per-IP/user page limiter, deployed-environment parity, representative-volume p99 benchmark or partial-degradation alert is captured; bounded source plus disposable runtime-role SQL/plan/RLS evidence is captured separately.",
  ],
  "security.trace.07.open-race": [
    "Representative production volume, deployed-environment parity, sustained-load p99, dependency circuit breaker/telemetry and a complete replay-provider runtime matrix remain unverified; bounded least-privilege projection plus disposable runtime-role SQL, plan and anonymous RLS evidence are captured separately.",
  ],
  "security.trace.08.open-dog": [
    "Representative production volume, deployed-role parity, page-specific overload controls, sustained-load p99 and dedicated query-failure telemetry remain unverified; bounded least-privilege projection plus disposable runtime-role SQL, plan and cross-profile RLS evidence are captured separately.",
  ],
  "security.trace.09.open-track": [
    "Representative-volume plans, deployed-role parity, page-specific overload controls and a sustained-load p99 result are not captured.",
  ],
  "security.trace.10.racing-provider-ingest": [
    "Provider identity and payload authenticity, disposable runtime-role database replay, transaction rollback, representative-volume throughput, deployed scheduler/secret parity and production alert delivery remain unverified.",
  ],
} as const satisfies Record<
  keyof typeof MANDATORY_PUBLIC_RACING_TRACE_BINDINGS,
  readonly string[]
>;

const COMMON_EVIDENCE = [
  "security/mandatory-public-racing-trace-evidence.ts",
  "security/mandatory-public-racing-trace-evidence.test.ts",
  "security/mandatory-public-racing-traces.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "security/traces.ts",
  "security/database-operations.ts",
] as const;

/**
 * These eight records close only the immutable mandatory-trace mapping gates.
 * The underlying SecurityTraceContract records remain Partially verified.
 */
export const MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE = {
  "security.trace.01.homepage-read": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/page.tsx",
      "src/lib/queries.ts",
      "scripts/check-home-race-meetings-postgres.ts",
      "output/database-audit/home-race-meetings-read.json",
      "src/components/screen-contracts/public-racing-user-stories.test.ts",
    ],
  },
  "security.trace.02.contact-submit": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/contact/page.tsx",
      "src/app/actions.ts",
      "src/lib/auth.ts",
      "src/lib/db-context.ts",
      "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
      "src/components/screen-contracts/screen-permission-evidence.test.ts",
    ],
  },
  "security.trace.03.sign-in-start": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/sign-in/route.ts",
      "src/lib/workos-redirect.ts",
      "src/lib/workos-redirect.test.ts",
    ],
  },
  "security.trace.05.signed-out-protected-route": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/account/notifications/page.tsx",
      "src/lib/auth.ts",
      "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts",
    ],
  },
  "security.trace.06.race-search": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/races/page.tsx",
      "src/lib/queries.ts",
      "src/lib/queries.test.ts",
      "scripts/check-race-search-postgres.ts",
      "scripts/check-race-search-postgres.test.ts",
      "output/database-audit/race-search-read.json",
      "src/components/search-filter-controls.test.ts",
    ],
  },
  "security.trace.07.open-race": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/races/[id]/page.tsx",
      "src/lib/queries.ts",
      "src/lib/live/race-replay.ts",
      "src/lib/live/thedogs-replay.ts",
      "src/lib/live/replay-proxy.ts",
      "src/lib/live/replay-proxy.test.ts",
      "scripts/check-race-detail-postgres.ts",
      "scripts/check-race-detail-postgres.test.ts",
      "output/database-audit/race-detail-read.json",
    ],
  },
  "security.trace.08.open-dog": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/dogs/[id]/page.tsx",
      "src/lib/queries.ts",
      "src/lib/pedigree.ts",
      "prisma/migrations/20260708230000_dog_ownership_verification/migration.sql",
      "scripts/check-dog-public-detail-postgres.ts",
      "scripts/check-dog-public-detail-postgres.test.ts",
      "output/database-audit/dog-public-detail.json",
      "scripts/check-rls-policies.ts",
    ],
  },
  "security.trace.09.open-track": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/tracks/[id]/page.tsx",
      "src/lib/queries.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
    ],
  },
  "security.trace.10.racing-provider-ingest": {
    status: "verified",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/api/internal/live-sync/route.ts",
      "src/app/api/internal/live-sync/route.test.ts",
      "src/lib/internal-auth.ts",
      "src/lib/scheduled-task-control.ts",
      "src/lib/live/provider.ts",
      "src/lib/live/provider-response-validation.test.ts",
      "src/lib/live/sync.ts",
      "security/scheduled-task-control-evidence.test.ts",
    ],
  },
} as const;
