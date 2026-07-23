export type DataFeedVerificationStatus = "not-verified";

export type DataFeedFailureReason =
  | "authentication_rejected"
  | "rate_limited"
  | "source_timeout"
  | "source_unavailable"
  | "schema_drift"
  | "parse_failure"
  | "partial_payload"
  | "scheduler_missed"
  | "destination_unavailable"
  | "destination_saturated"
  | "duplicate_or_identity_conflict"
  | "reconciliation_mismatch"
  | "licensing_hold"
  | "unknown";

export type DataFeedRuntimeSnapshot = {
  status: "healthy" | "degraded" | "down" | "unknown";
  checkedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  latestSourceRecordAt: string | null;
  latestDestinationRecordAt: string | null;
  latencyMs: number | null;
  consecutiveFailures: number | null;
  backlog: number | null;
  failureReason: DataFeedFailureReason | null;
  safeFailureDetail: string | null;
};

export type DesignLabDataFeed = {
  id: string;
  providerKey: string;
  provider: string;
  source: string;
  transport: string;
  jobPaths: readonly string[];
  owner: {
    accountableRole: string;
    assignment: "proposed-not-confirmed";
  };
  auth: {
    sourceAuth: string;
    secretReferenceLabels: readonly string[];
  };
  dataClasses: readonly string[];
  lineage: readonly string[];
  schemaContract: {
    canonicalContract: string;
    sourceVersion: string;
    validationState: "source-implemented-runtime-not-verified";
  };
  cadence: {
    sourceDeclaredTrigger: string;
    intervalMinutes: readonly number[];
    refreshSlaMinutes: null;
    deploymentState: "unknown";
  };
  freshness: {
    signal: string;
    degradedAfterMinutes: null;
    downAfterMinutes: null;
    thresholdState: "operator-unknown";
  };
  runtime: {
    source: "server-supplied-only";
    feedId: string;
    currentModel: "DataSourceHealth";
    snapshot: DataFeedRuntimeSnapshot | null;
  };
  dependencies: readonly string[];
  downstreamJourneys: readonly string[];
  failureReasons: readonly DataFeedFailureReason[];
  reliability: {
    retries: string;
    backfill: string;
    reconciliation: string;
  };
  operations: {
    alert: "not-implemented";
    runbook: "not-implemented";
    sourceEvidence: readonly string[];
    runtimeEvidence: readonly string[];
  };
  governance: {
    pii: string;
    licensing: string;
    dataResidency: string;
  };
  verifiedCodeFacts: readonly string[];
  unknownOperatorMetadata: readonly string[];
  status: DataFeedVerificationStatus;
};

type FeedInput = Omit<DesignLabDataFeed, "runtime" | "status">;

const LIVE_JOB_PATHS = [
  "src/app/api/internal/live-sync/route.ts",
  "src/lib/live/sync.ts",
  "scripts/sync-live.ts",
] as const;
const LIVE_CADENCE = {
  sourceDeclaredTrigger: "Upcoming every 5 minutes; results at minute 7 each hour.",
  intervalMinutes: [5, 60],
  refreshSlaMinutes: null,
  deploymentState: "unknown",
} as const;
const LIVE_DESTINATIONS =
  "LiveDataProvider DTOs -> syncLiveData -> Track, Meeting, Race, Runner, Dog, Trainer, Result and RaceVideo.";
const LIVE_DEPENDENCIES = [
  "Cloud Scheduler or the repository workflow",
  "internal-route authentication",
  "application compute",
  "PostgreSQL",
] as const;
export const LIVE_FAILURES = [
  "authentication_rejected",
  "rate_limited",
  "source_timeout",
  "source_unavailable",
  "schema_drift",
  "parse_failure",
  "partial_payload",
  "scheduler_missed",
  "destination_unavailable",
  "destination_saturated",
  "reconciliation_mismatch",
  "unknown",
] as const satisfies readonly DataFeedFailureReason[];
export const COMMON_DATA_FEED_UNKNOWNS = [
  "named accountable person and escalation rota",
  "approved source licence and permitted reuse",
  "contracted source SLA and per-feed freshness thresholds",
  "deployed scheduler, alert delivery and runbook exercise evidence",
] as const;

export function defineDataFeed(input: FeedInput): DesignLabDataFeed {
  return {
    ...input,
    runtime: {
      source: "server-supplied-only",
      feedId: input.id,
      currentModel: "DataSourceHealth",
      snapshot: null,
    },
    status: "not-verified",
  };
}

export function defineLiveDataFeed(input: {
  id: string;
  providerKey: string;
  provider: string;
  source: string;
  sourceAuth: string;
  secretReferenceLabels: readonly string[];
  sourceVersion: string;
  providerFacts: readonly string[];
  retries: string;
  reconciliation: string;
  sourceEvidence: readonly string[];
}): DesignLabDataFeed {
  return defineDataFeed({
    id: input.id,
    providerKey: input.providerKey,
    provider: input.provider,
    source: input.source,
    transport: "Scheduled internal route invokes an outbound provider adapter.",
    jobPaths: LIVE_JOB_PATHS,
    owner: { accountableRole: "Racing Data Platform", assignment: "proposed-not-confirmed" },
    auth: {
      sourceAuth: input.sourceAuth,
      secretReferenceLabels: input.secretReferenceLabels,
    },
    dataClasses: ["meetings", "races", "runners", "dogs", "trainers", "results"],
    lineage: [input.source, LIVE_DESTINATIONS],
    schemaContract: {
      canonicalContract: "LiveDataProvider, LiveMeeting, LiveRace and LiveRunner TypeScript DTOs.",
      sourceVersion: input.sourceVersion,
      validationState: "source-implemented-runtime-not-verified",
    },
    cadence: LIVE_CADENCE,
    freshness: {
      signal: "Per-provider latest accepted Meeting/Race/Result lastSyncedAt and scheduler completion.",
      degradedAfterMinutes: null,
      downAfterMinutes: null,
      thresholdState: "operator-unknown",
    },
    dependencies: LIVE_DEPENDENCIES,
    downstreamJourneys: ["racecards", "results", "tracks", "statistics", "dog form"],
    failureReasons: LIVE_FAILURES,
    reliability: {
      retries: input.retries,
      backfill: "The Dogs archive/import tooling is the only implemented historical replay path.",
      reconciliation: input.reconciliation,
    },
    operations: {
      alert: "not-implemented",
      runbook: "not-implemented",
      sourceEvidence: input.sourceEvidence,
      runtimeEvidence: [],
    },
    governance: {
      pii: "Public racing records may contain trainer or owner names; classification approval is absent.",
      licensing: "Repository implementation is not evidence of a production reuse licence.",
      dataResidency: "External source location varies; persisted environment and backup residency are unverified.",
    },
    verifiedCodeFacts: input.providerFacts,
    unknownOperatorMetadata: COMMON_DATA_FEED_UNKNOWNS,
  });
}
