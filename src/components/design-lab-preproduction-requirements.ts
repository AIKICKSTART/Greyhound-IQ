import { DESIGN_LAB_OPERATING_MODEL_GATE_IDS } from "./design-lab-operating-model";
import { DESIGN_LAB_DATA_FEED_GATES } from "./design-lab-data-feed-registry";
import { DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS } from "./design-lab-database-normalization-requirements";

export type DesignLabPreproductionSystem =
  | "database"
  | "data"
  | "data-feeds"
  | "racing"
  | "workos"
  | "stripe"
  | "advertising"
  | "api-security"
  | "cloud-storage"
  | "application-realtime"
  | "livekit"
  | "architecture"
  | "observability"
  | "capacity"
  | "durable-sql"
  | "experience-simulation"
  | "training-studio"
  | "content-operations"
  | "support-operations"
  | "migration"
  | "managed-staging"
  | "owner-access"
  | "mobile"
  | "promotion";

export type DesignLabPreproductionStatus =
  | "verified"
  | "partially-verified"
  | "not-verified"
  | "blocked";

export type DesignLabPreproductionRequirement = {
  id: string;
  system: DesignLabPreproductionSystem;
  requirement: string;
  simulationContract: string;
  status: DesignLabPreproductionStatus;
  owner: string;
  roles?: readonly string[];
  dependencies?: readonly string[];
  evidence: readonly string[];
  tests: readonly string[];
  operatorCommands: readonly string[];
  remainingEvidence: string;
  releaseBlocking: boolean;
};

type UnverifiedOperatingRequirementInput = Pick<
  DesignLabPreproductionRequirement,
  | "id"
  | "system"
  | "requirement"
  | "simulationContract"
  | "owner"
  | "roles"
  | "dependencies"
  | "remainingEvidence"
> & { releaseBlocking?: boolean };

/** Creates a fail-closed task that cannot receive completion credit yet. */
function defineUnverifiedOperatingRequirement(
  input: UnverifiedOperatingRequirementInput,
): DesignLabPreproductionRequirement {
  return {
    ...input,
    status: "not-verified",
    evidence: [],
    tests: [],
    operatorCommands: [],
    releaseBlocking: input.releaseBlocking ?? true,
  };
}

const DATABASE_NORMALIZATION_RELEASE_REQUIREMENTS =
  DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.flatMap(
    (requirement): DesignLabPreproductionRequirement[] =>
      requirement.releaseBlocking ? [requirement] : [],
  );

const DATA_FEED_RELEASE_REQUIREMENTS = DESIGN_LAB_DATA_FEED_GATES.map(
  (gate): DesignLabPreproductionRequirement => ({
    id: gate.id,
    system: "data-feeds",
    requirement: gate.title,
    simulationContract: gate.acceptanceCriteria.join(" "),
    status: gate.status,
    owner: gate.owner,
    evidence: gate.evidence,
    tests: [],
    operatorCommands: [],
    remainingEvidence: gate.acceptanceCriteria.join(" "),
    releaseBlocking: gate.releaseBlocking,
  }),
);

export const GREYHOUNDIQ_PRODUCTION_HOSTS = [
  "greyhoundsiq.com.au",
  "www.greyhoundsiq.com.au",
  "greyhoundsiq.com",
  "www.greyhoundsiq.com",
] as const;

export const GREYHOUNDIQ_DUAL_DOMAIN_CONTROLS = [
  "DNS ownership and intended records",
  "managed TLS certificate issuance and renewal monitoring",
  "external Application Load Balancer and Cloud CDN routing",
  "HTTP-to-HTTPS redirect",
  "Cloud Armor edge and backend policy coverage",
  "direct Cloud Run origin denial",
  "health checks and synthetic critical journeys",
  "safe TTL reduction and propagation observation",
  "recorded rollback values and an exercised rollback procedure",
  "post-cutover authentication, API and private-media validation",
] as const;

export const DESIGN_LAB_PREPRODUCTION_REQUIREMENTS: readonly DesignLabPreproductionRequirement[] = [
  {
    id: "PREPROD.DB.LOOPBACK_ONLY",
    system: "database",
    requirement:
      "Every local database command must fail closed before it can reach a non-loopback PostgreSQL host.",
    simulationContract:
      "Prisma, import and live-racing commands receive the same local PostgreSQL URL through DATABASE_URL, DIRECT_URL and DATABASE_IMPORT_URL.",
    status: "verified",
    owner: "Database security owner",
    evidence: [
      "scripts/local-database-policy.ts",
      "scripts/local-database.ts",
    ],
    tests: ["scripts/local-database-policy.test.ts"],
    operatorCommands: ["npm run db:local -- help"],
    remainingEvidence: "None for the loopback guard; runtime database parity is tracked separately.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.PRISMA_SCHEMA_PARITY",
    system: "database",
    requirement:
      "The Design Lab database must apply the exact checkout's Prisma schema and forward-only migrations and prove no schema drift.",
    simulationContract:
      "The same Prisma models, migrations, constraints, RLS policies, query context and transaction paths run locally.",
    status: "partially-verified",
    owner: "Database owner",
    evidence: [
      "prisma/schema.prisma",
      "prisma/migrations",
      "docker-compose.local-db.yml",
      "scripts/check-database-compatibility-inventory.ts",
      "scripts/audit-local-postgres-catalog.ts",
      "scripts/check-database-migration-replay.ts",
      "output/database-audit/migration-replay.json",
      "scripts/check-local-dr-restore.ts",
      "output/production-readiness/local-dr/latest.json",
      "docs/security/database-inventory.md",
      "docs/security/database-migration-replay.md",
    ],
    tests: [
      "scripts/check-migrations.ts",
      "scripts/check-db-context.ts",
      "scripts/check-database-compatibility-inventory.test.ts",
      "scripts/audit-local-postgres-catalog.test.ts",
      "scripts/check-database-migration-replay.test.ts",
      "scripts/check-local-dr-restore.test.ts",
    ],
    operatorCommands: [
      "npm run db:local:reset",
      "npx prisma validate",
      "npx prisma migrate status",
      "npm run check:migrations",
      "npm run check:db-context",
      "npm run audit:local-postgres-catalog",
      "npm run check:local-postgres-catalog-evidence",
      "npm run check:database-migration-replay",
      "npm run check:local-dr-restore",
    ],
    remainingEvidence:
      "The separate loopback replay and current-source disposable restore prove all 97 current migrations reproduce their isolated runtime-role catalogs with matching RLS and proof data, but final running Design Lab catalog parity and managed production compatibility remain separate. Capture the final source-bound Design Lab catalog, resolve historical checksum mismatches without rewriting applied migration history, compare unsupported PostgreSQL objects, and verify production version/collation/extensions/roles/grants separately.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DATA.PRODUCTION_COPY_DENIED",
    system: "data",
    requirement:
      "No Prisma model may copy rows directly from the production application database into Design Lab.",
    simulationContract:
      "All 107 models have an explicit provider-public, metadata-only, reference-seed, synthetic-only or local-derived source policy while productionDatabaseCopy remains DENY.",
    status: "verified",
    owner: "Privacy and database owner",
    evidence: [
      "security/local-data-policy.ts",
      "scripts/local-database.ts",
      "scripts/sync-live.ts",
      "src/lib/live/sync.ts",
      "scripts/seed-demo-route-fixtures.ts",
      "scripts/demo-route-fixture-contract.ts",
    ],
    tests: [
      "scripts/local-database-policy.test.ts",
      "src/lib/design-lab-local-data-policy.test.ts",
      "src/lib/demo-profile-fixture-contract.test.ts",
    ],
    operatorCommands: ["npx tsx src/lib/design-lab-local-data-policy.test.ts"],
    remainingEvidence:
      "None for production-copy denial; runtime database parity and provider-ingestion freshness are tracked separately.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DATA.SYNTHETIC_PRIVATE_FIXTURES",
    system: "data",
    requirement:
      "People, accounts, community, marketplace, billing, media, calls, support, administration and AI fixtures must be synthetic and idempotent.",
    simulationContract:
      "Use reserved demo-* IDs, .test identities, checked-in media and isolated provider identifiers without deleting provider-ingested racing rows.",
    status: "verified",
    owner: "Fixture and privacy owner",
    evidence: [
      "scripts/demo-route-fixture-contract.ts",
      "scripts/demo-route-fixture-evidence.ts",
      "scripts/seed-demo-route-fixtures.ts",
      "security/data-classification.ts",
      "docs/security/data-classification.md",
      "security/local-data-policy.ts",
      "output/database-audit/demo-fixture-idempotency.json",
    ],
    tests: [
      "src/lib/demo-profile-fixture-contract.test.ts",
      "src/lib/design-lab-local-data-policy.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    operatorCommands: ["npm run check:demo-fixture-idempotency"],
    remainingEvidence:
      "A repaired schema-v2 candidate now binds the exact source set and nine allowlisted byte-hashed assets, passes strict mutation tests and has a fresh disposable-runtime capture; independent adversarial re-review must accept it before the +1 is restored.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.RACING.SAME_INGESTION_CONTRACT",
    system: "racing",
    requirement:
      "Real public racing data must enter the local database through the same provider adapters, validation, sanitisation and Prisma upserts as production.",
    simulationContract:
      "db:local:sync-live injects only the loopback database URLs and delegates to syncLiveData; it never reads the production database.",
    status: "partially-verified",
    owner: "Racing data owner",
    evidence: ["scripts/local-database.ts", "scripts/sync-live.ts", "src/lib/live/sync.ts"],
    tests: ["scripts/local-database-policy.test.ts"],
    operatorCommands: ["npm run db:local:sync-live -- 31 all", "npm run db:local:status"],
    remainingEvidence:
      "Run an authorised bounded sync, record provider/source health and row counts, verify raw-field scrubbing and prove representative race, dog, track and result journeys.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.QUERY_TRACE_EVIDENCE",
    system: "database",
    requirement:
      "Every application database action must capture the actual normalized query, named bound parameters, role, tables/columns, predicates, bounds, plan and tests.",
    simulationContract:
      "Design Lab invokes the same server policy, service and Prisma repository path; query evidence contains no real values or credentials.",
    status: "partially-verified",
    owner: "Security trace owner",
    evidence: ["security/database-operations.ts", "security/traces.ts"],
    tests: ["security/registry.test.ts"],
    operatorCommands: ["npx tsx security/registry.test.ts"],
    remainingEvidence:
      "Expand the seed registry to every action and capture generated SQL, actual roles, EXPLAIN evidence, failure injection and negative authorization tests.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.API.STATIC_CONTRACT_AUDIT",
    system: "api-security",
    requirement:
      "Every deployed API must be represented in the source-derived OpenAPI contract and pass the pinned free Spectral OWASP static audit with all release-blocking findings resolved.",
    simulationContract:
      "Spectral analyses the exact candidate document without credentials or network targets; separately authorised negative tests use only localhost or isolated staging and remain mandatory because a static contract audit cannot prove server-side authorisation.",
    status: "partially-verified",
    owner: "API security owner",
    evidence: [
      "openapi.json",
      ".spectral.yaml",
      "scripts/harden-openapi-contract.mjs",
      "scripts/sync-openapi-rate-limits.ts",
      "security/rate-limits.ts",
      "src/lib/rate-limit-response.ts",
      "docs/security/openapi-static-audit.md",
    ],
    tests: [
      "security/rate-limits.test.ts",
      "src/lib/rate-limit-response-route-contract.test.ts",
      "scripts/sync-openapi-rate-limits.test.ts",
      "scripts/openapi-ruleset.test.mjs",
      "npx spectral lint openapi.json --ruleset .spectral.yaml --fail-severity error --format json",
    ],
    operatorCommands: [
      "npx spectral lint openapi.json --ruleset .spectral.yaml --fail-severity error --format json",
    ],
    remainingEvidence:
      "The 14 July 2026 Spectral 6.16.1 audit of SHA-256 26a56856a97ebfb7387cdf3f56ca5fd502eb639760a8f948ca59878359f936d2 reports zero errors and 163 warnings. Source AST parity proves 62 real limited API operations, the OpenAPI synchronizer binds only those operations to the shared runtime 429 contract, and the signed replay exception remains narrow and review-dated. Independent source-static review passed, including fail-closed import-provenance, stale-managed-response and missing-429 mutations. Immutable-candidate binding and authorised negative authorisation, input, replay, response-header, edge-limit and access-log-redaction tests remain required; 163 warnings remain tracked contract debt.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.WORKOS.LOCAL_CONTRACT",
    system: "workos",
    requirement:
      "WorkOS AuthKit must use an isolated non-production environment and exercise login, callback, session rotation, revocation, logout and safe return paths.",
    simulationContract:
      "The production AuthKit SDK and callback/sync code run locally with test users; browser-selected roles never become authoritative.",
    status: "partially-verified",
    owner: "Identity owner",
    evidence: ["src/app/callback/route.ts", "src/lib/workos-redirect.ts", "src/lib/workos-env.ts"],
    tests: ["src/lib/workos-redirect.test.ts", "src/lib/auth-callback-route-contract.test.ts"],
    operatorCommands: ["npm run check:auth-profile-sync", "npm run test:smoke"],
    remainingEvidence:
      "Capture a full isolated-provider browser journey, callback/origin configuration, cookie attributes, expiry, revocation, MFA/step-up decision and failure recovery.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.STRIPE.TEST_MODE_LIFECYCLE",
    system: "stripe",
    requirement:
      "Stripe test-mode Checkout, signed webhooks, duplicate/out-of-order delivery, settlement, cancellation, portal ownership and entitlement removal must pass.",
    simulationContract:
      "The same server routes and billing services run with test keys and test prices; return query parameters never grant payment state.",
    status: "partially-verified",
    owner: "Billing owner",
    evidence: [
      "src/lib/billing/stripe-service.ts",
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/billing/stripe-env.ts",
    ],
    tests: [
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
    ],
    operatorCommands: ["npm run check:payment-gates", "stripe listen --forward-to http://127.0.0.1:3000/api/webhooks/stripe"],
    remainingEvidence:
      "Run an isolated test subscription and portal journey, record safe event IDs, resend duplicates/out-of-order events and reconcile Stripe versus Lago authority.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.ADVERTISING.END_TO_END",
    system: "advertising",
    requirement:
      "The web MVP must prove advertiser and Marketplace-boost creation, approval, AUD pricing, Stripe payment, safe creative handling, frequency-capped delivery, reporting, refund and administrator kill-switch journeys end to end.",
    simulationContract:
      "Synthetic advertisers, sellers and members exercise the normalized data model, server-authoritative quote, signed idempotent Stripe events, ownership and tenant denial, media quarantine, delivery caps, privacy retention, reconciliation and emergency pause behavior without charging a live customer.",
    status: "not-verified",
    owner: "Advertising product and payments owner",
    roles: [
      "Advertiser",
      "Marketplace seller",
      "Member",
      "Advertising administrator",
      "Finance operator",
      "Security reviewer",
    ],
    dependencies: [
      "Normalized advertising schema",
      "Stripe test mode",
      "Cloud Storage creative quarantine",
      "Feed delivery service",
      "Audit logging",
    ],
    evidence: [
      "src/components/advertising-product-contract.ts",
      "src/components/design-lab-advertising-console.tsx",
    ],
    tests: ["src/components/advertising-product-contract.test.ts"],
    operatorCommands: [],
    remainingEvidence:
      "Implement the advertiser and seller screens, normalized persistence, server-side pricing and inventory, creative review/quarantine, Stripe test lifecycle, idempotent delivery and reporting; then prove cross-tenant denial, replay/out-of-order events, frequency caps, refunds, kill switches, load and recovery in protected staging.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.GCP.CLOUD_STORAGE",
    system: "cloud-storage",
    requirement:
      "Australian Cloud Storage must prove private buckets, server-generated object paths, short-lived signed access, cross-user denial, scan/quarantine, deletion and recovery using synthetic files.",
    simulationContract:
      "Local storage contracts use synthetic objects; protected GCP staging proves the selected Sydney/Melbourne bucket placement, workload identity, IAM, signed access, malware quarantine, lifecycle and recovery paths.",
    status: "not-verified",
    owner: "Media and storage owner",
    evidence: ["src/lib/supabase-storage.ts", "scripts/sql/storage-private-media-policies.sql"],
    tests: ["src/lib/media-service.test.ts", "src/lib/storage-paths.test.ts"],
    operatorCommands: ["npm run check:marketplace-safety", "npm run test:staging-load"],
    remainingEvidence:
      "The listed Supabase files are replacement inventory, not target proof. Implement the Cloud Storage adapter and Australian bucket policy, then capture workload-identity, uniform-access, cross-user, signed-expiry, upload-bound, scanner/quarantine, deletion, lifecycle, recovery and audit evidence in protected staging.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.GCP.APPLICATION_REALTIME",
    system: "application-realtime",
    requirement:
      "The Australian application realtime gateway must prove private topic grants, membership, expiry, block revocation, bounded reconnect, cursor recovery and regional failure while AlloyDB remains authoritative.",
    simulationContract:
      "Synthetic clients exercise the Cloud Run WebSocket gateway, AlloyDB transactional outbox, Australia-restricted Pub/Sub and separate regional Memorystore services without using LiveKit data channels for durable business state.",
    status: "not-verified",
    owner: "Realtime security owner",
    evidence: ["src/lib/realtime-service.ts", "scripts/sql/supabase-private-realtime-policies.sql"],
    tests: ["src/lib/realtime-authorization.test.ts", "scripts/check-comms-security.ts"],
    operatorCommands: ["npm run check:community-flow:realtime", "npm run check:comms-security"],
    remainingEvidence:
      "The listed Supabase files are replacement inventory, not target proof. Implement the outbox, Pub/Sub publisher/consumers, regional gateway and Redis fan-out; then prove authorization, cursor replay, duplicate handling, reconnect storms, queue lag, Redis loss, regional failover and the absence of Supabase Realtime from the final candidate.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.LIVEKIT.CALL_LIFECYCLE",
    system: "livekit",
    requirement:
      "LiveKit must prove scoped short-lived tokens, membership/block checks, voice/video/data transport, webhook authenticity, disconnect and cleanup.",
    simulationContract:
      "The same call-token route, LiveKit SDK, webhook route and call state machine run with isolated keys and synthetic participants.",
    status: "partially-verified",
    owner: "Calls owner",
    evidence: ["src/lib/call-token.ts", "src/app/api/livekit/webhook/route.ts", "deploy/livekit/livekit.yaml"],
    tests: ["scripts/check-call-token-permissions.ts", "scripts/check-livekit-browser-media.ts"],
    operatorCommands: ["npm run check:calls", "npm run check:livekit-connectivity", "npm run check:livekit-browser-media"],
    remainingEvidence:
      "Pin an isolated LiveKit instance and capture browser media, token claims, negative membership/block cases, webhook replay/out-of-order behaviour, TURN/network and cleanup.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.OBSERVABILITY.END_TO_END",
    system: "observability",
    requirement:
      "Logs, metrics, traces, health checks, alerts, owners, runbooks and notification delivery must be exercised end to end without recording private values.",
    simulationContract:
      "The protected candidate emits synthetic correlation and trace IDs through app, database, webhook and job lanes and verifies redaction and alert recovery.",
    status: "not-verified",
    owner: "SRE owner",
    evidence: [
      "scripts/gcp-monitoring-setup.sh",
      "src/app/api/health/ready/route.ts",
      "config/slo-alert-policy.json",
      "docs/architecture/slo-alert-policy.md",
    ],
    tests: [
      "scripts/smoke-production.ts",
      "scripts/staging-load-probe.ts",
      "scripts/check-slo-alert-policy.test.ts",
    ],
    operatorCommands: [
      "npm run test:smoke",
      "npm run test:staging-load",
      "npm run check:slo-alert-policy",
    ],
    remainingEvidence:
      "Create a non-production monitoring setup, remove hard-coded production assumptions, prove alert delivery/runbooks/retention/redaction and bind evidence to the candidate.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.ARCHITECTURE.RESILIENCE_EVIDENCE",
    system: "architecture",
    requirement:
      "The selected Australia production topology must prove origin isolation, bounded 3× and 10× load behaviour, N-1 capacity, database failover and restore, cache loss, queue recovery, alert delivery, incident controls and Melbourne regional recovery.",
    simulationContract:
      "The exact immutable candidate runs in an isolated production-like Sydney/Melbourne staging topology with synthetic identities and data; every test records environment, timestamp, source SHA, image/config digest, assumptions, observed metrics, RTO/RPO and residual risk.",
    status: "not-verified",
    owner: "Principal architecture and SRE owner",
    evidence: [
      ".agents/skills/greyhoundiq-production-architecture/SKILL.md",
      "docs/architecture/greyhoundiq-production-architecture-report.html",
      "src/components/design-lab-architecture-plan.ts",
      "public/greyhoundiq-production-architecture.html",
      "config/gcp-architecture.json",
      "scripts/gcp-architecture-policy.ts",
      "scripts/staging-load-evidence.ts",
      "output/staging-load/latest.json",
      "scripts/check-local-production-load.ts",
      "output/production-readiness/local-load/latest.json",
      "scripts/check-local-dr-restore.ts",
      "output/production-readiness/local-dr/latest.json",
      "docs/architecture/gcp-provider-readiness-preflight.md",
      "scripts/check-gcp-provider-readiness.ts",
      "scripts/gcp-provider-readiness.ts",
      "output/gcp-provider-readiness/latest.json",
      "infra/terraform",
      "config/incident-response-controls.json",
      "docs/architecture/incident-response-controls.md",
      "src/lib/emergency-controls.ts",
      "src/app/api/dogs/search/route.ts",
      "src/app/api/media/sign-upload/route.ts",
      "src/app/api/users/me/export/route.ts",
      "src/app/api/agents/[type]/run/route.ts",
      "src/lib/agent-service.ts",
      "src/lib/dog-card-service.ts",
      ".github/workflows/cloud-run-deploy.yml",
      "scripts/gcp-cloud-run-deploy.ps1",
    ],
    tests: [
      "src/components/design-lab-architecture-lab.test.ts",
      "scripts/gcp-architecture-policy.test.ts",
      "scripts/staging-load-evidence.test.ts",
      "scripts/check-local-production-load.test.ts",
      "scripts/check-local-dr-restore.test.ts",
      "scripts/gcp-provider-readiness.test.ts",
      "infra/terraform/contract.test.mjs",
      "infra/terraform/private-datastore-policy.test.mjs",
      "scripts/check-incident-response-policy.test.ts",
      "src/lib/emergency-controls.test.ts",
    ],
    operatorCommands: [
      "npx tsx src/components/design-lab-architecture-lab.test.ts",
      "npm run test:staging-load",
      "npm run test:local-production-load",
      "npm run check:local-dr-restore",
      "npx tsx scripts/check-gcp-provider-readiness.ts",
      "npm run check:terraform-source",
      "npm run check:incident-response",
      "npm run check:design-lab-release -- --require-ready",
    ],
    remainingEvidence:
      "The source-bound local load and restore simulations, read-only provider preflight and Terraform source checks are prerequisites only. Approve the workload/SLO/RTO/RPO/cost assumptions, deploy the isolated Sydney/Melbourne staging topology, complete the 70-task architecture ledger and attach managed load, failure, restore, security, alert, incident and independent-review evidence for the exact immutable candidate.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.CAPACITY.50000_DAU",
    system: "capacity",
    requirement:
      "The release candidate must sustain the documented 50,000-daily-active-user workload model without breaching latency, error, database, queue, provider or cost budgets.",
    simulationContract:
      "Run staged read, write, realtime, upload and provider-degradation workloads against an isolated production-like stack using synthetic identities and data; never load-test production.",
    status: "not-verified",
    owner: "Performance and SRE owner",
    evidence: [
      "scripts/staging-load-probe.ts",
      "scripts/check-local-production-load.ts",
      "output/production-readiness/local-load/latest.json",
      "output/gcp-provider-readiness/latest.json",
    ],
    tests: [
      "scripts/staging-load-probe.ts",
      "scripts/check-local-production-load.test.ts",
      "scripts/gcp-provider-readiness.test.ts",
    ],
    operatorCommands: [
      "npm run test:staging-load",
      "npm run test:local-production-load",
      "npx tsx scripts/check-gcp-provider-readiness.ts",
    ],
    remainingEvidence:
      "The current-source local production-mode baseline, ramp, 3×, 10× and brief-soak public-route profiles are regression evidence only. Approve a peak-RPS and concurrency model, set p95/p99 and error SLOs, then capture managed staged authenticated, write, realtime, media, database-pool, query-plan, queue, provider-quota, autoscaling and cost evidence for the exact candidate.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.PG_DURABLE.EVALUATION",
    system: "durable-sql",
    requirement:
      "Do not adopt PG Durable SQL for the GreyhoundIQ MVP; retain Prisma against the planned AlloyDB for PostgreSQL production database as the sole source of truth.",
    simulationContract:
      "The MVP adds no PG Durable dependency, extension, background worker, schema object, queue or provider call. Any future evaluation must use a separate disposable lane and leave the planned Prisma + AlloyDB for PostgreSQL production path unchanged.",
    status: "verified",
    owner: "Database architecture owner",
    evidence: [
      "docs/architecture/pg-durable-design-lab-evaluation.md",
      "package.json",
      "package-lock.json",
      "prisma/schema.prisma",
      "src/lib/db.ts",
      "docker-compose.local-db.yml",
    ],
    tests: ["src/components/design-lab-preproduction-requirements.test.ts"],
    operatorCommands: [
      "npx tsx src/components/design-lab-preproduction-requirements.test.ts",
    ],
    remainingEvidence:
      "No PG Durable evidence remains for MVP because non-adoption is the approved outcome. Future adoption remains post-MVP and requires a separate version-compatible spike proving identity, RLS, retries, idempotency, restart recovery and operations before a new architecture decision.",
    releaseBlocking: true,
  },
  ...DATABASE_NORMALIZATION_RELEASE_REQUIREMENTS,
  ...DATA_FEED_RELEASE_REQUIREMENTS,
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.simulation,
    system: "experience-simulation",
    requirement:
      "Prove complete synthetic journeys for every role, state, failure, responsive breakpoint and accessibility contract.",
    simulationContract:
      "Local Design Lab uses deterministic synthetic fixtures; local PostgreSQL, gateway and CDN behavior remains simulation-only.",
    owner: "Product quality owner",
    roles: ["Product owner", "QA owner", "Accessibility reviewer"],
    dependencies: ["Role blueprints", "Synthetic fixtures", "Screen contracts"],
    remainingEvidence:
      "Attach candidate-bound journey, keyboard, screen-reader, viewport and negative-state evidence with no unresolved critical defects.",
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.training,
    system: "training-studio",
    requirement:
      "Produce governed training captures from source-bound manifests through Remotion and ElevenLabs with captions and editorial approval.",
    simulationContract:
      "Capture only deterministic synthetic or approved masked fixtures; never record live customer sessions or store narration credentials.",
    owner: "Training studio owner",
    roles: ["Training producer", "Privacy reviewer", "Accessibility reviewer"],
    dependencies: ["Approved scripts", "Capture manifests", "Synthetic fixtures"],
    remainingEvidence:
      "Verify every required manifest field, redaction review, source and asset digest, narration approval, captions and final human sign-off.",
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.content,
    system: "content-operations",
    requirement:
      "Prove CMS, blog and news authoring, review, schedule, publish, rollback, cache invalidation and audit workflows.",
    simulationContract:
      "Exercise scoped content roles with synthetic drafts locally, then prove selected managed cache behavior in protected staging.",
    owner: "Content operations owner",
    roles: ["Author", "Editor", "Publisher", "Auditor"],
    dependencies: ["Content role policy", "Cache contract", "Audit events"],
    remainingEvidence:
      "Capture authorization, preview, scheduled publish, rollback, cache purge, stale-content and immutable audit evidence.",
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.support,
    system: "support-operations",
    requirement:
      "Prove support, forum, Q&A and account export/deletion request queues with scoped authorization, privacy and SLA controls.",
    simulationContract:
      "Use synthetic identities and redacted evidence; standard staff may act only through assigned, policy-bounded queues.",
    owner: "Trust and support owner",
    roles: ["Support agent", "Moderator", "Privacy approver", "Auditor"],
    dependencies: ["Admin access policy", "Account-request workflows", "SLA alerts"],
    remainingEvidence:
      "Prove object-level authorization, escalation, export/deletion validation, moderation appeal, SLA alerting and PII-redacted audit records.",
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.observability,
    system: "observability",
    requirement:
      "Provide a unified read-only production operations and cost desk with SLO, incident, deployment, capacity and budget context.",
    simulationContract:
      "Exercise dashboards, alerts, runbooks and kill switches locally and in staging; production supplies redacted observation only.",
    owner: "SRE and FinOps owner",
    roles: ["On-call engineer", "Incident commander", "FinOps reviewer"],
    dependencies: ["SLO policy", "Budget policy", "Incident runbooks"],
    remainingEvidence:
      "Prove actionable alerts, multi-window burn rates, cost ceilings, source markers, read-only production access and first-safe-action runbooks.",
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.migration,
    system: "migration",
    requirement:
      "Build AlloyDB from forward-only migrations, seed synthetic private fixtures and rehydrate approved public racing data without customer-data migration, dual-write or Supabase database cutover machinery.",
    simulationContract:
      "Disposable local PostgreSQL proves empty bootstrap and deterministic fixtures; protected staging proves AlloyDB bootstrap, provider reconnect/replay, reconciliation, rollback and repeatability using no production customer rows.",
    owner: "Database bootstrap and racing-data owner",
    roles: ["Database engineer", "Racing-data owner", "Privacy reviewer", "Release owner"],
    dependencies: ["Forward migrations", "AlloyDB staging", "Provider contracts", "Rollback runbook"],
    remainingEvidence:
      "Prove an empty AlloyDB bootstrap, synthetic fixture idempotency, provider credentials through Secret Manager, bounded full and incremental provider replay, freshness/count/hash reconciliation, source outage recovery, rollback and repeated clean rebuild. Do not add snapshot, delta or dual-write machinery without a future customer dataset and a separate decision.",
  }),
  {
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.managedStaging,
    system: "managed-staging",
    requirement:
      "Prove the exact candidate on real protected-staging AlloyDB, ESPv2 gateway, external load balancer, Cloud Armor, CDN and Cloud Run paths.",
    simulationContract:
      "Local compatibility tests are prerequisites but cannot be relabelled as managed-service parity or production proof.",
    owner: "GCP platform owner",
    roles: ["Platform engineer", "SRE reviewer", "Security reviewer"],
    dependencies: ["Protected GCP staging", "Immutable candidate", "Evidence manifest"],
    status: "not-verified",
    evidence: [
      "docs/architecture/gcp-provider-readiness-preflight.md",
      "scripts/check-gcp-provider-readiness.ts",
      "scripts/gcp-provider-readiness.ts",
      "output/gcp-provider-readiness/latest.json",
      "infra/terraform",
      "scripts/check-local-production-load.ts",
      "output/production-readiness/local-load/latest.json",
      "scripts/check-local-dr-restore.ts",
      "output/production-readiness/local-dr/latest.json",
    ],
    tests: [
      "scripts/gcp-provider-readiness.test.ts",
      "infra/terraform/contract.test.mjs",
      "infra/terraform/private-datastore-policy.test.mjs",
      "scripts/check-local-production-load.test.ts",
      "scripts/check-local-dr-restore.test.ts",
    ],
    operatorCommands: [
      "npx tsx scripts/check-gcp-provider-readiness.ts",
      "npm run check:terraform-source",
      "npm run test:local-production-load",
      "npm run check:local-dr-restore",
    ],
    remainingEvidence:
      "The read-only preflight is blocked and the Terraform, load and restore results are source/local prerequisites only. Provision and independently review an isolated green project, then capture managed-service policy, origin isolation, load, failure, restore, autoscaling and cost evidence bound to the exact source and image digest.",
    releaseBlocking: true,
  },
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.ownerAccess,
    system: "owner-access",
    requirement:
      "Prove separated staff and founder control planes with no self-promotion and protected owner, destructive, spend and break-glass paths.",
    simulationContract:
      "Production remains read-only by default; JIT, reauthentication, phishing-resistant MFA, reason and immutable audit precede privileged actions.",
    owner: "Identity and platform owner",
    roles: ["Founder/platform owner", "Security approver", "Auditor"],
    dependencies: ["IAM design", "JIT workflow", "Break-glass runbook"],
    remainingEvidence:
      "Prove denial of self-promotion, two-person destructive/high-spend approval, automatic expiry, notification, audit and exercised break-glass recovery.",
  }),
  {
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileBoundary,
    system: "mobile",
    requirement:
      "Prove web, iOS/iPadOS, Android/tablet and shared backend remain separate source, build, signing and deployment boundaries.",
    simulationContract:
      "This repository tracks cross-product contracts and evidence only; native source, UI, signing and store credentials are prohibited here.",
    owner: "Mobile platform owner",
    roles: ["Web owner", "iOS owner", "Android owner", "API owner"],
    dependencies: ["Mobile architecture ADR", "Repository ownership", "Compatibility matrix"],
    status: "partially-verified",
    evidence: [
      "config/mobile-foundation-evidence.json",
      "src/components/design-lab-web-mobile-boundary.test.ts",
    ],
    tests: [
      "src/components/design-lab-mobile-foundation-evidence.test.ts",
      "src/components/design-lab-web-mobile-boundary.test.ts",
    ],
    operatorCommands: ["npm run check:mobile-foundation-evidence"],
    remainingEvidence:
      "Post-MVP: the web candidate has a fail-closed native, dependency, signing-artifact, import and workflow boundary check. Before native delivery starts, bind clean exact-commit remote CI evidence and this web-side result into one cross-repository attestation, then independently attest the protected mobile signing/release environment. Provider, store and real-device proof remain separate native gates.",
    releaseBlocking: false,
  },
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileIdentity,
    system: "mobile",
    requirement:
      "Prove mobile OIDC authorization-code plus PKCE, system-browser deep links, secure tokens, revocation and APNs/FCM lifecycle controls.",
    simulationContract:
      "Use synthetic accounts and non-secret provider fixtures locally; real callback and notification paths are proven only in protected staging and test tracks.",
    owner: "Mobile identity owner",
    roles: ["Mobile engineer", "Identity engineer", "Security reviewer"],
    dependencies: ["OIDC client registrations", "Universal/app links", "Notification environments"],
    remainingEvidence:
      "Post-MVP: prove redirect integrity, token rotation/revocation, Keychain/Keystore use, lost-device termination, notification consent and device-token removal.",
    releaseBlocking: false,
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRuntime,
    system: "mobile",
    requirement:
      "Prove offline, reconnect, background, media and API-compatibility behavior without threatening backend capacity or client availability.",
    simulationContract:
      "Deterministic simulators cover state transitions; protected staging proves retry budgets, reconnection storms and minimum-version kill switches.",
    owner: "Mobile reliability owner",
    roles: ["Mobile engineer", "API owner", "SRE reviewer"],
    dependencies: ["Compatibility matrix", "Retry policy", "Crash and ANR telemetry"],
    remainingEvidence:
      "Post-MVP: capture offline recovery, bounded retries, background transitions, interrupted media, old-client compatibility, remote halt, crash-free and ANR evidence.",
    releaseBlocking: false,
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRelease,
    system: "mobile",
    requirement:
      "Prove organisation-owned developer accounts, separated credentials, internal testing, staged rollout, rollback and reviewed store compliance.",
    simulationContract:
      "Design Lab records readiness only and cannot mutate Apple or Google accounts, credentials, listings, tracks or releases.",
    owner: "Mobile release owner",
    roles: ["Release manager", "Privacy reviewer", "Store compliance reviewer"],
    dependencies: ["Official store-policy review", "Organisation accounts", "Release runbooks"],
    remainingEvidence:
      "Post-MVP: verify current official privacy, deletion, moderation, accessibility and payment policies, then prove TestFlight/Play test tracks, staged rollout and halt/rollback.",
    releaseBlocking: false,
  }),
  defineUnverifiedOperatingRequirement({
    id: DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileDeviceEvidence,
    system: "mobile",
    requirement:
      "Bind simulator/emulator and real iPhone, iPad, Android phone and Android tablet evidence to the exact client and API candidates.",
    simulationContract:
      "Design Lab may index redacted evidence from external mobile pipelines but cannot build, sign, deploy or install native applications.",
    owner: "Mobile QA owner",
    roles: ["Mobile QA", "Accessibility reviewer", "Release reviewer"],
    dependencies: ["Device matrix", "Native candidate digests", "Protected staging API"],
    remainingEvidence:
      "Post-MVP: attach device/OS matrix, responsive and accessibility journeys, push/deep-link tests, crash evidence and candidate digests from simulator and real devices.",
    releaseBlocking: false,
  }),
  defineUnverifiedOperatingRequirement({
    id: "PREPROD.PROMOTION.DUAL_DOMAIN_CUTOVER",
    system: "promotion",
    requirement:
      "Every GreyhoundIQ apex and www hostname must pass the complete DNS, edge-security, TLS, routing, rollback and post-cutover journey before launch.",
    simulationContract: `For each of ${GREYHOUNDIQ_PRODUCTION_HOSTS.join(", ")}, prove ${GREYHOUNDIQ_DUAL_DOMAIN_CONTROLS.join("; ")}.`,
    owner: "DNS and release owner",
    roles: ["Release owner", "Platform engineer", "Security reviewer", "Daniel"],
    dependencies: [
      "Managed DNS ownership",
      "Global external Application Load Balancer",
      "Cloud CDN",
      "Cloud Armor",
      "Managed certificates",
      "Cutover and rollback runbook",
      "Daniel's explicit DNS and traffic-cutover approval",
    ],
    remainingEvidence:
      "Capture environment-bound evidence for every listed hostname and control, retain the prior healthy DNS targets, and obtain Daniel's explicit final approval before changing public DNS or cutting over traffic. The gate remains fail-closed until post-cutover authentication, API and private-media journeys pass and the timed rollback procedure is still executable.",
  }),
  {
    id: "PREPROD.PROMOTION.EVIDENCE_MANIFEST",
    system: "promotion",
    requirement:
      "A single expiring evidence manifest must bind every verified lane to the exact source SHA, immutable image, configuration and migration digests before production approval.",
    simulationContract:
      "Browser state cannot approve release; GitHub's protected production environment validates the evidence hash and promotes only the tested immutable candidate.",
    status: "partially-verified",
    owner: "Release owner",
    evidence: [
      "src/components/design-lab-release-gate.ts",
      "scripts/check-design-lab-release.ts",
      ".github/workflows/cloud-run-deploy.yml",
      "output/production-readiness/local-load/latest.json",
      "output/production-readiness/local-dr/latest.json",
      "output/gcp-provider-readiness/latest.json",
      "infra/terraform",
    ],
    tests: [
      "src/components/design-lab-release-workflow.test.ts",
      "scripts/check-local-production-load.test.ts",
      "scripts/check-local-dr-restore.test.ts",
      "scripts/gcp-provider-readiness.test.ts",
      "infra/terraform/contract.test.mjs",
      "infra/terraform/private-datastore-policy.test.mjs",
    ],
    operatorCommands: [
      "npm run test:local-production-load",
      "npm run check:local-dr-restore",
      "npx tsx scripts/check-gcp-provider-readiness.ts",
      "npm run check:terraform-source",
      "npm run check:design-lab-release -- --print-evidence-sha256",
      "npm run check:design-lab-release -- --require-ready",
    ],
    remainingEvidence:
      "The current local and provider-readiness artifacts are indexed but are not a promotion manifest. Add owners, independent reviewers, tested/expires timestamps, immutable image and configuration digests and zero Critical/High findings, then bind the final manifest digest to protected deployment approval.",
    releaseBlocking: true,
  },
];

export function isDesignLabPreproductionRequirementComplete(
  requirement: DesignLabPreproductionRequirement
) {
  return (
    requirement.status === "verified" &&
    requirement.evidence.length > 0 &&
    requirement.tests.some(
      (test) => !test.startsWith("PLACEHOLDER TEST: "),
    )
  );
}

export const DESIGN_LAB_PREPRODUCTION_SUMMARY = Object.freeze({
  total: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.length,
  complete: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    isDesignLabPreproductionRequirementComplete
  ).length,
  blocked: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) => requirement.status === "blocked"
  ).length,
  releaseTotal: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) => requirement.releaseBlocking,
  ).length,
  releaseComplete: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) =>
      requirement.releaseBlocking &&
      isDesignLabPreproductionRequirementComplete(requirement),
  ).length,
  releaseBlocked: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) =>
      requirement.releaseBlocking && requirement.status === "blocked",
  ).length,
  postMvpTotal: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) => !requirement.releaseBlocking,
  ).length,
  postMvpComplete: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) =>
      !requirement.releaseBlocking &&
      isDesignLabPreproductionRequirementComplete(requirement),
  ).length,
  systems: [
    ...new Set(
      DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.map(
        (requirement) => requirement.system
      )
    ),
  ],
});
