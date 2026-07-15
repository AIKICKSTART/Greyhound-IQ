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
const LOOKUP_QUERY_LIMIT = 5_000;
const LIVE_SYNC_TRANSACTION_MAX_WAIT_MS = 30_000;
const LIVE_SYNC_TRANSACTION_TIMEOUT_MS = 240_000;

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
    const meetings = stampMeetings(await provider.fetchUpcomingMeetings(days), provider.name);
    addCounts(counts, await upsertSystemMeetings(meetings, logContext));
  }
  if (scope === "results" || scope === "all") {
    const meetings = stampMeetings(await provider.fetchResults(days), provider.name);
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

  return prisma.$transaction(
    async (tx) => {
      await setLiveSyncSystemContext(tx);
      return upsertMeetings(tx, meetings, logContext);
    },
    {
      maxWait: LIVE_SYNC_TRANSACTION_MAX_WAIT_MS,
      timeout: LIVE_SYNC_TRANSACTION_TIMEOUT_MS,
    }
  );
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
      races: meeting.races.map((race) => ({
        ...race,
        sourceProvider: race.sourceProvider ?? sourceProvider,
      })),
    };
  });
}

async function upsertMeetings(
  db: LiveSyncDbClient,
  meetings: LiveMeeting[],
  logContext: LogCorrelationContext
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
    () => ensureTracks(db, meetings),
    logContext
  );
  const meetingRows = await syncStage(
    "ensureMeetings",
    { meetings: meetings.length, tracks: tracks.size },
    () => ensureMeetings(db, meetings, tracks, now),
    logContext
  );
  counts.meetings = meetings.length;

  const raceItems = meetings.flatMap((meeting) => {
    const meetingId = meetingRows.get(meetingKey(meeting, tracks))?.id;
    if (!meetingId) return [];
    return meeting.races.map((race) => ({ meeting, meetingId, race }));
  });

  const raceRows = await syncStage(
    "ensureRaces",
    { races: raceItems.length },
    () => ensureRaces(db, raceItems, now),
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
    const meetingRow = meetingRows.get(meetingKey(item.meeting, tracks));
    if (!raceId || !meetingRow) return [];
    return item.race.runners.map((runner) => ({
      raceId,
      trackId: meetingRow.trackId,
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
    () => ensureDogs(db, runnerItems.map((item) => item.runner.dog)),
    logContext
  );
  const trainerIds = await syncStage(
    "ensureTrainers",
    { runners: runnerItems.length },
    () => ensureTrainers(db, runnerItems.map((item) => item.runner.trainerName)),
    logContext
  );
  const runnerRows = await syncStage(
    "ensureRunners",
    { runners: runnerItems.length, dogs: dogIds.size, trainers: trainerIds.size },
    () => ensureRunners(db, runnerItems, dogIds, trainerIds),
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

async function ensureTracks(db: LiveSyncDbClient, meetings: LiveMeeting[]) {
  const byName = new Map<string, { name: string; state?: string }>();
  for (const meeting of meetings) {
    const trackName = canonicalTrackName(meeting.trackName);
    if (!byName.has(trackName)) {
      byName.set(trackName, {
        name: trackName,
        state: meeting.state,
      });
    }
  }

  const existing = await db.track.findMany({
    where: { name: { in: [...byName.keys()] } },
    select: { id: true, name: true, state: true },
    take: LOOKUP_QUERY_LIMIT,
  });
  const tracks = new Map(existing.map((track) => [track.name, track]));

  for (const track of byName.values()) {
    if (tracks.has(track.name)) continue;
    const created = await db.track.create({
      data: { name: track.name, state: track.state ?? "NSW" },
      select: { id: true, name: true, state: true },
    });
    tracks.set(created.name, created);
  }

  return tracks as Map<string, TrackRow>;
}

async function ensureMeetings(
  db: LiveSyncDbClient,
  meetings: LiveMeeting[],
  tracks: Map<string, TrackRow>,
  now: Date
) {
  const trackIds = [...new Set([...tracks.values()].map((track) => track.id))];
  const rows = meetings.flatMap((meeting): MeetingUpsertRow[] => {
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

  await bulkUpsertMeetings(db, rows);

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

async function ensureRaces(db: LiveSyncDbClient, items: RaceWithMeeting[], now: Date) {
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

  await bulkUpsertRaces(db, upserts);

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
        "sourceId" = EXCLUDED."sourceId",
        "pageUrl" = EXCLUDED."pageUrl",
        "embedSourceType" = EXCLUDED."embedSourceType",
        "sourceStatus" = EXCLUDED."sourceStatus",
        "sourceCode" = EXCLUDED."sourceCode",
        "streamUrl" = COALESCE(EXCLUDED."streamUrl", "RaceVideo"."streamUrl"),
        "streamContentType" = COALESCE(EXCLUDED."streamContentType", "RaceVideo"."streamContentType"),
        "title" = EXCLUDED."title",
        "description" = EXCLUDED."description",
        "sourceRawJson" = EXCLUDED."sourceRawJson",
        "fetchedAt" = COALESCE(EXCLUDED."fetchedAt", "RaceVideo"."fetchedAt"),
        "lastSyncedAt" = EXCLUDED."lastSyncedAt",
        "updatedAt" = NOW()`)}
    `;
  }
}

async function bulkUpsertMeetings(db: LiveSyncDbClient, rows: MeetingUpsertRow[]) {
  const uniqueRows = uniqueByPreferredSource(rows, (row) =>
    naturalMeetingKey(row.trackId, row.meetingDate)
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

async function bulkUpsertRaces(db: LiveSyncDbClient, rows: RaceUpsertRow[]) {
  const uniqueRows = uniqueByPreferredSource(rows, (row) =>
    raceKey(row.meetingId, { raceNumber: row.raceNumber })
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
        "replayUrl" = EXCLUDED."replayUrl",
        "photoFinishUrl" = EXCLUDED."photoFinishUrl",
        "sourceProvider" = ${updateRaceTimeOnConflict ? Prisma.sql`EXCLUDED."sourceProvider"` : Prisma.sql`COALESCE("Race"."sourceProvider", EXCLUDED."sourceProvider")`},
        "sourceId" = ${updateRaceTimeOnConflict ? Prisma.sql`EXCLUDED."sourceId"` : Prisma.sql`COALESCE("Race"."sourceId", EXCLUDED."sourceId")`},
        "sourceRawJson" = ${updateRaceTimeOnConflict ? Prisma.sql`EXCLUDED."sourceRawJson"` : Prisma.sql`COALESCE("Race"."sourceRawJson", EXCLUDED."sourceRawJson")`},
        "lastSyncedAt" = EXCLUDED."lastSyncedAt"`)}
    `;
  }
}

async function ensureDogs(db: LiveSyncDbClient, dogs: LiveDog[]) {
  const byKey = new Map<string, LiveDog>();
  for (const dog of dogs) {
    const key = dogKey(dog);
    if (key && !byKey.has(key)) byKey.set(key, dog);
  }

  const values = [...byKey.values()];
  if (values.length === 0) return new Map<string, string>();
  const existing: Array<{ id: string; name: string; earBrand: string | null }> = [];
  for (const valueChunk of chunks(values, LOOKUP_QUERY_CHUNK_SIZE)) {
    const names = [...new Set(valueChunk.map((dog) => dog.name).filter(Boolean))];
    const earBrands = [
      ...new Set(valueChunk
        .map((dog) => dog.earBrand)
        .filter((value): value is string => Boolean(value))),
    ];
    existing.push(...await db.dog.findMany({
      where: {
        OR: [
          ...(names.length > 0 ? [{ name: { in: names } }] : []),
          ...(earBrands.length > 0 ? [{ earBrand: { in: earBrands } }] : []),
        ],
      },
      select: { id: true, name: true, earBrand: true },
      take: LOOKUP_QUERY_LIMIT,
    }));
  }
  const ids = new Map<string, string>();
  for (const dog of existing) {
    if (dog.earBrand) ids.set(dog.earBrand, dog.id);
    ids.set(dog.name, dog.id);
  }

  for (const dog of values) {
    const existingId = dog.earBrand ? ids.get(dog.earBrand) : undefined;
    const nameId = ids.get(dog.name);
    if (existingId || !nameId || !dog.earBrand) continue;
    try {
      await db.dog.update({
        where: { id: nameId },
        data: {
          earBrand: dog.earBrand,
          sex: dog.sex,
          colour: dog.colour,
        },
      });
      ids.set(dog.earBrand, nameId);
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
  }

  const missing = values.filter((dog) => !ids.has(dogKey(dog)));

  if (missing.length > 0) {
    await db.dog.createMany({
      data: missing.map((dog) => ({
        name: dog.name,
        earBrand: dog.earBrand,
        sex: dog.sex,
        colour: dog.colour,
      })),
      skipDuplicates: true,
    });
    const created: Array<{ id: string; name: string; earBrand: string | null }> = [];
    for (const missingChunk of chunks(missing, LOOKUP_QUERY_CHUNK_SIZE)) {
      created.push(...await db.dog.findMany({
        where: {
          OR: [
            { name: { in: missingChunk.map((dog) => dog.name) } },
            {
              earBrand: {
                in: missingChunk
                  .map((dog) => dog.earBrand)
                  .filter((value): value is string => Boolean(value)),
              },
            },
          ],
        },
        select: { id: true, name: true, earBrand: true },
        take: LOOKUP_QUERY_LIMIT,
      }));
    }
    for (const dog of created) {
      if (!ids.has(dog.name)) ids.set(dog.name, dog.id);
      if (dog.earBrand && !ids.has(dog.earBrand)) ids.set(dog.earBrand, dog.id);
    }
  }

  return ids;
}

function isUniqueConstraintError(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

async function ensureTrainers(db: LiveSyncDbClient, names: Array<string | undefined>) {
  const uniqueNames = [
    ...new Set(names.filter((name): name is string => Boolean(name))),
  ];
  if (uniqueNames.length === 0) return new Map<string, string>();

  const existing: Array<{ id: string; name: string }> = [];
  for (const nameChunk of chunks(uniqueNames, LOOKUP_QUERY_CHUNK_SIZE)) {
    existing.push(...await db.trainer.findMany({
      where: { name: { in: nameChunk } },
      select: { id: true, name: true },
      take: LOOKUP_QUERY_LIMIT,
    }));
  }
  const ids = new Map(existing.map((trainer) => [trainer.name, trainer.id]));
  const missing = uniqueNames.filter((name) => !ids.has(name));

  if (missing.length > 0) {
    await db.trainer.createMany({
      data: missing.map((name) => ({ name })),
    });
    const created: Array<{ id: string; name: string }> = [];
    for (const nameChunk of chunks(missing, LOOKUP_QUERY_CHUNK_SIZE)) {
      created.push(...await db.trainer.findMany({
        where: { name: { in: nameChunk } },
        select: { id: true, name: true },
        take: LOOKUP_QUERY_LIMIT,
      }));
    }
    for (const trainer of created) {
      if (!ids.has(trainer.name)) ids.set(trainer.name, trainer.id);
    }
  }

  return ids;
}

async function ensureRunners(
  db: LiveSyncDbClient,
  items: RunnerWithRace[],
  dogIds: Map<string, string>,
  trainerIds: Map<string, string>
) {
  if (items.length === 0) return new Map<string, RunnerRow>();
  const raceIds = [...new Set(items.map((item) => item.raceId))];
  const upserts: RunnerUpsertRow[] = [];

  for (const item of items) {
    const dogId = dogIds.get(dogKey(item.runner.dog));
    if (!dogId) continue;
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
        "weight" = EXCLUDED."weight",
        "trainerId" = EXCLUDED."trainerId",
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
        "weight" = EXCLUDED."weight"`)}
    `;
  }
}

function meetingDate(meeting: LiveMeeting) {
  return new Date(meeting.meetingDate);
}

function meetingKey(meeting: LiveMeeting, tracks: Map<string, TrackRow>) {
  const track = tracks.get(canonicalTrackName(meeting.trackName));
  return track ? naturalMeetingKey(track.id, meetingDate(meeting)) : "";
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

function dogKey(dog: LiveDog) {
  return dog.earBrand ?? dog.name;
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
  keyFor: (row: T) => string
) {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = keyFor(row);
    const existing = byKey.get(key);
    if (!existing || sourceProviderRank(row.sourceProvider) >= sourceProviderRank(existing.sourceProvider)) {
      byKey.set(key, row);
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
