import type { DesignLabPreproductionRequirement } from "./design-lab-preproduction-requirements";

export const DESIGN_LAB_DATABASE_NORMALIZATION_MILESTONES = ["M0", "M1", "M2", "M3"] as const;
export type DesignLabDatabaseNormalizationMilestone = (typeof DESIGN_LAB_DATABASE_NORMALIZATION_MILESTONES)[number];

type DesignLabDatabaseNormalizationRequirementCommon = Omit<
  DesignLabPreproductionRequirement,
  "system" | "status" | "evidence" | "tests" | "operatorCommands" | "releaseBlocking"
> & {
  system: "database";
  milestone: DesignLabDatabaseNormalizationMilestone;
  mandatoryBefore50k: boolean;
  passCriteria: readonly [string, ...string[]];
};

type DesignLabDatabaseNormalizationEvidenceState =
  | {
      status: "not-verified";
      evidence: readonly [];
      tests: readonly [`PLACEHOLDER TEST: ${string}`];
      operatorCommands: readonly [`PLACEHOLDER OPERATOR STEP: ${string}`];
    }
  | {
      status: "partially-verified";
      evidence: readonly [string, ...string[]];
      tests: readonly [string, ...string[]];
      operatorCommands: readonly [string, ...string[]];
    };

// Launch blockers retain the base contract's literal `true`; later items use `false`.
export type DesignLabDatabaseNormalizationRequirement =
  DesignLabDatabaseNormalizationRequirementCommon &
    DesignLabDatabaseNormalizationEvidenceState &
    (
      | Pick<DesignLabPreproductionRequirement, "releaseBlocking">
      | { releaseBlocking: false }
    );

// Gates remain fail-closed; accepted subset evidence may only justify partial status.
export const DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS = [
  {
    id: "PREPROD.DB.NORMALIZATION.M0.ASSUMPTION_REGISTER",
    system: "database",
    milestone: "M0",
    mandatoryBefore50k: true,
    requirement:
      "Record the canonical facts, consistency rules, retention rules, timezone rules and accepted denormalizations before changing the schema.",
    simulationContract:
      "Review the register against the current Prisma schema and synthetic staging model without reading or mutating production data.",
    passCriteria: [
      "Every canonical fact, consistency requirement, retention rule, timezone rule and accepted denormalization has a stable identifier.",
      "Every unknown has an owner, validation method and due milestone, with Principal DBRE and AppSec approval recorded.",
    ],
    status: "not-verified",
    owner: "Principal DBRE",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate assumption-register field and approval coverage from a reviewed source artifact.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture the reviewed register in an immutable non-production evidence bundle.",
    ],
    remainingEvidence:
      "Create the versioned register, assign every unknown and capture Principal DBRE and AppSec review.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M0.VIOLATION_BASELINE",
    system: "database",
    milestone: "M0",
    mandatoryBefore50k: true,
    requirement:
      "Measure every known normalization and integrity violation against representative staging before remediation.",
    simulationContract:
      "Run approved read-only preflight queries against a representative synthetic or scrubbed staging dataset and bind results to its database fingerprint.",
    passCriteria: [
      "The immutable result records query hashes, database fingerprint, row counts and violating primary keys for every approved M1 violation class.",
      "Every M1 violation count is zero or links to an approved forward-only remediation migration with an accountable owner.",
    ],
    status: "not-verified",
    owner: "Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate complete preflight-query coverage and database-fingerprint binding.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture approved read-only preflight results from representative disposable staging.",
    ],
    remainingEvidence:
      "Run the approved preflight pack in representative staging and attach the immutable violation result.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M0.CANONICAL_FACT_ADRS",
    system: "database",
    milestone: "M0",
    mandatoryBefore50k: true,
    requirement:
      "Choose one source of truth for every duplicated mutable business fact before enforcing or removing projections.",
    simulationContract:
      "Trace current readers and writers in source and compare synthetic state transitions without changing deployed behavior.",
    passCriteria: [
      "ADRs choose one canonical source for organization authority, subscription access, listing location and type, message read and block state, ownership state, archive semantics and status history.",
      "Every retained projection has exactly one named writer and one reconciliation rule with an explicit drift threshold.",
    ],
    status: "not-verified",
    owner: "Backend Lead and Product Domain Owner",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate canonical-fact ADR coverage and single-writer assignments.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: record approved canonical-fact decisions in the candidate evidence bundle.",
    ],
    remainingEvidence:
      "Approve the canonical-fact ADRs and assign every retained projection to one writer and reconciler.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M0.ONLINE_MIGRATION_PLAN",
    system: "database",
    milestone: "M0",
    mandatoryBefore50k: true,
    requirement:
      "Plan every M1 remediation as a forward-only, bounded-lock, mixed-version-safe database change.",
    simulationContract:
      "Exercise expand, backfill, validate and contract phases only in disposable production-scale staging with a documented fail-forward path.",
    passCriteria: [
      "Every M1 change has an expand, bounded backfill, validation, contract and fail-forward step with an owner and abort threshold.",
      "The Result and Runner paths use concurrent indexes and deferred constraint validation where supported, without an unbounded table rewrite.",
      "Production-scale staging stays within the approved lock timeout and statement budget while old and new application versions coexist.",
    ],
    status: "not-verified",
    owner: "Database Reliability Engineer and SRE",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate migration phases, lock budgets and mixed-version compatibility in disposable staging.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture the approved online-migration rehearsal and fail-forward review.",
    ],
    remainingEvidence:
      "Write and rehearse each forward-only migration plan against a representative production-scale fixture.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.TENANT_MEMBERSHIP_RLS",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Authorize tenant database access only through an active membership state.",
    simulationContract:
      "Use synthetic owner, administrator, active member, invited member, suspended member, revoked member and outsider actors in isolated staging.",
    passCriteria: [
      "The RLS actor matrix permits only active memberships for organization reads and writes and denies invited, suspended, revoked, stale and outsider rows.",
      "Direct database and application-path authorization tests pass for owner, administrator, member, outsider and service roles without a fail-open case.",
    ],
    status: "not-verified",
    owner: "Application Security Engineer and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: exercise the complete tenant-membership RLS actor matrix in isolated staging.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture RLS policy digests and redacted actor-matrix outcomes.",
    ],
    remainingEvidence:
      "Implement active-state authorization and capture direct database plus application-path denial evidence.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.ORGANIZATION_AUTHORITY",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Make organization ownership and membership authority follow one canonical atomic rule.",
    simulationContract:
      "Exercise ownership transfers and membership status transitions with synthetic organizations in two independent staging sessions.",
    passCriteria: [
      "The organization-owner and membership-authority drift query returns zero rows.",
      "An invalid owner transfer or membership transition is rejected atomically, and concurrent sessions cannot create an owner without the required active membership.",
    ],
    status: "not-verified",
    owner: "Backend Lead and Application Security Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate organization authority drift and concurrent ownership transitions.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture synthetic authority-transition outcomes from disposable staging.",
    ],
    remainingEvidence:
      "Choose the canonical authority rule, remediate drift and prove atomic transfer and status behavior.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.RACING_LINEAGE",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Enforce race, runner, result and form-entry lineage without contradictory race identities.",
    simulationContract:
      "Backfill and validate the lineage on a production-scale synthetic racing fixture before enabling constraints.",
    passCriteria: [
      "Result runner-to-race mismatches and orphan FormEntry race references both equal zero.",
      "A mismatched runner and race pair is rejected with SQLSTATE 23503, and one dog cannot occupy multiple boxes in one race.",
      "The forward migration replays successfully against a fixture representative of 5.6 million Result and 6.4 million Runner rows.",
    ],
    status: "not-verified",
    owner: "Racing Data Lead and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate racing lineage, uniqueness and production-scale migration replay.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture bounded racing-lineage validation from disposable staging.",
    ],
    remainingEvidence:
      "Backfill race lineage, add the reviewed constraints and capture zero-drift plus scale-replay evidence.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.IMPORT_IDENTITIES",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Give imported tracks and trainers stable provider identities that cannot duplicate under concurrent ingestion.",
    simulationContract:
      "Replay the same synthetic provider records through two independent importer sessions without contacting a live provider.",
    passCriteria: [
      "Track uses an approved canonical normalized or provider key, and Trainer uses an approved provider or licence identity rather than name alone.",
      "A two-session import race creates exactly one identity row; the losing session receives a controlled unique-conflict or upsert result.",
      "The duplicate identity scan returns zero rows.",
    ],
    status: "not-verified",
    owner: "Racing Data Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: replay concurrent track and trainer ingestion against synthetic provider identities.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture two-session importer outcomes and duplicate-scan counts.",
    ],
    remainingEvidence:
      "Approve provider identity keys, backfill them and prove concurrent idempotent ingestion.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.NULLABLE_BUSINESS_KEYS",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Enforce singleton and active-row business keys even when nullable columns participate in uniqueness.",
    simulationContract:
      "Create competing synthetic CustomPage, invitation and price rows in independent staging sessions.",
    passCriteria: [
      "Approved partial or expression unique constraints enforce one non-dog CustomPage and one active invitation or catalog price for each canonical key.",
      "Two concurrent creates produce exactly one row, with the losing session receiving SQLSTATE 23505 or an equivalent controlled conflict.",
      "Every pre-existing duplicate scan returns zero rows.",
    ],
    status: "not-verified",
    owner: "Backend Lead and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: exercise nullable business keys with two independent staging sessions.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture duplicate scans and controlled-conflict outcomes.",
    ],
    remainingEvidence:
      "Backfill duplicate business keys, add reviewed uniqueness rules and capture concurrency evidence.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.BILLING_LINEAGE",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Bind billing, usage and entitlement records to one canonical customer-to-user lineage.",
    simulationContract:
      "Exercise valid and cross-user synthetic billing graphs in isolated provider test mode and staging database sessions.",
    passCriteria: [
      "Customer, subscription, invoice, payment, refund, credit, usage and entitlement identifiers resolve through exactly one canonical customer-to-user chain.",
      "Cross-user and cross-customer writes are rejected, the lineage mismatch query returns zero rows and entitlement tests cannot elevate another user.",
    ],
    status: "not-verified",
    owner: "Billing Engineer and Application Security Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate canonical billing lineage and cross-user denial with synthetic records.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture redacted lineage checks from isolated billing staging.",
    ],
    remainingEvidence:
      "Choose the canonical billing chain, remediate mismatches and prove cross-user denial end to end.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.BILLING_DOMAINS",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Constrain price, usage, outbox and billing-event domains so invalid values and duplicate accounting cannot persist.",
    simulationContract:
      "Use synthetic catalog, usage and event records in isolated staging, including duplicate delivery and invalid boundary cases.",
    passCriteria: [
      "Exactly one active catalog price exists for each approved key, and amount, quantity, retry, status, interval and currency domains are enforced.",
      "Usage buckets use one idempotent unique key with valid periods; invalid writes return SQLSTATE 23514 or 23505.",
      "Duplicate usage-event delivery does not double-count the aggregate.",
    ],
    status: "not-verified",
    owner: "Billing Engineer and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate billing-domain boundaries, usage idempotency and duplicate delivery.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture isolated catalog and usage constraint outcomes.",
    ],
    remainingEvidence:
      "Add the approved billing checks and idempotency keys, then capture invalid-write and duplicate-delivery evidence.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.CUSTOM_DESIGN_ORDERS",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Enforce buyer, administrator, payment, money and lifecycle integrity for custom design orders.",
    simulationContract:
      "Exercise synthetic buyers, administrators and provider test payments without using real customer or payment data.",
    passCriteria: [
      "Buyer profile, buyer user and assigned administrator references are valid, and buyer-pair consistency rejects cross-user records.",
      "Provider payment identity is unique and idempotent; amount, currency, status and lifecycle timestamps reject invalid states.",
      "Orphan and cross-user scans both return zero rows.",
    ],
    status: "not-verified",
    owner: "Billing Engineer and Backend Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate custom-design order references, money domains and payment idempotency.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture isolated custom-design order constraint outcomes.",
    ],
    remainingEvidence:
      "Backfill order references, add reviewed constraints and prove provider-test idempotency plus cross-user denial.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.MONEY_CURRENCY",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Store authoritative monetary values exactly with an explicit approved currency domain.",
    simulationContract:
      "Round-trip synthetic minimum, maximum and fractional boundary cases through application and database staging paths.",
    passCriteria: [
      "No authoritative price field uses Float; every price uses integer minor units or an approved exact Decimal representation.",
      "The ISO-4217 currency casing and allowlist are enforced, and round-trip boundary tests preserve every value exactly.",
    ],
    status: "not-verified",
    owner: "Billing Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: round-trip exact money and approved currency boundary cases.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture exact-money migration and boundary-test evidence from disposable staging.",
    ],
    remainingEvidence:
      "Replace authoritative floating-point prices, backfill exact values and prove round-trip currency behavior.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.DELETION_EXPORT_SCOPE",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Make deletion and export subject, storage and lifecycle scope unambiguous at the database boundary.",
    simulationContract:
      "Exercise synthetic user and organization jobs plus incomplete storage pairs in isolated staging.",
    passCriteria: [
      "DeletionJob and ExportArtifact enforce the approved user-or-organization subject rule and require a complete storage-key pair.",
      "Size, hash and lifecycle checks reject invalid states, and the ambiguous-row scan returns zero rows.",
      "Deletion and export integration tests prove exact tenant scoping for every supported subject class.",
    ],
    status: "not-verified",
    owner: "Privacy Owner and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate deletion and export scope, storage pairs and tenant isolation.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture synthetic scope and lifecycle outcomes from isolated staging.",
    ],
    remainingEvidence:
      "Approve the subject rule, remediate ambiguous rows and prove database plus application tenant scoping.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.AUTH_CONFIG_DOMAINS",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Constrain authorization roles, access tiers and security-critical settings to typed fail-closed domains.",
    simulationContract:
      "Exercise allowed, unknown and malformed values with synthetic users and settings in isolated staging.",
    passCriteria: [
      "Profile role, subscription or access tier and every security-critical PlatformSetting key and value are allowlisted and typed.",
      "Unknown or malformed values fail closed, and moderator, administrator and fraud-gate authorization tests pass without privilege expansion.",
    ],
    status: "not-verified",
    owner: "Application Security Engineer and Backend Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate typed authorization and security-setting domains with malformed values.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture fail-closed authorization-domain outcomes from isolated staging.",
    ],
    remainingEvidence:
      "Define the allowlists, remediate unknown values and prove malformed configuration cannot relax authorization.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.IDENTITY_LEGAL_AUDIT",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Preserve canonical identity, legal attribution and authoritative audit integrity across deletion and mutation attempts.",
    simulationContract:
      "Use synthetic case-variant identities, deletion subjects and audit mutation attempts in isolated staging.",
    passCriteria: [
      "Canonical email uniqueness is case-insensitive, and case-variant duplicate creation is rejected with SQLSTATE 23505.",
      "Legal and audit subject attribution survives deletion according to policy, authoritative audit records are append-only and polymorphic subject pairs are complete.",
      "Duplicate-email, null-subject and audit-mutation negative tests all pass.",
    ],
    status: "not-verified",
    owner: "Application Security Engineer and Privacy Owner",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate case-insensitive identity, deletion attribution and append-only audit behavior.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture redacted identity and audit negative-test outcomes.",
    ],
    remainingEvidence:
      "Approve identity and retention rules, remediate ambiguous subjects and capture append-only negative tests.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.LOCAL_REFERENCES",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Protect local identifiers with referential and same-scope constraints instead of unchecked string references.",
    simulationContract:
      "Exercise synthetic pedigree, media, supersession, requester, resolver, creator, administrator and read-message references in isolated staging.",
    passCriteria: [
      "Every approved local identifier has a foreign key or a documented immutable-external-identifier exception.",
      "Same-owner, same-conversation, no-self and no-cycle rules are enforced where applicable, and every orphan scan returns zero rows.",
      "Invalid references are rejected with SQLSTATE 23503 or 23514 as appropriate.",
    ],
    status: "not-verified",
    owner: "Backend Lead and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate local-reference integrity and same-scope negative cases.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture orphan scans and direct-database rejection outcomes.",
    ],
    remainingEvidence:
      "Classify each raw identifier, backfill local references and prove all approved scope invariants.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M1.WEBHOOK_PAYLOAD_BOUNDS",
    system: "database",
    milestone: "M1",
    mandatoryBefore50k: true,
    requirement:
      "Bound untrusted webhook and upload payloads before buffering, persistence or expensive processing.",
    simulationContract:
      "Send synthetic boundary and oversize bodies only to an isolated staging endpoint with redacted logging enabled.",
    passCriteria: [
      "Every public webhook and upload route has explicit edge and application byte limits enforced before full buffering.",
      "An oversize request returns a controlled 413 without creating a database or object record, and the bounded-memory load test stays within its approved limit.",
      "Only policy-approved exact signed raw bytes and hashes are retained, and logs contain no credential or payload secret.",
    ],
    status: "not-verified",
    owner: "Application Security Engineer and Billing Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: exercise webhook and upload size boundaries with synthetic payloads in isolated staging.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture size-limit, bounded-memory and redaction outcomes.",
    ],
    remainingEvidence:
      "Define route limits, implement pre-buffer rejection and capture oversize, memory and redaction evidence.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M2.PROJECTION_DRIFT",
    system: "database",
    milestone: "M2",
    mandatoryBefore50k: true,
    requirement:
      "Prevent mutable denormalized projections from drifting from their canonical facts.",
    simulationContract:
      "Exercise synthetic writes, retries and repair jobs across every retained projection in isolated staging.",
    passCriteria: [
      "Listing location and type, DogOwnership state, message read state, conversation block state, subscription entitlement and current-status projections each have one transactional writer or transactional outbox.",
      "Every drift counter equals zero in two consecutive gate runs, and each repair operation is idempotent under duplicate delivery.",
    ],
    status: "not-verified",
    owner: "Backend Lead and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: exercise projection writes, drift scans and idempotent repair in isolated staging.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture two consecutive projection-drift gate results.",
    ],
    remainingEvidence:
      "Assign one writer per projection, implement reconciliation and capture two zero-drift gate runs.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M2.RATE_LIMIT_BACKEND",
    system: "database",
    milestone: "M2",
    mandatoryBefore50k: true,
    requirement:
      "Keep production rate limiting out of a single unbounded PostgreSQL hot-row path.",
    simulationContract:
      "Exercise layered limits and dependency-loss behavior only with synthetic actors in authorized load staging.",
    passCriteria: [
      "Edge controls and a shared bounded limiter enforce IP, user, tenant and route policies without relying solely on the PostgreSQL UNLOGGED counter.",
      "Bypass and cost tests pass for every declared key, and loss of either the database counter or shared limiter enters the documented safe mode.",
    ],
    status: "not-verified",
    owner: "SRE and Application Security Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate layered rate limits, bypass resistance and dependency-loss safe mode.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture authorized non-production limiter and cost-control outcomes.",
    ],
    remainingEvidence:
      "Implement the bounded shared limiter and prove layered enforcement plus safe dependency-loss behavior.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M2.HOT_ROWS_GROWTH",
    system: "database",
    milestone: "M2",
    mandatoryBefore50k: true,
    requirement:
      "Prove counters, aggregates and append-only growth stay inside database latency and capacity budgets.",
    simulationContract:
      "Run the approved 10x traffic model against representative disposable staging with cold-cache and retry cases.",
    passCriteria: [
      "The 10x load test keeps database p99 latency, lock wait, connection use and transaction rate within approved budgets.",
      "Append-only tables have measured retention and index strategies, alerts and explicit remediation thresholds before storage exhaustion.",
    ],
    status: "not-verified",
    owner: "Database Reliability Engineer and Performance Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: measure hot-row contention and append-only growth under the approved 10x staging model.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture authorized staging latency, lock, connection and growth metrics.",
    ],
    remainingEvidence:
      "Approve capacity budgets, run the representative 10x test and record retention plus remediation thresholds.",
    releaseBlocking: false,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M2.JSON_SEMANTICS",
    system: "database",
    milestone: "M2",
    mandatoryBefore50k: true,
    requirement:
      "Separate byte-exact signed evidence from validated queryable JSON and bound every payload class.",
    simulationContract:
      "Use synthetic valid, malformed, deep and oversize payloads in isolated staging without retaining sensitive values.",
    passCriteria: [
      "Every security or business-queryable payload uses a validated JSON or JSONB projection while signed raw evidence remains byte-exact and separately hashed.",
      "Every payload class has explicit byte, depth and retention limits; malformed and oversize writes are rejected.",
      "Required JSONB indexes are justified by representative query plans within the approved latency budget.",
    ],
    status: "not-verified",
    owner: "Backend Lead and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate JSON semantics, size and depth limits plus representative query plans.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture synthetic payload and query-plan outcomes from disposable staging.",
    ],
    remainingEvidence:
      "Classify payloads, define bounds and capture malformed, oversize and query-plan evidence.",
    releaseBlocking: false,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M2.AU_TIME_CONTRACT",
    system: "database",
    milestone: "M2",
    mandatoryBefore50k: true,
    requirement:
      "Classify dates, instants and local wall times so Australian timezone and daylight-saving behavior is unambiguous.",
    simulationContract:
      "Round-trip synthetic race, meeting and account timestamps across UTC and multiple Australian timezone fixtures.",
    passCriteria: [
      "Every temporal field is classified as an instant, date or local wall time with an explicit storage and display rule.",
      "Instants round-trip through UTC or timestamptz, dates remain DATE and daylight-saving plus multi-zone fixtures have zero ambiguous conversions.",
    ],
    status: "not-verified",
    owner: "Racing Data Lead and Backend Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: round-trip UTC, date, daylight-saving and multi-zone Australian fixtures.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture temporal-field classifications and timezone test outcomes.",
    ],
    remainingEvidence:
      "Classify every temporal field, migrate ambiguous types and capture Australian timezone boundary tests.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M2.PAIR_THREAD_INVARIANTS",
    system: "database",
    milestone: "M2",
    mandatoryBefore50k: true,
    requirement:
      "Enforce canonical participant pairs and safe parent-thread relationships at the database boundary.",
    simulationContract:
      "Use synthetic reversed pairs, self-relations and cross-thread parent links in two independent staging sessions.",
    passCriteria: [
      "Friendship and conversation participant pairs are canonicalized so reverse duplicates are impossible, including under concurrent creation.",
      "Self-blocks are rejected, and parent comments must be same-post, non-self and acyclic to the supported depth.",
      "Two-session and direct-database negative tests reject every invalid pair or thread state.",
    ],
    status: "not-verified",
    owner: "Backend Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate canonical pairs and parent-thread invariants in two staging sessions.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture concurrent pair and direct-database thread rejection outcomes.",
    ],
    remainingEvidence:
      "Backfill canonical pairs, add reviewed thread constraints and capture concurrent negative tests.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M2.REPLAY_RESTORE",
    system: "database",
    milestone: "M2",
    mandatoryBefore50k: true,
    requirement:
      "Prove normalization migrations replay, upgrade and restore without schema drift or undocumented operator knowledge.",
    simulationContract:
      "Run clean replay, representative upgrade and backup restoration only in disposable isolated environments.",
    passCriteria: [
      "Clean migration replay, representative upgrade, schema fingerprint comparison, backup restore and application smoke tests all pass with every deferred constraint validated.",
      "The restore meets approved RTO and RPO, and an engineer other than the migration author completes the documented procedure using immutable evidence.",
    ],
    status: "partially-verified",
    owner: "Database Reliability Engineer and SRE",
    evidence: [
      "scripts/check-local-dr-restore.ts",
      "output/production-readiness/local-dr/latest.json",
    ],
    tests: [
      "scripts/check-local-dr-restore.test.ts",
    ],
    operatorCommands: [
      "npm run check:local-dr-restore",
    ],
    remainingEvidence:
      "The source-bound disposable rehearsal covers clean replay and logical restore. Still capture a representative upgrade, application smoke, approved RTO/RPO, deferred-constraint validation and independent execution of the documented procedure.",
    releaseBlocking: true,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M3.LEGACY_IDENTITY_CONTRACTION",
    system: "database",
    milestone: "M3",
    mandatoryBefore50k: false,
    requirement:
      "Remove legacy actor identity fields only after the canonical SocialActor path has complete coverage and a safe rollback window.",
    simulationContract:
      "Observe source-static readers and writers plus synthetic drift runs before rehearsing a contract migration in disposable staging.",
    passCriteria: [
      "SocialActor migration coverage is 100 percent, no legacy writer or reader is observed for the approved window and identity drift remains zero.",
      "The contract migration is mixed-version safe and executes only after rollback-window and restore evidence is recorded.",
    ],
    status: "not-verified",
    owner: "Backend Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate legacy identity coverage, observation window and contract-migration compatibility.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture the post-launch contraction review without changing a live database.",
    ],
    remainingEvidence:
      "Reach full canonical actor coverage, observe the agreed zero-use window and rehearse the contract migration.",
    releaseBlocking: false,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M3.DUPLICATE_PROJECTION_CONTRACTION",
    system: "database",
    milestone: "M3",
    mandatoryBefore50k: false,
    requirement:
      "Remove undocumented duplicate mutable facts after canonical writers and reconciliation have stabilized.",
    simulationContract:
      "Trace readers and writers, observe synthetic drift and rehearse mixed-version contraction in disposable staging.",
    passCriteria: [
      "Every duplicate mutable fact is removed or formally retained as a projection with an owner, service-level target and reconciler.",
      "No undocumented dual write remains, and the contract deployment is mixed-version safe with a tested fail-forward path.",
    ],
    status: "not-verified",
    owner: "Backend Lead and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate duplicate-fact ownership and mixed-version contraction safety.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture the post-launch projection-contraction review in disposable staging.",
    ],
    remainingEvidence:
      "Complete the stable observation window, choose each contraction and rehearse mixed-version fail-forward behavior.",
    releaseBlocking: false,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M3.INDEX_PARTITION_REVIEW",
    system: "database",
    milestone: "M3",
    mandatoryBefore50k: false,
    requirement:
      "Add indexes or partitioning only when measured query plans, growth and retention behavior justify their write cost.",
    simulationContract:
      "Compare representative query plans and maintenance behavior on production-scale synthetic data in disposable staging.",
    passCriteria: [
      "Representative query plans and growth forecasts identify every missing or unused candidate index with measured evidence.",
      "Partitioning is adopted only after an approved threshold is exceeded, with before-and-after p95, p99 and write-amplification results recorded.",
    ],
    status: "not-verified",
    owner: "Database Reliability Engineer and Performance Lead",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: compare index and partition candidates on representative production-scale synthetic data.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: capture post-launch query-plan and write-amplification evidence.",
    ],
    remainingEvidence:
      "Collect representative plans and growth data, then approve only candidates that exceed recorded thresholds.",
    releaseBlocking: false,
  },
  {
    id: "PREPROD.DB.NORMALIZATION.M3.SHARDING_THRESHOLD",
    system: "database",
    milestone: "M3",
    mandatoryBefore50k: false,
    requirement:
      "Keep sharding deferred until simpler PostgreSQL scaling controls reach measured limits and an operating model exists.",
    simulationContract:
      "Review measured capacity and failure evidence without provisioning or changing any database topology.",
    passCriteria: [
      "The ADR records explicit reconsideration thresholds for vertical scale, connection pooling, read replicas, caching, archiving and partitioning.",
      "Sharding remains rejected until measured limits are exhausted and an accountable operational ownership, recovery and consistency model is approved.",
    ],
    status: "not-verified",
    owner: "Principal Architect and Database Reliability Engineer",
    evidence: [],
    tests: [
      "PLACEHOLDER TEST: validate sharding reconsideration thresholds against measured capacity evidence.",
    ],
    operatorCommands: [
      "PLACEHOLDER OPERATOR STEP: record the post-launch architecture decision without provisioning infrastructure.",
    ],
    remainingEvidence:
      "Define measurable reconsideration thresholds and retain the no-sharding decision until every prerequisite is met.",
    releaseBlocking: false,
  },
] as const satisfies readonly DesignLabDatabaseNormalizationRequirement[];
