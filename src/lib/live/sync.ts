import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { withDbSystemContext } from "../db-context";
import { notifyDogWinnersFromRecentResults } from "../dog-win-notify";
import { pruneExpiredRateLimits } from "../rate-limit-maintenance";
import {
  getExecutionLogContext,
  getRequestLogContext,
  logCorrelatedError,
  logCorrelatedInfo,
  logCorrelatedWarn,
  type LogCorrelationContext,
} from "../logger";
import {
  getLiveProvider,
  getLiveProviderConfig,
  type LiveDog,
  type LiveMeeting,
  type LiveRace,
  type LiveRunner,
} from "./provider";
import {
  writeLiveFeedQuarantine,
  writeLiveFeedQuarantines,
  type LiveFeedQuarantineClassification,
  type LiveFeedQuarantineInput,
} from "./quarantine";
import { canonicalTrackName } from "./track-name";
import {
  whitelistProviderSnapshot,
  type ProviderSnapshotKind,
} from "./raw-sanitizer";

export type SyncCounts = {
  meetings: number;
  races: number;
  runners: number;
  results: number;
};

export type SyncScope = "upcoming" | "results" | "all";

const BULK_WRITE_CHUNK_SIZE = 100;
const LOOKUP_QUERY_CHUNK_SIZE = 500;
const NATURAL_LOOKUP_QUERY_CHUNK_SIZE = 50;
const LOOKUP_QUERY_LIMIT = 5_000;
const FORM_ENTRY_ORPHAN_SCAN_LIMIT = 5_000;
const LIVE_SYNC_TRANSACTION_MAX_WAIT_MS = 30_000;
const LIVE_SYNC_TRANSACTION_TIMEOUT_MS = 240_000;
const AUSTRALIAN_TRACK_STATES = new Set([
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
] as const);

type AustralianTrackState = "ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA";

function sanitizedRawJson(
  value: string | null | undefined,
  provider: string | null | undefined,
  kind: ProviderSnapshotKind
) {
  return whitelistProviderSnapshot(value, provider, kind);
}

type LiveSyncDbClient = Prisma.TransactionClient;

type TrackRow = { id: string; name: string; state: string };
type RaceRow = { id: string; meetingId: string; raceNumber: number };
type RunnerRow = { id: string; raceId: string; boxNumber: number; dogId: string };

type RaceWithMeeting = {
  meeting: LiveMeeting;
  meetingId: string;
  trackId: string;
  race: LiveRace;
};

type RunnerWithRace = {
  raceId: string;
  trackId: string;
  meetingDate: Date;
  distance: number;
  grade?: string;
  sourceProvider?: string;
  raceSourceId?: string;
  runner: LiveRunner;
};

type RunnerUpsertRow = {
  id: string;
  raceId: string;
  boxNumber: number;
  dogId: string;
  weight: number | null;
  trainerId: string | null;
  scratched: boolean;
  sourceProvider: string | null;
  sourceId: string | null;
  sourceRawJson: string | null;
};

type ResultUpsertRow = {
  id: string;
  runnerId: string;
  raceId: string;
  finishingPosition: number | null;
  runningTime: number | null;
  margin: number | null;
  prizeMoneyWon: number | null;
  splitTime: number | null;
  sectionals: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
  sourceRawJson: string | null;
  lastSyncedAt: Date;
};

type FormEntryUpsertRow = {
  id: string;
  dogId: string;
  raceId: string;
  trackId: string;
  date: Date;
  boxNumber: number;
  finish: number | null;
  time: number | null;
  distance: number | null;
  grade: string | null;
  weight: number | null;
};

type OrphanedFormEntryRow = {
  id: string;
  dogId: string;
  raceId: string;
};

type MeetingUpsertRow = {
  id: string;
  trackId: string;
  meetingDate: Date;
  meetingType: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
  sourceRawJson: string | null;
  lastSyncedAt: Date;
};

type RaceUpsertRow = {
  id: string;
  meetingId: string;
  raceNumber: number;
  name: string | null;
  raceTime: Date;
  distance: number;
  grade: string | null;
  prizeMoney: number | null;
  resultStatus: string | null;
  replayUrl: string | null;
  photoFinishUrl: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
  sourceRawJson: string | null;
  raceTimeSource: "provider" | "fallback";
  lastSyncedAt: Date;
};

type RaceVideoUpsertRow = {
  id: string;
  raceId: string;
  sourceProvider: string;
  sourceId: string;
  kind: string;
  pageUrl: string;
  embedSourceType: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceRawJson: string | null;
  fetchedAt: Date | null;
  lastSyncedAt: Date;
};

export interface SyncResult {
  synced: boolean;
  provider?: string;
  scope?: SyncScope;
  configured?: boolean;
  missingEnv?: string[];
  meetings?: number;
  races?: number;
  runners?: number;
  results?: number;
}

// Pulls scoped data from the configured live provider and upserts it into the
// app DB. The write path is intentionally batched because a national racecard
// sync can include thousands of runners.
export async function syncLiveData(
  days = 7,
  scope: SyncScope = "upcoming"
): Promise<SyncResult> {
  const logContext = await getExecutionLogContext();
  const provider = getLiveProvider();
  if (!provider) {
    const providerConfig = getLiveProviderConfig();
    const missingEnv = providerConfig.feeds.flatMap((feed) =>
      feed.blocking ? feed.missingEnv : []
    );
    logCorrelatedInfo(logContext, "live_sync.provider_not_configured", {
      scope,
      missingEnv,
    });
    return {
      synced: false,
      provider: "none",
      scope,
      configured: false,
      missingEnv,
    };
  }

  logCorrelatedInfo(logContext, "live_sync.started", {
    provider: provider.name,
    scope,
    days,
  });
  const counts: SyncCounts = { meetings: 0, races: 0, runners: 0, results: 0 };
  if (scope === "upcoming" || scope === "all") {
    const meetings = stampMeetings(
      await fetchProviderMeetings(
        () => provider.fetchUpcomingMeetings(days),
        provider.name,
        "upcoming",
        days,
      ),
      provider.name,
    );
    addCounts(counts, await upsertSystemMeetings(meetings, logContext));
  }
  if (scope === "results" || scope === "all") {
    const meetings = stampMeetings(
      await fetchProviderMeetings(
        () => provider.fetchResults(days),
        provider.name,
        "results",
        days,
      ),
      provider.name,
    );
    addCounts(counts, await upsertSystemMeetings(meetings, logContext));
    await notifyDogWinnersFromRecentResults();
  }

  logCorrelatedInfo(logContext, "live_sync.completed", {
    provider: provider.name,
    scope,
    ...counts,
  });
  return { synced: true, provider: provider.name, scope, ...counts };
}

async function fetchProviderMeetings(
  fetchMeetings: () => Promise<LiveMeeting[]>,
  providerName: string,
  scope: Exclude<SyncScope, "all">,
  days: number,
) {
  try {
    return await fetchMeetings();
  } catch (error) {
    await writeLiveFeedQuarantine({
      provider: quarantineProvider(providerName),
      entityKind: "provider_batch",
      sourceId: scope,
      naturalIdentity: `${scope}:${days}`,
      reasonCode: "provider_batch_failed",
      classification: "incomplete",
      evidence: {
        scope,
        days,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
    });
    throw error;
  }
}

// Hourly aggregate maintenance runs separately from live-result ingestion so
// slow refreshes cannot consume the scheduler deadline for provider data.
const AGGREGATE_MATVIEWS = [
  "giq_sire_leaderboard",
  "giq_box_bias",
  "giq_trainer_leaderboard",
  "giq_trainer_performance",
  "giq_track_records",
] as const;

export const AGGREGATE_MAINTENANCE_BUDGET_MS = 780_000;
export const AGGREGATE_VIEW_STATEMENT_MAX_MS = 120_000;
const AGGREGATE_VIEW_TRANSACTION_MAX_WAIT_MS = 5_000;
const AGGREGATE_VIEW_TRANSACTION_OVERHEAD_MS = 2_000;
const AGGREGATE_VIEW_RESPONSE_RESERVE_MS = 10_000;
const AGGREGATE_VIEW_LOCK_TIMEOUT = "10s";

type AggregateRefreshTiming = {
  statementTimeoutMs: number;
  transactionMaxWaitMs: number;
  transactionTimeoutMs: number;
  responseReserveMs: number;
};

type AggregateViewRefreshExecutor = (
  view: (typeof AGGREGATE_MATVIEWS)[number],
  timing: AggregateRefreshTiming,
) => Promise<void>;

export async function refreshAggregateMaterializedViews() {
  const refreshed: string[] = [];
  const startedAt = Date.now();
  const deadlineAt = startedAt + AGGREGATE_MAINTENANCE_BUDGET_MS;
  const logContext = await getRequestLogContext();
  const rateLimitPrune = await pruneExpiredRateLimits();

  const pruneLogFields = {
    status: rateLimitPrune.status,
    deleted: rateLimitPrune.deleted,
    batches: rateLimitPrune.batches,
    backlog: rateLimitPrune.backlog,
    capped: rateLimitPrune.capped,
    stalled: rateLimitPrune.stalled,
    batchSize: rateLimitPrune.batchSize,
    maxBatches: rateLimitPrune.maxBatches,
  };
  if (rateLimitPrune.status === "drained") {
    logCorrelatedInfo(
      logContext,
      "aggregate_refresh.rate_limit_prune_completed",
      pruneLogFields,
    );
  } else {
    logCorrelatedWarn(
      logContext,
      "aggregate_refresh.rate_limit_prune_attention",
      pruneLogFields,
    );
  }

  for (const view of AGGREGATE_MATVIEWS) {
    const viewStartedAt = Date.now();
    try {
      await refreshAggregateMaterializedView(view, deadlineAt);
      refreshed.push(view);
      logCorrelatedInfo(logContext, "aggregate_refresh.completed", {
        view,
        durationMs: Date.now() - viewStartedAt,
      });
    } catch (err) {
      logCorrelatedError(
        logContext,
        "aggregate_refresh.failed",
        { view, durationMs: Date.now() - viewStartedAt },
        err,
      );
      throw err;
    }
  }

  const durationMs = Date.now() - startedAt;
  logCorrelatedInfo(logContext, "aggregate_refresh.run_completed", {
    durationMs,
    viewCount: refreshed.length,
    pruneStatus: rateLimitPrune.status,
  });

  return {
    refreshed,
    durationMs,
    rateLimitPrune,
  };
}

export function getAggregateRefreshTiming(
  deadlineAt: number,
  nowMs: number,
): AggregateRefreshTiming {
  const availableStatementMs =
    deadlineAt -
    nowMs -
    AGGREGATE_VIEW_TRANSACTION_MAX_WAIT_MS -
    AGGREGATE_VIEW_TRANSACTION_OVERHEAD_MS -
    AGGREGATE_VIEW_RESPONSE_RESERVE_MS;
  if (availableStatementMs < 1_000) {
    throw new Error("aggregate_refresh.deadline_exhausted");
  }

  const statementTimeoutMs = Math.min(
    AGGREGATE_VIEW_STATEMENT_MAX_MS,
    availableStatementMs,
  );
  return {
    statementTimeoutMs,
    transactionMaxWaitMs: AGGREGATE_VIEW_TRANSACTION_MAX_WAIT_MS,
    transactionTimeoutMs:
      statementTimeoutMs + AGGREGATE_VIEW_TRANSACTION_OVERHEAD_MS,
    responseReserveMs: AGGREGATE_VIEW_RESPONSE_RESERVE_MS,
  };
}

export async function refreshAggregateMaterializedView(
  view: (typeof AGGREGATE_MATVIEWS)[number],
  deadlineAt: number,
  dependencies: {
    now?: () => number;
    execute?: AggregateViewRefreshExecutor;
  } = {},
) {
  const timing = getAggregateRefreshTiming(
    deadlineAt,
    (dependencies.now ?? Date.now)(),
  );
  await (dependencies.execute ?? executeAggregateMaterializedView)(view, timing);
}

async function executeAggregateMaterializedView(
  view: (typeof AGGREGATE_MATVIEWS)[number],
  timing: AggregateRefreshTiming,
) {
  await withDbSystemContext(
    async (tx) => {
      await tx.$queryRaw`
        SELECT
          set_config('lock_timeout', ${AGGREGATE_VIEW_LOCK_TIMEOUT}, true),
          set_config('statement_timeout', ${`${timing.statementTimeoutMs}ms`}, true)
      `;
      await tx.$queryRaw<Array<{ refreshed: string | null }>>(
        Prisma.sql`SELECT public.giq_refresh_aggregate_matview(${view})::text AS refreshed`,
      );
    },
    {
      maxWait: timing.transactionMaxWaitMs,
      timeout: timing.transactionTimeoutMs,
    },
  );
}

function addCounts(total: SyncCounts, next: SyncCounts) {
  total.meetings += next.meetings;
  total.races += next.races;
  total.runners += next.runners;
  total.results += next.results;
}

export async function syncLiveMeetings(
  meetings: LiveMeeting[],
  fallbackProvider: string
): Promise<SyncCounts> {
  return upsertSystemMeetings(
    stampMeetings(meetings, fallbackProvider),
    await getExecutionLogContext()
  );
}

async function upsertSystemMeetings(
  meetings: LiveMeeting[],
  logContext: LogCorrelationContext
) {
  if (meetings.length === 0) {
    return { meetings: 0, races: 0, runners: 0, results: 0 };
  }

  const quarantineEvents: LiveFeedQuarantineInput[] = [];
  const orphanedFormEntries: OrphanedFormEntryRow[] = [];
  let counts: SyncCounts;
  try {
    counts = await prisma.$transaction(
      async (tx) => {
        await setLiveSyncSystemContext(tx);
        return upsertMeetings(
          tx,
          meetings,
          logContext,
          quarantineEvents,
          orphanedFormEntries,
        );
      },
      {
        maxWait: LIVE_SYNC_TRANSACTION_MAX_WAIT_MS,
        timeout: LIVE_SYNC_TRANSACTION_TIMEOUT_MS,
      }
    );
  } catch (error) {
    await writeLiveFeedQuarantines(quarantineEvents);
    throw error;
  }
  await writeLiveFeedQuarantines(quarantineEvents);
  await detachQuarantinedFormEntryRaceLinks(orphanedFormEntries);
  return counts;
}

async function setLiveSyncSystemContext(db: LiveSyncDbClient) {
  await setLocal(db, "app.system", "true");
  await setLocal(db, "app.current_tier", "system");
  await setLocal(db, "app.current_role", "system");
}

function setLocal(db: LiveSyncDbClient, key: string, value: string) {
  return db.$executeRaw`SELECT set_config(${key}, ${value}, true)`;
}

function stampMeetings(meetings: LiveMeeting[], fallbackProvider: string) {
  return meetings.map((meeting) => {
    const sourceProvider = meeting.sourceProvider ?? fallbackProvider;
    return {
      ...meeting,
      sourceProvider,
      races: meeting.races.map((race) => {
        const raceProvider = race.sourceProvider ?? sourceProvider;
        return {
          ...race,
          sourceProvider: raceProvider,
          runners: race.runners.map((runner) => {
            const runnerProvider = runner.sourceProvider ?? raceProvider;
            return {
              ...runner,
              sourceProvider: runnerProvider,
              dog: {
                ...runner.dog,
                sourceProvider:
                  runner.dog.sourceProvider ?? runnerProvider,
              },
            };
          }),
        };
      }),
    };
  });
}

async function upsertMeetings(
  db: LiveSyncDbClient,
  meetings: LiveMeeting[],
  logContext: LogCorrelationContext,
  quarantineEvents: LiveFeedQuarantineInput[],
  orphanedFormEntries: OrphanedFormEntryRow[],
): Promise<SyncCounts> {
  const counts: SyncCounts = { meetings: 0, races: 0, runners: 0, results: 0 };
  if (meetings.length === 0) return counts;

  const now = new Date();
  syncDebug(
    "upsertMeetings start",
    {
      meetings: meetings.length,
      races: meetings.reduce((total, meeting) => total + meeting.races.length, 0),
    },
    logContext
  );
  const tracks = await syncStage(
    "ensureTracks",
    { meetings: meetings.length },
    () => ensureTracks(db, meetings, quarantineEvents),
    logContext
  );
  const meetingRows = await syncStage(
    "ensureMeetings",
    { meetings: meetings.length, tracks: tracks.size },
    () => ensureMeetings(db, meetings, tracks, now, quarantineEvents),
    logContext
  );
  const acceptedMeetingInputs = meetings.flatMap((meeting) => {
    const key = acceptedMeetingKey(meeting, tracks);
    const meetingRow = key ? meetingRows.get(key) : undefined;
    return meetingRow ? [{ meeting, meetingRow }] : [];
  });
  counts.meetings = new Set(
    acceptedMeetingInputs.map(({ meetingRow }) => meetingRow.id),
  ).size;

  const raceItems = acceptedMeetingInputs.flatMap(({ meeting, meetingRow }) => {
    return meeting.races.map((race) => ({
      meeting,
      meetingId: meetingRow.id,
      trackId: meetingRow.trackId,
      race,
    }));
  });

  const raceRows = await syncStage(
    "ensureRaces",
    { races: raceItems.length },
    () => ensureRaces(db, raceItems, now, quarantineEvents),
    logContext
  );
  await syncStage(
    "ensureRaceVideos",
    { races: raceItems.length },
    () => ensureRaceVideos(db, raceItems, raceRows, now),
    logContext
  );
  counts.races = raceItems.length;

  const runnerItems = raceItems.flatMap((item) => {
    const raceId = raceRows.get(raceKey(item.meetingId, item.race))?.id;
    if (!raceId) return [];
    return normalizeRaceRunners(item.race.runners, (discarded, preferred) => {
      quarantineEvents.push({
        provider: quarantineProvider(
          discarded.sourceProvider ?? item.race.sourceProvider ?? item.meeting.sourceProvider,
        ),
        entityKind: "runner",
        sourceId: normalizeSourceId(discarded.sourceId) ?? null,
        naturalIdentity: `${raceId}:${dogKey(discarded.dog) || discarded.boxNumber}`,
        reasonCode: "duplicate_runner_identity",
        classification: "conflict",
        evidence: {
          raceSourceId: item.race.sourceId,
          discardedBoxNumber: discarded.boxNumber,
          preferredBoxNumber: preferred.boxNumber,
          discardedHasResult: discarded.finishingPosition != null,
          preferredHasResult: preferred.finishingPosition != null,
          discardedScratched: discarded.scratched ?? false,
          preferredScratched: preferred.scratched ?? false,
        },
      });
    }).map((runner) => ({
      raceId,
      trackId: item.trackId,
      meetingDate: meetingDate(item.meeting),
      distance: item.race.distance,
      grade: item.race.grade,
      sourceProvider: item.race.sourceProvider ?? item.meeting.sourceProvider,
      raceSourceId: item.race.sourceId,
      runner,
    }));
  });

  const dogIds = await syncStage(
    "ensureDogs",
    { runners: runnerItems.length },
    () => ensureDogs(
      db,
      runnerItems.map((item) => item.runner.dog),
      logContext,
      quarantineEvents,
    ),
    logContext
  );
  const trainerIds = await syncStage(
    "ensureTrainers",
    { runners: runnerItems.length },
    () => ensureTrainers(
      runnerItems.map((item) => item.runner.trainerName),
      logContext,
    ),
    logContext
  );
  const runnerRows = await syncStage(
    "ensureRunners",
    { runners: runnerItems.length, dogs: dogIds.size, trainers: trainerIds.size },
    () => ensureRunners(db, runnerItems, dogIds, trainerIds, quarantineEvents),
    logContext
  );
  counts.runners = runnerItems.length;
  counts.results = await syncStage(
    "ensureResults",
    { runners: runnerItems.length },
    () => ensureResults(db, runnerItems, runnerRows),
    logContext
  );
  await syncStage(
    "ensureFormEntries",
    { runners: runnerItems.length },
    () => ensureFormEntries(db, runnerItems, runnerRows),
    logContext
  );
  await syncStage(
    "collectOrphanedFormEntries",
    { races: new Set(runnerItems.map((item) => item.raceId)).size },
    () => collectOrphanedFormEntries(
      db,
      runnerItems.filter((item) => dogIds.has(dogKey(item.runner.dog))),
      quarantineEvents,
      orphanedFormEntries,
    ),
    logContext,
  );
  syncDebug("upsertMeetings ok", counts, logContext);

  return counts;
}

async function syncStage<T>(
  name: string,
  meta: Record<string, unknown>,
  run: () => Promise<T>,
  logContext: LogCorrelationContext
): Promise<T> {
  if (!shouldDebugSync()) return run();

  const startedAt = Date.now();
  syncDebug(`${name} start`, meta, logContext);
  try {
    const result = await run();
    syncDebug(
      `${name} ok`,
      {
        ...meta,
        durationMs: Date.now() - startedAt,
        ...resultSummary(result),
      },
      logContext
    );
    return result;
  } catch (err) {
    syncDebug(
      `${name} failed`,
      {
        ...meta,
        durationMs: Date.now() - startedAt,
      },
      logContext,
      err
    );
    throw err;
  }
}

function syncDebug(
  message: string,
  meta?: Record<string, unknown>,
  logContext: LogCorrelationContext = {
    requestId: null,
    traceId: null,
  },
  err?: unknown
) {
  if (!shouldDebugSync()) return;
  logCorrelatedInfo(logContext, "live_sync.debug", { detail: message, ...meta }, err);
}

function shouldDebugSync() {
  return process.env.LIVE_SYNC_DEBUG === "1";
}

function resultSummary(value: unknown) {
  if (value instanceof Map) return { rows: value.size };
  if (typeof value === "number") return { rows: value };
  return {};
}

function conflictAction(updateSql: Prisma.Sql) {
  return process.env.LIVE_SYNC_INSERT_ONLY === "1" ? Prisma.sql`DO NOTHING` : updateSql;
}

export function normalizeAustralianTrackState(
  value: string | null | undefined,
): AustralianTrackState | null {
  return value && AUSTRALIAN_TRACK_STATES.has(value as AustralianTrackState)
    ? (value as AustralianTrackState)
    : null;
}

export async function ensureTracks(
  db: LiveSyncDbClient,
  meetings: LiveMeeting[],
  quarantineEvents: LiveFeedQuarantineInput[] = [],
) {
  const byName = new Map<
    string,
    { name: string; state: AustralianTrackState; meetings: LiveMeeting[] }
  >();
  const conflictedNames = new Set<string>();

  for (const meeting of meetings) {
    const trackName = canonicalTrackName(meeting.trackName);
    const state = normalizeAustralianTrackState(meeting.state);
    if (!state) {
      quarantineTrackJurisdiction(
        quarantineEvents,
        meeting,
        trackName,
        meeting.state?.trim() ? "unsupported_track_jurisdiction" : "missing_track_state",
        meeting.state?.trim() ? "invalid" : "incomplete",
        { observedState: meeting.state ?? null },
      );
      continue;
    }

    const existing = byName.get(trackName);
    if (!existing) {
      byName.set(trackName, { name: trackName, state, meetings: [meeting] });
      continue;
    }
    existing.meetings.push(meeting);
    if (existing.state !== state) conflictedNames.add(trackName);
  }

  for (const trackName of conflictedNames) {
    const claim = byName.get(trackName);
    if (!claim) continue;
    const observedStates = [
      ...new Set(
        claim.meetings
          .map((meeting) => normalizeAustralianTrackState(meeting.state))
          .filter((state): state is AustralianTrackState => Boolean(state)),
      ),
    ];
    for (const meeting of claim.meetings) {
      quarantineTrackJurisdiction(
        quarantineEvents,
        meeting,
        trackName,
        "conflicting_track_state",
        "conflict",
        { observedState: meeting.state ?? null, observedStates },
      );
    }
    byName.delete(trackName);
  }

  const existing = await db.track.findMany({
    where: { name: { in: [...byName.keys()] } },
    select: { id: true, name: true, state: true },
    take: LOOKUP_QUERY_LIMIT,
  });
  const existingByName = new Map(existing.map((track) => [track.name, track]));
  const tracks = new Map<string, TrackRow>();

  for (const track of existing) {
    const claim = byName.get(track.name);
    if (!claim) continue;
    if (track.state === claim.state) {
      tracks.set(track.name, track);
      continue;
    }
    for (const meeting of claim.meetings) {
      quarantineTrackJurisdiction(
        quarantineEvents,
        meeting,
        claim.name,
        "track_state_mismatch",
        "conflict",
        { observedState: claim.state, canonicalState: track.state },
      );
    }
  }

  for (const track of byName.values()) {
    if (existingByName.has(track.name)) continue;
    const created = await db.track.create({
      data: { name: track.name, state: track.state },
      select: { id: true, name: true, state: true },
    });
    tracks.set(created.name, created);
  }

  return tracks as Map<string, TrackRow>;
}

function quarantineTrackJurisdiction(
  quarantineEvents: LiveFeedQuarantineInput[],
  meeting: LiveMeeting,
  trackName: string,
  reasonCode: string,
  classification: LiveFeedQuarantineClassification,
  evidence: Record<string, unknown>,
) {
  quarantineEvents.push({
    provider: quarantineProvider(meeting.sourceProvider),
    entityKind: "track",
    sourceId: normalizeSourceId(meeting.sourceId) ?? null,
    naturalIdentity: trackName,
    reasonCode,
    classification,
    evidence: { trackName, meetingDate: meeting.meetingDate, ...evidence },
  });
}

async function ensureMeetings(
  db: LiveSyncDbClient,
  meetings: LiveMeeting[],
  tracks: Map<string, TrackRow>,
  now: Date,
  quarantineEvents: LiveFeedQuarantineInput[],
) {
  const trackIds = [...new Set([...tracks.values()].map((track) => track.id))];
  const rows = meetings.flatMap((meeting): MeetingUpsertRow[] => {
    const key = acceptedMeetingKey(meeting, tracks);
    if (!key) return [];
    const track = tracks.get(canonicalTrackName(meeting.trackName));
    if (!track) return [];
    return [
      {
        id: randomUUID(),
        trackId: track.id,
        meetingDate: meetingDate(meeting),
        meetingType: meeting.meetingType ?? null,
        sourceProvider: meeting.sourceProvider ?? null,
        sourceId: meeting.sourceId ?? null,
        sourceRawJson: sanitizedRawJson(
          meeting.sourceRawJson,
          meeting.sourceProvider,
          "meeting"
        ),
        lastSyncedAt: now,
      },
    ];
  });

  await bulkUpsertMeetings(db, rows, quarantineEvents);

  const dates = [
    ...new Set(rows.map((row) => row.meetingDate.toISOString())),
  ].map((date) => new Date(date));
  const allRows = await db.meeting.findMany({
    where: { trackId: { in: trackIds }, meetingDate: { in: dates } },
    select: { id: true, trackId: true, meetingDate: true },
    take: LOOKUP_QUERY_LIMIT,
  });
  return new Map(
    allRows.map((row) => [naturalMeetingKey(row.trackId, row.meetingDate), row])
  );
}

async function ensureRaces(
  db: LiveSyncDbClient,
  items: RaceWithMeeting[],
  now: Date,
  quarantineEvents: LiveFeedQuarantineInput[],
) {
  if (items.length === 0) return new Map<string, RaceRow>();
  const meetingIds = [...new Set(items.map((item) => item.meetingId))];
  const upserts: RaceUpsertRow[] = items.map((item) => ({
    id: randomUUID(),
    meetingId: item.meetingId,
    raceNumber: item.race.raceNumber,
    name: item.race.name ?? null,
    raceTime: new Date(item.race.raceTime),
    distance: item.race.distance,
    grade: item.race.grade ?? null,
    prizeMoney: item.race.prizeMoney ?? null,
    resultStatus: item.race.resultStatus ?? null,
    replayUrl: item.race.replayUrl ?? null,
    photoFinishUrl: item.race.photoFinishUrl ?? null,
    sourceProvider: item.race.sourceProvider ?? item.meeting.sourceProvider ?? null,
    sourceId: item.race.sourceId ?? null,
    sourceRawJson: sanitizedRawJson(
      item.race.sourceRawJson,
      item.race.sourceProvider ?? item.meeting.sourceProvider,
      "race"
    ),
    raceTimeSource: item.race.raceTimeSource ?? "provider",
    lastSyncedAt: now,
  }));

  await bulkUpsertRaces(db, upserts, quarantineEvents);

  const allRows: RaceRow[] = [];
  for (const meetingIdChunk of chunks(meetingIds, LOOKUP_QUERY_CHUNK_SIZE)) {
    allRows.push(...await db.race.findMany({
      where: { meetingId: { in: meetingIdChunk } },
      select: { id: true, meetingId: true, raceNumber: true },
      take: LOOKUP_QUERY_LIMIT,
    }));
  }
  return new Map(allRows.map((row) => [raceKey(row.meetingId, row), row]));
}

async function ensureRaceVideos(
  db: LiveSyncDbClient,
  items: RaceWithMeeting[],
  races: Map<string, RaceRow>,
  now: Date
) {
  const rows = items.flatMap((item): RaceVideoUpsertRow[] => {
    if (!item.race.videoSourceId || !item.race.replayUrl) return [];
    const race = races.get(raceKey(item.meetingId, item.race));
    const sourceProvider = item.race.sourceProvider ?? item.meeting.sourceProvider;
    if (!race || !sourceProvider) return [];

    return [
      {
        id: randomUUID(),
        raceId: race.id,
        sourceProvider,
        sourceId: item.race.videoSourceId,
        kind: "replay",
        pageUrl: item.race.replayUrl,
        embedSourceType:
          item.race.videoSourceType ?? inferEmbedSourceType(item.race.replayUrl),
        sourceStatus: 200,
        sourceCode: "provider-video-id",
        streamUrl: null,
        streamContentType: null,
        title: item.race.name ?? null,
        description: item.race.grade ?? null,
        sourceRawJson: sanitizedRawJson(
          item.race.sourceRawJson,
          sourceProvider,
          "race"
        ),
        fetchedAt: now,
        lastSyncedAt: now,
      },
    ];
  });

  await bulkUpsertRaceVideos(db, rows);
  return rows.length;
}

async function bulkUpsertRaceVideos(db: LiveSyncDbClient, rows: RaceVideoUpsertRow[]) {
  const uniqueRows = uniqueBy(
    rows,
    (row) => `${row.raceId}:${row.sourceProvider}:${row.kind}`
  );
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db.$executeRaw`
      INSERT INTO "RaceVideo"
        ("id", "raceId", "sourceProvider", "sourceId", "kind", "pageUrl", "embedSourceType", "sourceStatus", "sourceCode", "streamUrl", "streamContentType", "title", "description", "sourceRawJson", "fetchedAt", "lastSyncedAt", "createdAt", "updatedAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.raceId}, ${row.sourceProvider}, ${row.sourceId}, ${row.kind}, ${row.pageUrl}, ${row.embedSourceType}, ${row.sourceStatus}, ${row.sourceCode}, ${row.streamUrl}, ${row.streamContentType}, ${row.title}, ${row.description}, ${row.sourceRawJson}, ${row.fetchedAt}, ${row.lastSyncedAt}, NOW(), NOW())
        `)
      )}
      ON CONFLICT ("raceId", "sourceProvider", "kind") ${conflictAction(Prisma.sql`DO UPDATE SET
        "sourceId" = COALESCE("RaceVideo"."sourceId", EXCLUDED."sourceId"),
        "pageUrl" = COALESCE("RaceVideo"."pageUrl", EXCLUDED."pageUrl"),
        "embedSourceType" = COALESCE("RaceVideo"."embedSourceType", EXCLUDED."embedSourceType"),
        "sourceStatus" = COALESCE("RaceVideo"."sourceStatus", EXCLUDED."sourceStatus"),
        "sourceCode" = COALESCE("RaceVideo"."sourceCode", EXCLUDED."sourceCode"),
        "streamUrl" = COALESCE("RaceVideo"."streamUrl", EXCLUDED."streamUrl"),
        "streamContentType" = COALESCE("RaceVideo"."streamContentType", EXCLUDED."streamContentType"),
        "title" = COALESCE("RaceVideo"."title", EXCLUDED."title"),
        "description" = COALESCE("RaceVideo"."description", EXCLUDED."description"),
        "sourceRawJson" = COALESCE("RaceVideo"."sourceRawJson", EXCLUDED."sourceRawJson"),
        "fetchedAt" = COALESCE("RaceVideo"."fetchedAt", EXCLUDED."fetchedAt"),
        "lastSyncedAt" = EXCLUDED."lastSyncedAt",
        "updatedAt" = NOW()`)}
    `;
  }
}

async function bulkUpsertMeetings(
  db: LiveSyncDbClient,
  rows: MeetingUpsertRow[],
  quarantineEvents: LiveFeedQuarantineInput[],
) {
  const uniqueRows = uniqueByPreferredSource(
    rows,
    (row) => naturalMeetingKey(row.trackId, row.meetingDate),
    (discarded, preferred, naturalIdentity) => {
      quarantineEvents.push({
        provider: quarantineProvider(discarded.sourceProvider),
        entityKind: "meeting",
        sourceId: normalizeSourceId(discarded.sourceId) ?? null,
        naturalIdentity,
        reasonCode: "preferred_source_discarded",
        classification: "conflict",
        evidence: {
          discardedProvider: discarded.sourceProvider,
          preferredProvider: preferred.sourceProvider,
          discardedMeetingType: discarded.meetingType,
          preferredMeetingType: preferred.meetingType,
        },
      });
    },
  );
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db.$executeRaw`
      INSERT INTO "Meeting"
        ("id", "trackId", "meetingDate", "meetingType", "sourceProvider", "sourceId", "sourceRawJson", "lastSyncedAt", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.trackId}, ${row.meetingDate}, ${row.meetingType}, ${row.sourceProvider}, ${row.sourceId}, ${row.sourceRawJson}, ${row.lastSyncedAt}, NOW())
        `)
      )}
      ON CONFLICT ("trackId", "meetingDate") ${conflictAction(Prisma.sql`DO UPDATE SET
        "meetingType" = EXCLUDED."meetingType",
        "sourceProvider" = EXCLUDED."sourceProvider",
        "sourceId" = EXCLUDED."sourceId",
        "sourceRawJson" = EXCLUDED."sourceRawJson",
        "lastSyncedAt" = EXCLUDED."lastSyncedAt"`)}
    `;
  }
}

async function bulkUpsertRaces(
  db: LiveSyncDbClient,
  rows: RaceUpsertRow[],
  quarantineEvents: LiveFeedQuarantineInput[],
) {
  const uniqueRows = uniqueByPreferredSource(
    rows,
    (row) => raceKey(row.meetingId, { raceNumber: row.raceNumber }),
    (discarded, preferred, naturalIdentity) => {
      quarantineEvents.push({
        provider: quarantineProvider(discarded.sourceProvider),
        entityKind: "race",
        sourceId: normalizeSourceId(discarded.sourceId) ?? null,
        naturalIdentity,
        reasonCode: "preferred_source_discarded",
        classification: "conflict",
        evidence: {
          discardedProvider: discarded.sourceProvider,
          preferredProvider: preferred.sourceProvider,
          discardedDistance: discarded.distance,
          preferredDistance: preferred.distance,
          discardedGrade: discarded.grade,
          preferredGrade: preferred.grade,
          discardedRaceTime: discarded.raceTime,
          preferredRaceTime: preferred.raceTime,
        },
      });
    },
  );
  const confirmedRows = uniqueRows.filter((row) => row.raceTimeSource !== "fallback");
  const fallbackRows = uniqueRows.filter((row) => row.raceTimeSource === "fallback");

  await bulkUpsertRaceChunkSet(db, confirmedRows, true);
  await bulkUpsertRaceChunkSet(db, fallbackRows, false);
}

async function bulkUpsertRaceChunkSet(
  db: LiveSyncDbClient,
  rows: RaceUpsertRow[],
  updateRaceTimeOnConflict: boolean
) {
  for (let index = 0; index < rows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db.$executeRaw`
      INSERT INTO "Race"
        ("id", "meetingId", "raceNumber", "name", "raceTime", "distance", "grade", "prizeMoney", "resultStatus", "replayUrl", "photoFinishUrl", "sourceProvider", "sourceId", "sourceRawJson", "lastSyncedAt", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.meetingId}, ${row.raceNumber}, ${row.name}, ${row.raceTime}, ${row.distance}, ${row.grade}, ${row.prizeMoney}, ${row.resultStatus}, ${row.replayUrl}, ${row.photoFinishUrl}, ${row.sourceProvider}, ${row.sourceId}, ${row.sourceRawJson}, ${row.lastSyncedAt}, NOW())
        `)
      )}
      ON CONFLICT ("meetingId", "raceNumber") ${conflictAction(Prisma.sql`DO UPDATE SET
        "name" = EXCLUDED."name",
        ${updateRaceTimeOnConflict ? Prisma.sql`"raceTime" = EXCLUDED."raceTime",` : Prisma.empty}
        "distance" = EXCLUDED."distance",
        "grade" = EXCLUDED."grade",
        "prizeMoney" = EXCLUDED."prizeMoney",
        "resultStatus" = EXCLUDED."resultStatus",
        "replayUrl" = COALESCE("Race"."replayUrl", EXCLUDED."replayUrl"),
        "photoFinishUrl" = COALESCE("Race"."photoFinishUrl", EXCLUDED."photoFinishUrl"),
        "sourceProvider" = ${updateRaceTimeOnConflict ? Prisma.sql`EXCLUDED."sourceProvider"` : Prisma.sql`COALESCE("Race"."sourceProvider", EXCLUDED."sourceProvider")`},
        "sourceId" = ${updateRaceTimeOnConflict ? Prisma.sql`EXCLUDED."sourceId"` : Prisma.sql`COALESCE("Race"."sourceId", EXCLUDED."sourceId")`},
        "sourceRawJson" = ${updateRaceTimeOnConflict ? Prisma.sql`EXCLUDED."sourceRawJson"` : Prisma.sql`COALESCE("Race"."sourceRawJson", EXCLUDED."sourceRawJson")`},
        "lastSyncedAt" = EXCLUDED."lastSyncedAt"`)}
    `;
  }
}

type DogIdentityDbClient = Pick<
  LiveSyncDbClient,
  "dog" | "dogSourceIdentity"
>;

type DogIdentityClaim = {
  key: string;
  legacyKey: string;
  sourceProvider: string;
  sourceId: string;
  dog: LiveDog;
  whelpDate: Date | null;
};

type DogIdentityParentRow = {
  name: string;
  earBrand: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
};

type DogIdentityRow = DogIdentityParentRow & {
  id: string;
  whelpDate: Date | null;
  sire: DogIdentityParentRow | null;
  dam: DogIdentityParentRow | null;
};

const AUTHORITATIVE_DOG_CREATION_PROVIDERS = new Set([
  "topaz",
]);

export async function ensureDogs(
  db: DogIdentityDbClient,
  dogs: LiveDog[],
  logContext: LogCorrelationContext = { requestId: null, traceId: null },
  quarantineEvents: LiveFeedQuarantineInput[] = [],
) {
  const groupedClaims = new Map<string, DogIdentityClaim[]>();
  for (const dog of dogs) {
    const sourceProvider = normalizeProvider(dog.sourceProvider);
    const sourceId = normalizeSourceId(dog.sourceId);
    const name = cleanDogName(dog.name);
    if (!name) {
      logDogIdentitySkip(logContext, "invalid_or_placeholder_name", {
        sourceProvider,
        sourceId,
      }, quarantineEvents);
      continue;
    }
    if (!sourceProvider || !sourceId) {
      logDogIdentitySkip(logContext, "missing_stable_provider_identity", {
        sourceProvider,
        sourceId,
        dogName: name,
      }, quarantineEvents);
      continue;
    }

    const key = exactDogKey(sourceProvider, sourceId);
    const claim: DogIdentityClaim = {
      key,
      legacyKey: `${sourceProvider}:${sourceId}`,
      sourceProvider,
      sourceId,
      dog: {
        ...dog,
        sourceProvider,
        sourceId,
        name,
        earBrand: cleanRegistryToken(dog.earBrand),
      },
      whelpDate: parseOptionalDate(dog.whelpDate),
    };
    const claims = groupedClaims.get(key) ?? [];
    claims.push(claim);
    groupedClaims.set(key, claims);
  }

  const claims: DogIdentityClaim[] = [];
  for (const grouped of groupedClaims.values()) {
    const merged = mergeCompatibleClaims(grouped);
    if (!merged) {
      const first = grouped[0];
      logDogIdentitySkip(logContext, "conflicting_provider_observations", {
        sourceProvider: first?.sourceProvider,
        sourceId: first?.sourceId,
        dogName: first?.dog.name,
        observations: grouped.length,
      }, quarantineEvents);
      continue;
    }
    claims.push(merged);
  }

  if (claims.length === 0) return new Map<string, string>();

  const ids = new Map<string, string>();
  const initialExact = await loadExactDogIdentityClaims(db, claims);
  const unresolved: DogIdentityClaim[] = [];
  for (const claim of claims) {
    const exactIds = initialExact.idsByClaim.get(claim.key) ?? new Set<string>();
    if (initialExact.saturatedClaims.has(claim.key)) {
      logDogIdentitySkip(
        logContext,
        "exact_identity_lookup_saturated",
        claim,
        quarantineEvents,
      );
      continue;
    }
    if (exactIds.size > 1) {
      logDogIdentitySkip(logContext, "ambiguous_exact_identity", {
        ...claim,
        matchingCanonicalRecords: exactIds.size,
      }, quarantineEvents);
      continue;
    }
    const exactId = exactIds.values().next().value as string | undefined;
    if (exactId) {
      ids.set(claim.key, exactId);
      continue;
    }
    unresolved.push(claim);
  }

  const eligibleForCreation: DogIdentityClaim[] = [];
  for (const claimChunk of chunks(unresolved, NATURAL_LOOKUP_QUERY_CHUNK_SIZE)) {
    const natural = await loadNaturalDogCandidates(db, claimChunk);
    if (natural.saturated) {
      for (const claim of claimChunk) {
        logDogIdentitySkip(
          logContext,
          "natural_identity_lookup_saturated",
          claim,
          quarantineEvents,
        );
      }
      continue;
    }

    for (const claim of claimChunk) {
      const possibleCandidates = natural.rows.filter((row) =>
        isPossibleDogCandidate(row, claim),
      );
      if (possibleCandidates.length > 0) {
        logDogIdentitySkip(logContext, "possible_existing_candidate", {
          ...claim,
          matchingCanonicalRecords: possibleCandidates.length,
        }, quarantineEvents);
        continue;
      }
      if (!AUTHORITATIVE_DOG_CREATION_PROVIDERS.has(claim.sourceProvider)) {
        logDogIdentitySkip(
          logContext,
          "provider_not_approved_for_creation",
          claim,
          quarantineEvents,
        );
        continue;
      }
      eligibleForCreation.push(claim);
    }
  }

  if (eligibleForCreation.length === 0) return ids;

  await db.dog.createMany({
    data: eligibleForCreation.map((claim) => ({
      name: claim.dog.name,
      earBrand: claim.dog.earBrand,
      sex: cleanOptionalText(claim.dog.sex, 32),
      colour: cleanOptionalText(claim.dog.colour, 64),
      whelpDate: claim.whelpDate,
      sourceProvider: claim.sourceProvider,
      sourceId: claim.sourceId,
    })),
    skipDuplicates: true,
  });

  const confirmed = await loadExactDogIdentityClaims(db, eligibleForCreation);
  for (const claim of eligibleForCreation) {
    const exactIds = confirmed.idsByClaim.get(claim.key) ?? new Set<string>();
    if (confirmed.saturatedClaims.has(claim.key) || exactIds.size > 1) {
      logDogIdentitySkip(logContext, "created_identity_confirmation_ambiguous", {
        ...claim,
        matchingCanonicalRecords: exactIds.size,
      }, quarantineEvents);
      continue;
    }
    const dogId = exactIds.values().next().value as string | undefined;
    if (!dogId) {
      logDogIdentitySkip(
        logContext,
        "created_identity_not_confirmed",
        claim,
        quarantineEvents,
      );
      continue;
    }
    ids.set(claim.key, dogId);
  }

  return ids;
}

async function loadExactDogIdentityClaims(
  db: DogIdentityDbClient,
  claims: DogIdentityClaim[],
) {
  const idsByClaim = new Map<string, Set<string>>();
  const saturatedClaims = new Set<string>();

  for (const claimChunk of chunks(claims, LOOKUP_QUERY_CHUNK_SIZE)) {
    const claimKeys = new Set(claimChunk.map((claim) => claim.key));
    const keyByLegacy = new Map(
      claimChunk.map((claim) => [claim.legacyKey, claim.key]),
    );
    const providerConditions = providerIdentityConditions(claimChunk);
    const rows = await db.dog.findMany({
      where: {
        OR: [
          ...providerConditions,
          { earBrand: { in: claimChunk.map((claim) => claim.legacyKey) } },
        ],
      },
      select: {
        id: true,
        earBrand: true,
        sourceProvider: true,
        sourceId: true,
      },
      take: LOOKUP_QUERY_LIMIT,
    });
    if (rows.length >= LOOKUP_QUERY_LIMIT) {
      for (const claim of claimChunk) saturatedClaims.add(claim.key);
      continue;
    }
    for (const row of rows) {
      const directKey = exactDogKey(row.sourceProvider, row.sourceId);
      if (directKey && claimKeys.has(directKey)) {
        addDogIdentityClaim(idsByClaim, directKey, row.id);
      }
      const legacyKey = row.earBrand ? keyByLegacy.get(row.earBrand) : undefined;
      if (legacyKey) addDogIdentityClaim(idsByClaim, legacyKey, row.id);
    }

    const sourceIdentities = await db.dogSourceIdentity.findMany({
      where: {
        verificationStatus: "verified",
        dogId: { not: null },
        OR: providerConditions,
      },
      select: {
        dogId: true,
        sourceProvider: true,
        sourceId: true,
      },
      take: LOOKUP_QUERY_LIMIT,
    });
    if (sourceIdentities.length >= LOOKUP_QUERY_LIMIT) {
      for (const claim of claimChunk) saturatedClaims.add(claim.key);
      continue;
    }
    for (const identity of sourceIdentities) {
      const key = exactDogKey(identity.sourceProvider, identity.sourceId);
      if (identity.dogId && key && claimKeys.has(key)) {
        addDogIdentityClaim(idsByClaim, key, identity.dogId);
      }
    }
  }

  return { idsByClaim, saturatedClaims };
}

async function loadNaturalDogCandidates(
  db: DogIdentityDbClient,
  claims: DogIdentityClaim[],
) {
  const candidateIds = new Set<string>();
  const names = await loadDogIdsByNormalizedNames(
    db,
    claims.map((claim) => claim.dog.name),
  );
  if (names.saturated) return naturalLookupSaturated();
  addAll(candidateIds, names.ids);

  const earBrands = await loadDogIdsByEarBrands(
    db,
    claims.map((claim) => claim.dog.earBrand),
  );
  if (earBrands.saturated) return naturalLookupSaturated();
  addAll(candidateIds, earBrands.ids);

  const sireIds = await loadParentCandidateIds(
    db,
    claims.map((claim) => claim.dog.sire),
  );
  const damIds = await loadParentCandidateIds(
    db,
    claims.map((claim) => claim.dog.dam),
  );
  if (sireIds.saturated || damIds.saturated) return naturalLookupSaturated();

  const pedigreeIds = await loadPedigreeCandidateIds(db, claims, sireIds.ids, damIds.ids);
  if (pedigreeIds.saturated) return naturalLookupSaturated();
  addAll(candidateIds, pedigreeIds.ids);
  if (candidateIds.size >= LOOKUP_QUERY_LIMIT) return naturalLookupSaturated();
  if (candidateIds.size === 0) {
    return { rows: [] as DogIdentityRow[], saturated: false };
  }

  const rows = await db.dog.findMany({
    where: { id: { in: [...candidateIds] } },
    select: {
      id: true,
      name: true,
      earBrand: true,
      sourceProvider: true,
      sourceId: true,
      whelpDate: true,
      sire: {
        select: {
          name: true,
          earBrand: true,
          sourceProvider: true,
          sourceId: true,
        },
      },
      dam: {
        select: {
          name: true,
          earBrand: true,
          sourceProvider: true,
          sourceId: true,
        },
      },
    },
    take: LOOKUP_QUERY_LIMIT,
  });
  return {
    rows: rows.slice(0, LOOKUP_QUERY_LIMIT) as DogIdentityRow[],
    saturated: rows.length >= LOOKUP_QUERY_LIMIT,
  };
}

async function loadDogIdsByNormalizedNames(
  db: DogIdentityDbClient,
  values: Array<string | null | undefined>,
) {
  const names = [
    ...new Set(
      values
        .map((value) => cleanDogName(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (names.length === 0) return naturalIdLookup([]);
  const rows = await db.dog.findMany({
    where: { name: { in: names, mode: "insensitive" } },
    select: { id: true },
    take: LOOKUP_QUERY_LIMIT,
  });
  return naturalIdLookup(rows);
}

async function loadDogIdsByEarBrands(
  db: DogIdentityDbClient,
  values: Array<string | null | undefined>,
) {
  const earBrands = [
    ...new Set(values.map(cleanRegistryToken).filter((value): value is string => Boolean(value))),
  ];
  if (earBrands.length === 0) return naturalIdLookup([]);
  const rows = await db.dog.findMany({
    where: { earBrand: { in: earBrands } },
    select: { id: true },
    take: LOOKUP_QUERY_LIMIT,
  });
  return naturalIdLookup(rows);
}

async function loadParentCandidateIds(
  db: DogIdentityDbClient,
  values: Array<LiveDog["sire"]>,
) {
  const parents = values.filter((value): value is NonNullable<LiveDog["sire"]> => Boolean(value));
  const names = await loadDogIdsByNormalizedNames(
    db,
    parents.map((parent) => parent.name),
  );
  if (names.saturated) return names;

  const sourceIdsByProvider = new Map<string, Set<string>>();
  const legacyKeys = new Set<string>();
  for (const parent of parents) {
    const provider = normalizeProvider(parent.sourceProvider);
    const sourceId = normalizeSourceId(parent.sourceId);
    if (!provider || !sourceId) continue;
    const sourceIds = sourceIdsByProvider.get(provider) ?? new Set<string>();
    sourceIds.add(sourceId);
    sourceIdsByProvider.set(provider, sourceIds);
    legacyKeys.add(`${provider}:${sourceId}`);
  }
  const conditions: Prisma.DogWhereInput[] = [
    ...[...sourceIdsByProvider].map(([sourceProvider, sourceIds]) => ({
      sourceProvider,
      sourceId: { in: [...sourceIds] },
    })),
  ];
  if (legacyKeys.size > 0) conditions.push({ earBrand: { in: [...legacyKeys] } });
  const exactRows = conditions.length > 0
    ? await db.dog.findMany({
        where: { OR: conditions },
        select: { id: true },
        take: LOOKUP_QUERY_LIMIT,
      })
    : [];
  if (exactRows.length >= LOOKUP_QUERY_LIMIT) return naturalIdLookup(exactRows);
  const ids = new Set(names.ids);
  addAll(ids, exactRows.map((row) => row.id));
  return { ids: [...ids], saturated: ids.size >= LOOKUP_QUERY_LIMIT };
}

async function loadPedigreeCandidateIds(
  db: DogIdentityDbClient,
  claims: DogIdentityClaim[],
  sireIds: string[],
  damIds: string[],
) {
  const conditions: Prisma.DogWhereInput[] = [];
  const whelpDates = [
    ...new Map(
      claims
        .map((claim) => claim.whelpDate)
        .filter((value): value is Date => Boolean(value))
        .map((value) => [value.toISOString(), value]),
    ).values(),
  ];
  if (whelpDates.length > 0 && sireIds.length > 0) {
    conditions.push({ whelpDate: { in: whelpDates }, sireId: { in: sireIds } });
  }
  if (whelpDates.length > 0 && damIds.length > 0) {
    conditions.push({ whelpDate: { in: whelpDates }, damId: { in: damIds } });
  }
  if (sireIds.length > 0 && damIds.length > 0) {
    conditions.push({ sireId: { in: sireIds }, damId: { in: damIds } });
  }
  if (conditions.length === 0) return naturalIdLookup([]);
  const rows = await db.dog.findMany({
    where: { OR: conditions },
    select: { id: true },
    take: LOOKUP_QUERY_LIMIT,
  });
  return naturalIdLookup(rows);
}

function naturalIdLookup(rows: Array<{ id: string }>) {
  return {
    ids: rows.slice(0, LOOKUP_QUERY_LIMIT).map((row) => row.id),
    saturated: rows.length >= LOOKUP_QUERY_LIMIT,
  };
}

function naturalLookupSaturated() {
  return { rows: [] as DogIdentityRow[], saturated: true };
}

function addAll(target: Set<string>, values: Iterable<string>) {
  for (const value of values) target.add(value);
}

function providerIdentityConditions(claims: DogIdentityClaim[]) {
  const sourceIdsByProvider = new Map<string, Set<string>>();
  for (const claim of claims) {
    const sourceIds = sourceIdsByProvider.get(claim.sourceProvider) ?? new Set<string>();
    sourceIds.add(claim.sourceId);
    sourceIdsByProvider.set(claim.sourceProvider, sourceIds);
  }
  return [...sourceIdsByProvider].map(([sourceProvider, sourceIds]) => ({
    sourceProvider,
    sourceId: { in: [...sourceIds] },
  }));
}

function isPossibleDogCandidate(row: DogIdentityRow, claim: DogIdentityClaim) {
  if (normalizeDogName(row.name) === normalizeDogName(claim.dog.name)) return true;
  if (claim.dog.earBrand && row.earBrand === claim.dog.earBrand) return true;

  const sameWhelpDate =
    claim.whelpDate != null &&
    row.whelpDate != null &&
    row.whelpDate.toISOString().slice(0, 10) ===
      claim.whelpDate.toISOString().slice(0, 10);
  const sireMatch = parentEvidenceMatches(row.sire, claim.dog.sire);
  const damMatch = parentEvidenceMatches(row.dam, claim.dog.dam);
  return (sameWhelpDate && (sireMatch || damMatch)) || (sireMatch && damMatch);
}

function parentEvidenceMatches(
  row: DogIdentityParentRow | null,
  evidence: LiveDog["sire"],
) {
  if (!row || !evidence) return false;
  const provider = normalizeProvider(evidence.sourceProvider);
  const sourceId = normalizeSourceId(evidence.sourceId);
  if (provider && sourceId) {
    if (row.sourceProvider === provider && row.sourceId === sourceId) return true;
    if (row.earBrand === `${provider}:${sourceId}`) return true;
  }
  const name = cleanDogName(evidence.name);
  return Boolean(name && normalizeDogName(row.name) === normalizeDogName(name));
}

function mergeCompatibleClaims(claims: DogIdentityClaim[]) {
  const first = claims[0];
  if (!first) return null;
  const nameValues = distinctEvidence(claims, (claim) =>
    normalizeDogName(claim.dog.name),
  );
  const registryValues = distinctEvidence(claims, (claim) => claim.dog.earBrand);
  const sexValues = distinctEvidence(claims, (claim) =>
    cleanOptionalText(claim.dog.sex, 32)?.toLocaleUpperCase("en-AU"),
  );
  const colourValues = distinctEvidence(claims, (claim) =>
    cleanOptionalText(claim.dog.colour, 64)?.toLocaleUpperCase("en-AU"),
  );
  const whelpValues = distinctEvidence(claims, (claim) =>
    claim.whelpDate?.toISOString().slice(0, 10),
  );
  const sireValues = distinctEvidence(claims, (claim) => parentExactKey(claim.dog.sire));
  const damValues = distinctEvidence(claims, (claim) => parentExactKey(claim.dog.dam));
  if (
    nameValues.size !== 1 ||
    registryValues.size > 1 ||
    sexValues.size > 1 ||
    colourValues.size > 1 ||
    whelpValues.size > 1 ||
    sireValues.size > 1 ||
    damValues.size > 1
  ) {
    return null;
  }

  return claims.slice(1).reduce<DogIdentityClaim>(
    (merged, claim) => ({
      ...merged,
      dog: {
        ...merged.dog,
        earBrand: merged.dog.earBrand ?? claim.dog.earBrand,
        sex: merged.dog.sex ?? claim.dog.sex,
        colour: merged.dog.colour ?? claim.dog.colour,
        whelpDate: merged.dog.whelpDate ?? claim.dog.whelpDate,
        sire: merged.dog.sire ?? claim.dog.sire,
        dam: merged.dog.dam ?? claim.dog.dam,
      },
      whelpDate: merged.whelpDate ?? claim.whelpDate,
    }),
    first,
  );
}

function distinctEvidence(
  claims: DogIdentityClaim[],
  select: (claim: DogIdentityClaim) => string | undefined,
) {
  return new Set(claims.map(select).filter((value): value is string => Boolean(value)));
}

function parentExactKey(parent: LiveDog["sire"]) {
  return exactDogKey(parent?.sourceProvider, parent?.sourceId) || undefined;
}

function addDogIdentityClaim(
  idsByClaim: Map<string, Set<string>>,
  key: string,
  dogId: string,
) {
  const ids = idsByClaim.get(key) ?? new Set<string>();
  ids.add(dogId);
  idsByClaim.set(key, ids);
}

function logDogIdentitySkip(
  logContext: LogCorrelationContext,
  reason: string,
  value: Partial<DogIdentityClaim> & {
    dogName?: string;
    observations?: number;
    matchingCanonicalRecords?: number;
  },
  quarantineEvents: LiveFeedQuarantineInput[],
) {
  logCorrelatedWarn(logContext, "live.dog_identity.skipped", {
    reason,
    provider: value.sourceProvider,
    sourceId: value.sourceId,
    dogName: value.dogName ?? value.dog?.name,
    observations: value.observations,
    matchingCanonicalRecords: value.matchingCanonicalRecords,
  });
  const dogName = value.dogName ?? value.dog?.name;
  quarantineEvents.push({
    provider: quarantineProvider(value.sourceProvider),
    entityKind: "dog",
    sourceId: normalizeSourceId(value.sourceId) ?? null,
    naturalIdentity: dogName ?? null,
    reasonCode: reason,
    classification: dogIdentityQuarantineClassification(reason),
    evidence: {
      dogName,
      observations: value.observations,
      matchingCanonicalRecords: value.matchingCanonicalRecords,
    },
  });
}

function dogIdentityQuarantineClassification(
  reason: string,
): LiveFeedQuarantineClassification {
  if (reason === "invalid_or_placeholder_name") return "invalid";
  if (
    reason === "missing_stable_provider_identity" ||
    reason === "exact_identity_lookup_saturated" ||
    reason === "natural_identity_lookup_saturated" ||
    reason === "provider_not_approved_for_creation" ||
    reason === "created_identity_not_confirmed"
  ) {
    return "incomplete";
  }
  return "conflict";
}

function normalizeProvider(value?: string | null) {
  const provider = value?.trim().toLowerCase();
  return provider &&
    provider.length <= 64 &&
    /^[a-z0-9][a-z0-9._-]*$/.test(provider)
    ? provider
    : undefined;
}

function normalizeSourceId(value?: string | null) {
  const sourceId = value?.trim();
  return sourceId && sourceId.length <= 256 && !/[\u0000-\u001f\u007f]/.test(sourceId)
    ? sourceId
    : undefined;
}

function cleanRegistryToken(value?: string | null) {
  const token = value?.trim();
  return token && token.length <= 128 && !/[\u0000-\u001f\u007f]/.test(token)
    ? token
    : undefined;
}

function cleanDogName(value?: string | null) {
  const name = value?.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!name || name.length > 200) return undefined;
  return /^(?:unknown(?:\s+(?:dog|runner))?|unnamed|tba|tbd|n\/?a|vacant(?:\s+box)?|no\s+reserve|runner\s+\d+|dog\s+\d+|-)$/i.test(
    name,
  )
    ? undefined
    : name;
}

function normalizeDogName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleUpperCase("en-AU");
}

function cleanOptionalText(value: string | undefined, maximum: number) {
  const text = value?.trim();
  return text && text.length <= maximum ? text : null;
}

function parseOptionalDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

async function ensureTrainers(
  names: Array<string | undefined>,
  logContext: LogCorrelationContext,
) {
  const observedNames = new Set(
    names.map((name) => name?.trim()).filter((name): name is string => Boolean(name)),
  );
  if (observedNames.size > 0) {
    logCorrelatedWarn(logContext, "live.trainer_identity.skipped", {
      reason: "stable_provider_identity_not_modelled",
      observations: observedNames.size,
    });
  }
  return new Map<string, string>();
}

async function ensureRunners(
  db: LiveSyncDbClient,
  items: RunnerWithRace[],
  dogIds: Map<string, string>,
  trainerIds: Map<string, string>,
  quarantineEvents: LiveFeedQuarantineInput[],
) {
  if (items.length === 0) return new Map<string, RunnerRow>();
  const raceIds = [...new Set(items.map((item) => item.raceId))];
  const upserts: RunnerUpsertRow[] = [];

  for (const item of items) {
    const dogId = dogIds.get(dogKey(item.runner.dog));
    if (!dogId) {
      quarantineEvents.push({
        provider: quarantineProvider(
          item.runner.sourceProvider ?? item.sourceProvider,
        ),
        entityKind: "runner",
        sourceId: normalizeSourceId(item.runner.sourceId) ?? null,
        naturalIdentity: `${item.raceId}:${item.runner.boxNumber}`,
        reasonCode: "missing_canonical_dog_identity",
        classification: "incomplete",
        evidence: {
          raceSourceId: item.raceSourceId,
          boxNumber: item.runner.boxNumber,
          dogName: item.runner.dog.name,
          dogSourceProvider: item.runner.dog.sourceProvider,
          dogSourceId: item.runner.dog.sourceId,
        },
      });
      continue;
    }
    upserts.push({
      id: randomUUID(),
      raceId: item.raceId,
      boxNumber: item.runner.boxNumber,
      dogId,
      weight: item.runner.weight ?? null,
      trainerId: item.runner.trainerName
        ? trainerIds.get(item.runner.trainerName) ?? null
        : null,
      scratched: item.runner.scratched ?? false,
      sourceProvider: item.runner.sourceProvider ?? item.sourceProvider ?? null,
      sourceId:
        item.runner.sourceId ??
        (item.raceSourceId ? `${item.raceSourceId}#box-${item.runner.boxNumber}` : null),
      sourceRawJson: sanitizedRawJson(
        item.runner.sourceRawJson,
        item.runner.sourceProvider ?? item.sourceProvider,
        "runner"
      ),
    });
  }

  await bulkUpsertRunners(db, upserts);
  await removeUnreferencedRunnerDuplicates(db, raceIds);

  const allRows: RunnerRow[] = [];
  for (const raceIdChunk of chunks(raceIds, LOOKUP_QUERY_CHUNK_SIZE)) {
    allRows.push(...await db.runner.findMany({
      where: { raceId: { in: raceIdChunk } },
      select: { id: true, raceId: true, boxNumber: true, dogId: true },
      take: LOOKUP_QUERY_LIMIT,
    }));
  }
  return new Map(allRows.map((row) => [runnerKey(row.raceId, row.boxNumber), row]));
}

async function removeUnreferencedRunnerDuplicates(
  db: LiveSyncDbClient,
  raceIds: string[]
) {
  for (const chunk of chunks(raceIds, LOOKUP_QUERY_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;

    await db.$executeRaw`
      WITH ranked AS (
        SELECT
          runner.id,
          result.id AS "resultId",
          ROW_NUMBER() OVER (
            PARTITION BY runner."raceId", runner."dogId"
            ORDER BY
              CASE WHEN result.id IS NOT NULL THEN 0 ELSE 1 END,
              CASE WHEN runner.scratched THEN 1 ELSE 0 END,
              CASE WHEN runner."boxNumber" BETWEEN 1 AND 8 THEN 0 ELSE 1 END,
              runner."boxNumber",
              runner.id
          ) AS identity_rank
        FROM "Runner" runner
        LEFT JOIN "Result" result ON result."runnerId" = runner.id
        WHERE runner."raceId" IN (${Prisma.join(chunk)})
      ),
      stale AS (
        SELECT id
        FROM ranked
        WHERE identity_rank > 1
          AND "resultId" IS NULL
      )
      DELETE FROM "Runner" runner
      USING stale
      WHERE runner.id = stale.id
    `;
  }
}

async function bulkUpsertRunners(db: LiveSyncDbClient, rows: RunnerUpsertRow[]) {
  const uniqueRows = uniqueBy(rows, (row) => runnerKey(row.raceId, row.boxNumber));
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db.$executeRaw`
      INSERT INTO "Runner"
        ("id", "raceId", "boxNumber", "dogId", "weight", "trainerId", "scratched", "sourceProvider", "sourceId", "sourceRawJson", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.raceId}, ${row.boxNumber}, ${row.dogId}, ${row.weight}, ${row.trainerId}, ${row.scratched}, ${row.sourceProvider}, ${row.sourceId}, ${row.sourceRawJson}, NOW())
        `)
      )}
      ON CONFLICT ("raceId", "boxNumber") ${conflictAction(Prisma.sql`DO UPDATE SET
        "dogId" = EXCLUDED."dogId",
        "weight" = COALESCE(EXCLUDED."weight", "Runner"."weight"),
        "trainerId" = COALESCE(EXCLUDED."trainerId", "Runner"."trainerId"),
        "scratched" = EXCLUDED."scratched",
        "sourceProvider" = EXCLUDED."sourceProvider",
        "sourceId" = EXCLUDED."sourceId",
        "sourceRawJson" = EXCLUDED."sourceRawJson"`)}
    `;
  }
}

async function ensureResults(
  db: LiveSyncDbClient,
  items: RunnerWithRace[],
  runners: Map<string, RunnerRow>
) {
  const resultItems = items.filter((item) => item.runner.finishingPosition != null);
  if (resultItems.length === 0) return 0;

  const rows = resultItems.flatMap((item) => {
    const runner = runners.get(runnerKey(item.raceId, item.runner.boxNumber));
    if (!runner) return [];
    const now = new Date();
    return [
      {
        id: randomUUID(),
        runnerId: runner.id,
        raceId: item.raceId,
        finishingPosition: item.runner.finishingPosition ?? null,
        runningTime: item.runner.runningTime ?? null,
        margin: item.runner.margin ?? null,
        prizeMoneyWon: item.runner.prizeMoneyWon ?? null,
        splitTime: item.runner.splitTime ?? null,
        sectionals: item.runner.sectionals ?? null,
        sourceProvider: item.runner.sourceProvider ?? item.sourceProvider ?? null,
        sourceId:
          item.runner.sourceId ??
          (item.raceSourceId ? `${item.raceSourceId}#box-${item.runner.boxNumber}` : null),
        sourceRawJson: sanitizedRawJson(
          item.runner.sourceRawJson,
          item.runner.sourceProvider ?? item.sourceProvider,
          "runner"
        ),
        lastSyncedAt: now,
      },
    ];
  });

  await bulkUpsertResults(db, rows);
  return rows.length;
}

async function bulkUpsertResults(db: LiveSyncDbClient, rows: ResultUpsertRow[]) {
  const uniqueRows = mergeResultRows(rows);
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db.$executeRaw`
      INSERT INTO "Result"
        ("id", "runnerId", "raceId", "finishingPosition", "runningTime", "margin", "prizeMoneyWon", "splitTime", "sectionals", "sourceProvider", "sourceId", "sourceRawJson", "lastSyncedAt", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.runnerId}, ${row.raceId}, ${row.finishingPosition}, ${row.runningTime}, ${row.margin}, ${row.prizeMoneyWon}, ${row.splitTime}, ${row.sectionals}, ${row.sourceProvider}, ${row.sourceId}, ${row.sourceRawJson}, ${row.lastSyncedAt}, NOW())
        `)
      )}
      ON CONFLICT ("runnerId") ${conflictAction(Prisma.sql`DO UPDATE SET
        "raceId" = EXCLUDED."raceId",
        "finishingPosition" = EXCLUDED."finishingPosition",
        "runningTime" = COALESCE(EXCLUDED."runningTime", "Result"."runningTime"),
        "margin" = COALESCE(EXCLUDED."margin", "Result"."margin"),
        "prizeMoneyWon" = COALESCE(EXCLUDED."prizeMoneyWon", "Result"."prizeMoneyWon"),
        "splitTime" = COALESCE(EXCLUDED."splitTime", "Result"."splitTime"),
        "sectionals" = COALESCE(EXCLUDED."sectionals", "Result"."sectionals"),
        "sourceProvider" = EXCLUDED."sourceProvider",
        "sourceId" = EXCLUDED."sourceId",
        "sourceRawJson" = COALESCE(EXCLUDED."sourceRawJson", "Result"."sourceRawJson"),
        "lastSyncedAt" = EXCLUDED."lastSyncedAt"`)}
    `;
  }
}

function mergeResultRows(rows: ResultUpsertRow[]) {
  const byRunner = new Map<string, ResultUpsertRow>();
  for (const row of rows) {
    const existing = byRunner.get(row.runnerId);
    if (!existing) {
      byRunner.set(row.runnerId, row);
      continue;
    }
    byRunner.set(row.runnerId, {
      ...row,
      finishingPosition: row.finishingPosition ?? existing.finishingPosition,
      runningTime: row.runningTime ?? existing.runningTime,
      margin: row.margin ?? existing.margin,
      prizeMoneyWon: row.prizeMoneyWon ?? existing.prizeMoneyWon,
      splitTime: row.splitTime ?? existing.splitTime,
      sectionals: row.sectionals ?? existing.sectionals,
      sourceRawJson: row.sourceRawJson ?? existing.sourceRawJson,
    });
  }
  return [...byRunner.values()];
}

async function ensureFormEntries(
  db: LiveSyncDbClient,
  items: RunnerWithRace[],
  runners: Map<string, RunnerRow>
) {
  const rows = items.flatMap((item) => {
    if (item.runner.finishingPosition == null) return [];
    const runner = runners.get(runnerKey(item.raceId, item.runner.boxNumber));
    if (!runner) return [];
    return [
      {
        id: randomUUID(),
        dogId: runner.dogId,
        raceId: item.raceId,
        trackId: item.trackId,
        date: item.meetingDate,
        boxNumber: item.runner.boxNumber,
        finish: item.runner.finishingPosition ?? null,
        time: item.runner.runningTime ?? null,
        distance: item.distance || null,
        grade: item.grade ?? null,
        weight: item.runner.weight ?? null,
      },
    ];
  });

  await bulkUpsertFormEntries(db, rows);
}

async function bulkUpsertFormEntries(db: LiveSyncDbClient, rows: FormEntryUpsertRow[]) {
  const uniqueRows = uniqueBy(rows, (row) => `${row.dogId}:${row.raceId}`);
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db.$executeRaw`
      INSERT INTO "FormEntry"
        ("id", "dogId", "raceId", "trackId", "date", "boxNumber", "finish", "time", "distance", "grade", "weight", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.dogId}, ${row.raceId}, ${row.trackId}, ${row.date}, ${row.boxNumber}, ${row.finish}, ${row.time}, ${row.distance}, ${row.grade}, ${row.weight}, NOW())
        `)
      )}
      ON CONFLICT ("dogId", "raceId") ${conflictAction(Prisma.sql`DO UPDATE SET
        "trackId" = EXCLUDED."trackId",
        "date" = EXCLUDED."date",
        "boxNumber" = EXCLUDED."boxNumber",
        "finish" = EXCLUDED."finish",
        "time" = EXCLUDED."time",
        "distance" = EXCLUDED."distance",
        "grade" = EXCLUDED."grade",
        "weight" = COALESCE(EXCLUDED."weight", "FormEntry"."weight")`)}
    `;
  }
}

async function collectOrphanedFormEntries(
  db: LiveSyncDbClient,
  items: RunnerWithRace[],
  quarantineEvents: LiveFeedQuarantineInput[],
  orphanedFormEntries: OrphanedFormEntryRow[],
) {
  const providerByRaceId = new Map(
    items.map((item) => [
      item.raceId,
      item.runner.sourceProvider ?? item.sourceProvider,
    ] as const),
  );
  const affectedRaceIds = [...providerByRaceId.keys()];
  const rows: OrphanedFormEntryRow[] = [];

  for (const raceIdChunk of chunks(affectedRaceIds, LOOKUP_QUERY_CHUNK_SIZE)) {
    const remaining = FORM_ENTRY_ORPHAN_SCAN_LIMIT + 1 - rows.length;
    if (remaining <= 0) break;
    const chunkRows = await db.$queryRaw<OrphanedFormEntryRow[]>(Prisma.sql`
      SELECT
        form_entry."id",
        form_entry."dogId",
        form_entry."raceId"
      FROM "FormEntry" AS form_entry
      WHERE form_entry."raceId" IN (${Prisma.join(raceIdChunk)})
        AND NOT EXISTS (
          SELECT 1
          FROM "Runner" AS runner
          WHERE runner."raceId" = form_entry."raceId"
            AND runner."dogId" = form_entry."dogId"
        )
      ORDER BY form_entry."id"
      LIMIT ${remaining}
    `);
    rows.push(...chunkRows);
    if (rows.length > FORM_ENTRY_ORPHAN_SCAN_LIMIT) break;
  }

  const boundedRows = rows.slice(0, FORM_ENTRY_ORPHAN_SCAN_LIMIT);
  for (const row of boundedRows) {
    orphanedFormEntries.push(row);
    quarantineEvents.push({
      provider: quarantineProvider(providerByRaceId.get(row.raceId)),
      entityKind: "form_entry",
      sourceId: row.id,
      naturalIdentity: `${row.raceId}:${row.dogId}`,
      reasonCode: "form_entry_runner_missing_after_live_sync",
      classification: "conflict",
      evidence: {
        formEntryId: row.id,
        dogId: row.dogId,
        raceId: row.raceId,
      },
    });
  }

  if (rows.length > FORM_ENTRY_ORPHAN_SCAN_LIMIT) {
    throw new Error("live.form_entry_orphan_scan_limit_exceeded");
  }
  return boundedRows.length;
}

async function detachQuarantinedFormEntryRaceLinks(
  rows: OrphanedFormEntryRow[],
) {
  if (rows.length === 0) return 0;
  return withDbSystemContext(
    async (tx) => {
      let detached = 0;
      for (const rowChunk of chunks(rows, BULK_WRITE_CHUNK_SIZE)) {
        detached += await tx.$executeRaw`
          WITH captured ("id", "dogId", "raceId") AS (
            VALUES ${Prisma.join(
              rowChunk.map((row) => Prisma.sql`
                (${row.id}, ${row.dogId}, ${row.raceId})
              `),
            )}
          )
          UPDATE "FormEntry" AS form_entry
          SET "raceId" = NULL
          FROM captured
          WHERE form_entry."id" = captured."id"
            AND form_entry."dogId" = captured."dogId"
            AND form_entry."raceId" = captured."raceId"
            AND NOT EXISTS (
              SELECT 1
              FROM "Runner" AS runner
              WHERE runner."raceId" = captured."raceId"
                AND runner."dogId" = captured."dogId"
            )
        `;
      }
      return detached;
    },
    {
      maxWait: LIVE_SYNC_TRANSACTION_MAX_WAIT_MS,
      timeout: LIVE_SYNC_TRANSACTION_TIMEOUT_MS,
    },
  );
}

function meetingDate(meeting: LiveMeeting) {
  return new Date(meeting.meetingDate);
}

export function acceptedMeetingKey(
  meeting: LiveMeeting,
  tracks: Map<string, TrackRow>,
) {
  const track = tracks.get(canonicalTrackName(meeting.trackName));
  const state = normalizeAustralianTrackState(meeting.state);
  return track && state && track.state === state
    ? naturalMeetingKey(track.id, meetingDate(meeting))
    : null;
}

function naturalMeetingKey(trackId: string, date: Date) {
  return `${trackId}:${date.toISOString().slice(0, 10)}`;
}

function raceKey(meetingId: string, race: { raceNumber: number }) {
  return `${meetingId}:R${race.raceNumber}`;
}

function runnerKey(raceId: string, boxNumber: number) {
  return `${raceId}:B${boxNumber}`;
}

export function normalizeRaceRunners(
  runners: LiveRunner[],
  onDiscarded?: (discarded: LiveRunner, preferred: LiveRunner) => void,
) {
  const normalized: LiveRunner[] = [];
  const indexesByDog = new Map<string, number>();

  for (const runner of runners) {
    const identity = dogKey(runner.dog);
    if (!identity) {
      normalized.push(runner);
      continue;
    }

    const existingIndex = indexesByDog.get(identity);
    if (existingIndex == null) {
      indexesByDog.set(identity, normalized.length);
      normalized.push(runner);
      continue;
    }

    const existing = normalized[existingIndex];
    if (isPreferredRunner(runner, existing)) {
      normalized[existingIndex] = runner;
      onDiscarded?.(existing, runner);
    } else {
      onDiscarded?.(runner, existing);
    }
  }

  return normalized;
}

function isPreferredRunner(candidate: LiveRunner, existing: LiveRunner) {
  const candidateScore = runnerIdentityScore(candidate);
  const existingScore = runnerIdentityScore(existing);
  if (candidateScore !== existingScore) return candidateScore > existingScore;
  return candidate.boxNumber < existing.boxNumber;
}

function runnerIdentityScore(runner: LiveRunner) {
  let score = 0;
  if (runner.finishingPosition != null) score += 8;
  if (!runner.scratched) score += 4;
  if (runner.boxNumber >= 1 && runner.boxNumber <= 8) score += 2;
  else if (runner.boxNumber > 0) score += 1;
  return score;
}

function dogKey(dog: LiveDog) {
  return exactDogKey(dog.sourceProvider, dog.sourceId);
}

function exactDogKey(
  sourceProvider: string | null | undefined,
  sourceId: string | null | undefined,
) {
  const provider = normalizeProvider(sourceProvider);
  const id = normalizeSourceId(sourceId);
  return provider && id ? `${provider}:${id}` : "";
}

function inferEmbedSourceType(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  } catch {
    if (/\/videos\/watch\/races\/\d+\/replay\b/i.test(url)) return "race-replay";
    return null;
  }
  if (/\/videos\/watch\/races\/\d+\/replay\b/i.test(url)) return "race-replay";
  return null;
}

function uniqueBy<T>(rows: T[], keyFor: (row: T) => string) {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(keyFor(row), row);
  return [...byKey.values()];
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function uniqueByPreferredSource<T extends { sourceProvider: string | null }>(
  rows: T[],
  keyFor: (row: T) => string,
  onDiscarded?: (discarded: T, preferred: T, key: string) => void,
) {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = keyFor(row);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    if (sourceProviderRank(row.sourceProvider) >= sourceProviderRank(existing.sourceProvider)) {
      byKey.set(key, row);
      onDiscarded?.(existing, row, key);
    } else {
      onDiscarded?.(row, existing, key);
    }
  }
  return [...byKey.values()];
}

function sourceProviderRank(sourceProvider: string | null) {
  switch ((sourceProvider ?? "").toLowerCase()) {
    case "thedogs":
      return 40;
    case "topaz":
      return 30;
    case "watchdog":
      return 20;
    case "fasttrack-prototype":
      return 10;
    default:
      return 0;
  }
}

function quarantineProvider(value?: string | null) {
  return normalizeProvider(value) ?? "unknown";
}
