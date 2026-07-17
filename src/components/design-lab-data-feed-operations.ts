import {
  COMMON_DATA_FEED_UNKNOWNS,
  defineDataFeed,
  type DataFeedVerificationStatus,
  type DesignLabDataFeed,
} from "./design-lab-data-feed-contract";

type ReplayFeedInput = {
  id: string;
  providerKey: string;
  provider: string;
  source: string;
  sourceVersion: string;
  facts: readonly string[];
};

function replayFeed(input: ReplayFeedInput): DesignLabDataFeed {
  return defineDataFeed({
    id: input.id,
    providerKey: input.providerKey,
    provider: input.provider,
    source: input.source,
    transport: "Operator-triggered public replay audit/backfill.",
    jobPaths: ["scripts/backfill-race-videos.ts", "src/lib/live/race-replay.ts"],
    owner: { accountableRole: "Racing Media Data Steward", assignment: "proposed-not-confirmed" },
    auth: { sourceAuth: "Public source and database credential.", secretReferenceLabels: ["DATABASE_URL"] },
    dataClasses: ["race replay identifier", "page metadata", "stream/embed reference", "source status"],
    lineage: [input.source, "Resolver/parser -> RaceVideo keyed by race, provider and replay kind."],
    schemaContract: {
      canonicalContract: "RaceVideoReplayRecord and RaceVideo persistence contract.",
      sourceVersion: input.sourceVersion,
      validationState: "source-implemented-runtime-not-verified",
    },
    cadence: {
      sourceDeclaredTrigger: "Operator-triggered date-range backfill only.",
      intervalMinutes: [],
      refreshSlaMinutes: null,
      deploymentState: "unknown",
    },
    freshness: {
      signal: "RaceVideo.fetchedAt, lastSyncedAt, sourceStatus and coverage audit ratios.",
      degradedAfterMinutes: null,
      downAfterMinutes: null,
      thresholdState: "operator-unknown",
    },
    dependencies: ["base Race rows", "public replay source", "operator runner", "PostgreSQL"],
    downstreamJourneys: ["race replay", "results", "dog form video", "track history"],
    failureReasons: [
      "source_timeout",
      "source_unavailable",
      "schema_drift",
      "parse_failure",
      "partial_payload",
      "destination_unavailable",
      "reconciliation_mismatch",
      "licensing_hold",
      "unknown",
    ],
    reliability: {
      retries: "No shared automatic retry; per-item failures are counted and the script can be rerun.",
      backfill: "Date/state/provider filters, dry-run, missing-only mode and coverage audit are implemented.",
      reconciliation: "Race matching is provider-specific; ambiguous or missing matches are skipped.",
    },
    operations: {
      alert: "not-implemented",
      runbook: "not-implemented",
      sourceEvidence: [
        "scripts/backfill-race-videos.ts",
        ...(input.providerKey === "thedogs-replay"
          ? ["scripts/backfill-thedogs-race-videos.ts"]
          : []),
        "src/lib/live/race-replay.ts",
        "prisma/schema.prisma",
      ],
      runtimeEvidence: [],
    },
    governance: {
      pii: "Replay media is public racing content; no account PII should be persisted.",
      licensing: "Public reachability is not proof of redistribution or caching rights.",
      dataResidency: "External media may be served outside Australia; stored metadata residency is unverified.",
    },
    verifiedCodeFacts: input.facts,
    unknownOperatorMetadata: COMMON_DATA_FEED_UNKNOWNS,
  });
}

export const DESIGN_LAB_REPLAY_DATA_FEEDS = [
  replayFeed({
    id: "DATA.FEED.REPLAY.THEDOGS",
    providerKey: "thedogs-replay",
    provider: "The Dogs replays",
    source: "The Dogs public replay index, replay page and video-source response.",
    sourceVersion: "Unversioned HTML and provider response shapes.",
    facts: ["Host-pinned replay resolution and an authenticated same-origin stream capability are implemented."],
  }),
  replayFeed({
    id: "DATA.FEED.REPLAY.RACING_QUEENSLAND",
    providerKey: "racing-queensland",
    provider: "Racing Queensland replays",
    source: "Racing Queensland race-player pages and referenced replay media.",
    sourceVersion: "Unversioned HTML page and media-link pattern.",
    facts: ["Queensland tracks are mapped to provider codes before a replay page is resolved."],
  }),
  replayFeed({
    id: "DATA.FEED.REPLAY.TASRACING",
    providerKey: "tasracing",
    provider: "Tasracing replays",
    source: "Tasracing event/race JSON and public HLS replay objects.",
    sourceVersion: "Unversioned JSON; the default code path uses a test-named source host.",
    facts: ["Only public non-login replay angles are selected."],
  }),
  replayFeed({
    id: "DATA.FEED.REPLAY.GREYHOUNDS_WA",
    providerKey: "greyhoundswa",
    provider: "Greyhounds WA replays",
    source: "Greyhounds WA date-specific Vimeo showcases.",
    sourceVersion: "Unversioned showcase HTML and Vimeo metadata pattern.",
    facts: ["Dates with more than one possible WA track are skipped to prevent incorrect race matching."],
  }),
  replayFeed({
    id: "DATA.FEED.REPLAY.SA_RACE_REPLAY",
    providerKey: "sa-race-replay",
    provider: "SA Race Replay",
    source: "Exact-title matches from the SA Race Replay YouTube search surface.",
    sourceVersion: "Unversioned YouTube search HTML pattern.",
    facts: ["A replay is accepted only when the parsed title exactly matches the generated race title."],
  }),
] as const satisfies readonly DesignLabDataFeed[];

export const DESIGN_LAB_PEDIGREE_DATA_FEEDS = [
  defineDataFeed({
    id: "DATA.FEED.PEDIGREE.GALTD",
    providerKey: "galtd",
    provider: "Greyhounds Australasia Stud Book",
    source: "Operator-supplied public GALTD stud-book PDF or extracted text volume.",
    transport: "Local file parser and operator-triggered PostgreSQL import.",
    jobPaths: ["scripts/import-galtd-studbook.ts"],
    owner: { accountableRole: "Racing Data Steward", assignment: "proposed-not-confirmed" },
    auth: { sourceAuth: "Public document and database credential.", secretReferenceLabels: ["DATABASE_URL"] },
    dataClasses: ["registered dog", "sex", "colour", "whelp month", "owner name", "sire", "dam"],
    lineage: [
      "GALTD PDF/text volume -> parser records and parent links.",
      "Dog rows in the galtd namespace plus sire/dam relationships.",
    ],
    schemaContract: {
      canonicalContract: "DogRecord parser shape; volume is supplied by the operator.",
      sourceVersion: "Document volume is captured by input, but no persisted import schema version exists.",
      validationState: "source-implemented-runtime-not-verified",
    },
    cadence: {
      sourceDeclaredTrigger: "Operator-triggered when a reviewed volume is available.",
      intervalMinutes: [],
      refreshSlaMinutes: null,
      deploymentState: "unknown",
    },
    freshness: {
      signal: "No import-run ledger or last-success field exists for this source.",
      degradedAfterMinutes: null,
      downAfterMinutes: null,
      thresholdState: "operator-unknown",
    },
    dependencies: ["reviewed GALTD file", "pdftotext for PDF input", "operator runner", "PostgreSQL"],
    downstreamJourneys: ["dog pedigree", "breeding", "ancestry search"],
    failureReasons: [
      "schema_drift",
      "parse_failure",
      "partial_payload",
      "destination_unavailable",
      "duplicate_or_identity_conflict",
      "reconciliation_mismatch",
      "licensing_hold",
      "unknown",
    ],
    reliability: {
      retries: "No automatic retry; a dry run and idempotent duplicate-skipping import are available.",
      backfill: "Re-run the reviewed volume after parser or destination remediation.",
      reconciliation: "The code explicitly defers GALTD-to-The Dogs identity reconciliation to a separate pass.",
    },
    operations: {
      alert: "not-implemented",
      runbook: "not-implemented",
      sourceEvidence: ["scripts/import-galtd-studbook.ts", "prisma/schema.prisma"],
      runtimeEvidence: [],
    },
    governance: {
      pii: "Public owner names are personal information and require approved purpose, retention and deletion handling.",
      licensing: "Public-download availability is not production reuse approval.",
      dataResidency: "Input file, temporary extraction, database and backups require an approved AU-only policy.",
    },
    verifiedCodeFacts: [
      "PDF conversion is local and optional when pre-extracted text is supplied.",
      "Identity is a name slug in the galtd namespace; cross-provider collisions are accepted pending reconciliation.",
    ],
    unknownOperatorMetadata: COMMON_DATA_FEED_UNKNOWNS,
  }),
] as const satisfies readonly DesignLabDataFeed[];

export const DESIGN_LAB_DATA_FEED_DISCOVERY_GAPS = [
  "DataSourceHealth is keyed only by sourceProvider, so distinct live, profile, archive and replay pipelines cannot be tracked independently.",
  "Only admin mutations were found writing DataSourceHealth; ingestion jobs do not automatically record start, success, failure, latency or safe reason codes.",
  "Admin source health permits manual status changes, so it is not authoritative runtime evidence.",
  "No per-feed degraded/down thresholds, consecutive-failure policy, alert route or exercised runbook is implemented.",
  "The current aggregate freshness response cannot attribute stale data or failures to one pipeline.",
  "Provider source schemas, licences, SLAs, accountable people and AU storage/backup evidence are not approved in source.",
  "Composite live providers run together, so an uncaught provider failure can fail the whole scheduled sync.",
  "The dog-profile job is declared in one deployment script but omitted from the scheduler reconciliation script.",
  "Replay, archive and GALTD imports are operator-triggered and lack a shared server-side job/run ledger.",
] as const;

export type DesignLabDataFeedGate = {
  id: string;
  title: string;
  surface: "admin" | "design-lab" | "platform" | "governance";
  owner: string;
  releaseBlocking: true;
  acceptanceCriteria: readonly string[];
  evidence: readonly string[];
  status: DataFeedVerificationStatus;
};

export const DESIGN_LAB_DATA_FEED_GATES = [
  {
    id: "DATA.FEED.GATE.RUNTIME_INSTRUMENTATION",
    title: "Write authoritative per-feed runtime health",
    surface: "platform",
    owner: "Racing Data Platform and SRE",
    releaseBlocking: true,
    acceptanceCriteria: [
      "Every ingestion execution records stable feed ID, start, terminal outcome, latency, counts, freshness watermark and safe failure reason without credential or payload leakage.",
      "Manual admin annotations are separated from measured health, and a test proves one pipeline cannot overwrite another pipeline's state.",
    ],
    evidence: [],
    status: "not-verified",
  },
  {
    id: "DATA.FEED.GATE.FRESHNESS_ALERTS",
    title: "Approve freshness, degraded and down policies",
    surface: "platform",
    owner: "Racing Product, Data Platform and SRE",
    releaseBlocking: true,
    acceptanceCriteria: [
      "Every feed has approved source cadence, refresh SLA, degraded/down thresholds and a stated critical-journey impact.",
      "Synthetic missed schedules, stale data, schema drift, auth rejection, rate limits and timeouts produce the expected alert and recovery path.",
    ],
    evidence: [],
    status: "not-verified",
  },
  {
    id: "DATA.FEED.GATE.ADMIN_OBSERVABILITY",
    title: "Ship the read-only Admin data-feed operations desk",
    surface: "admin",
    owner: "Admin Product and SRE",
    releaseBlocking: true,
    acceptanceCriteria: [
      "Authorized admins can see every registry feed, last check/success/failure, freshness, latency, backlog, safe reason, dependencies and affected journeys from server-supplied values.",
      "The desk shows unknown rather than healthy when evidence is absent, exposes no secret or sensitive endpoint, and links each actionable state to an approved runbook.",
    ],
    evidence: [],
    status: "not-verified",
  },
  {
    id: "DATA.FEED.GATE.DESIGN_LAB_EVIDENCE",
    title: "Prove feed behavior in Design Lab",
    surface: "design-lab",
    owner: "Design Lab QA and Racing Data Platform",
    releaseBlocking: true,
    acceptanceCriteria: [
      "Deterministic fixtures cover every adapter's accepted, partial, malformed and changed schema without contacting production or storing private production rows.",
      "Healthy, degraded, down, recovery, backfill and reconciliation scenarios render from synthetic server snapshots and retain immutable evidence for the candidate commit.",
    ],
    evidence: [],
    status: "not-verified",
  },
  {
    id: "DATA.FEED.GATE.LINEAGE_RECONCILIATION",
    title: "Prove lineage, conflict priority and reconciliation",
    surface: "platform",
    owner: "Racing Data Steward and DBRE",
    releaseBlocking: true,
    acceptanceCriteria: [
      "Each run reports source, accepted, rejected, deduplicated and written counts with a sample trace from source ID to canonical destination and downstream aggregate.",
      "Provider priority, cross-provider identities, replay matching, late corrections and archive replay produce zero unexplained drift in an approved staging dataset.",
    ],
    evidence: [],
    status: "not-verified",
  },
  {
    id: "DATA.FEED.GATE.GOVERNANCE_OWNERSHIP",
    title: "Approve ownership, licensing, PII and residency",
    surface: "governance",
    owner: "Product Owner, Legal/Privacy and Security",
    releaseBlocking: true,
    acceptanceCriteria: [
      "Every feed has a named accountable person, support/escalation route, approved use and redistribution rights, retention policy and source terms record.",
      "Owner/trainer personal data, raw HTML, media references, temporary files, databases and backups have an approved Australian residency and deletion treatment.",
    ],
    evidence: [],
    status: "not-verified",
  },
] as const satisfies readonly DesignLabDataFeedGate[];
