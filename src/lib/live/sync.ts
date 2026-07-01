import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
  getLiveProvider,
  getLiveProviderConfig,
  type LiveDog,
  type LiveMeeting,
  type LiveRace,
  type LiveRunner,
} from "./provider";

export type SyncCounts = {
  meetings: number;
  races: number;
  runners: number;
  results: number;
};

export type SyncScope = "upcoming" | "results" | "all";

const BULK_WRITE_CHUNK_SIZE = 100;

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
  startingPrice: number | null;
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
  const provider = getLiveProvider();
  if (!provider) {
    const providerConfig = getLiveProviderConfig();
    const missingEnv = providerConfig.feeds.flatMap((feed) =>
      feed.blocking ? feed.missingEnv : []
    );
    console.log(
      "[live-sync] No live provider configured. Set TOPAZ_API_KEY, enable THEDOGS_PROVIDER_ENABLED, or enable FASTTRACK_PROTOTYPE_ENABLED for prototype sync."
    );
    return {
      synced: false,
      provider: "none",
      scope,
      configured: false,
      missingEnv,
    };
  }

  console.log(`[live-sync] Using provider: ${provider.name} scope=${scope}`);
  const counts: SyncCounts = { meetings: 0, races: 0, runners: 0, results: 0 };
  if (scope === "upcoming" || scope === "all") {
    addCounts(
      counts,
      await upsertMeetings(
        stampMeetings(await provider.fetchUpcomingMeetings(days), provider.name)
      )
    );
  }
  if (scope === "results" || scope === "all") {
    addCounts(
      counts,
      await upsertMeetings(stampMeetings(await provider.fetchResults(days), provider.name))
    );
  }

  console.log(
    `[live-sync] Synced ${counts.meetings} meetings, ${counts.races} races, ${counts.runners} runners, ${counts.results} results via ${provider.name} (${scope}).`
  );
  return { synced: true, provider: provider.name, scope, ...counts };
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
  return upsertMeetings(stampMeetings(meetings, fallbackProvider));
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

async function upsertMeetings(meetings: LiveMeeting[]): Promise<SyncCounts> {
  const counts: SyncCounts = { meetings: 0, races: 0, runners: 0, results: 0 };
  if (meetings.length === 0) return counts;

  const now = new Date();
  syncDebug("upsertMeetings start", {
    meetings: meetings.length,
    races: meetings.reduce((total, meeting) => total + meeting.races.length, 0),
  });
  const tracks = await syncStage("ensureTracks", { meetings: meetings.length }, () =>
    ensureTracks(meetings)
  );
  const meetingRows = await syncStage(
    "ensureMeetings",
    { meetings: meetings.length, tracks: tracks.size },
    () => ensureMeetings(meetings, tracks, now)
  );
  counts.meetings = meetings.length;

  const raceItems = meetings.flatMap((meeting) => {
    const meetingId = meetingRows.get(meetingKey(meeting, tracks))?.id;
    if (!meetingId) return [];
    return meeting.races.map((race) => ({ meeting, meetingId, race }));
  });

  const raceRows = await syncStage("ensureRaces", { races: raceItems.length }, () =>
    ensureRaces(raceItems, now)
  );
  await syncStage("ensureRaceVideos", { races: raceItems.length }, () =>
    ensureRaceVideos(raceItems, raceRows, now)
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

  const dogIds = await syncStage("ensureDogs", { runners: runnerItems.length }, () =>
    ensureDogs(runnerItems.map((item) => item.runner.dog))
  );
  const trainerIds = await syncStage(
    "ensureTrainers",
    { runners: runnerItems.length },
    () => ensureTrainers(runnerItems.map((item) => item.runner.trainerName))
  );
  const runnerRows = await syncStage(
    "ensureRunners",
    { runners: runnerItems.length, dogs: dogIds.size, trainers: trainerIds.size },
    () => ensureRunners(runnerItems, dogIds, trainerIds)
  );
  counts.runners = runnerItems.length;
  counts.results = await syncStage("ensureResults", { runners: runnerItems.length }, () =>
    ensureResults(runnerItems, runnerRows)
  );
  await syncStage("ensureFormEntries", { runners: runnerItems.length }, () =>
    ensureFormEntries(runnerItems, runnerRows)
  );
  syncDebug("upsertMeetings ok", counts);

  return counts;
}

async function syncStage<T>(
  name: string,
  meta: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> {
  if (!shouldDebugSync()) return run();

  const startedAt = Date.now();
  syncDebug(`${name} start`, meta);
  try {
    const result = await run();
    syncDebug(`${name} ok`, {
      ...meta,
      durationMs: Date.now() - startedAt,
      ...resultSummary(result),
    });
    return result;
  } catch (err) {
    syncDebug(`${name} failed`, {
      ...meta,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function syncDebug(message: string, meta?: Record<string, unknown>) {
  if (!shouldDebugSync()) return;
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[live-sync:debug] ${message}${suffix}`);
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

async function ensureTracks(meetings: LiveMeeting[]) {
  const byName = new Map<string, { name: string; state?: string }>();
  for (const meeting of meetings) {
    if (!byName.has(meeting.trackName)) {
      byName.set(meeting.trackName, {
        name: meeting.trackName,
        state: meeting.state,
      });
    }
  }

  const existing = await prisma.track.findMany({
    where: { name: { in: [...byName.keys()] } },
    select: { id: true, name: true, state: true },
  });
  const tracks = new Map(existing.map((track) => [track.name, track]));

  for (const track of byName.values()) {
    if (tracks.has(track.name)) continue;
    const created = await prisma.track.create({
      data: { name: track.name, state: track.state ?? "NSW" },
      select: { id: true, name: true, state: true },
    });
    tracks.set(created.name, created);
  }

  return tracks as Map<string, TrackRow>;
}

async function ensureMeetings(
  meetings: LiveMeeting[],
  tracks: Map<string, TrackRow>,
  now: Date
) {
  const trackIds = [...new Set([...tracks.values()].map((track) => track.id))];
  const rows = meetings.flatMap((meeting): MeetingUpsertRow[] => {
    const track = tracks.get(meeting.trackName);
    if (!track) return [];
    return [
      {
        id: randomUUID(),
        trackId: track.id,
        meetingDate: meetingDate(meeting),
        meetingType: meeting.meetingType ?? null,
        sourceProvider: meeting.sourceProvider ?? null,
        sourceId: meeting.sourceId ?? null,
        sourceRawJson: meeting.sourceRawJson ?? null,
        lastSyncedAt: now,
      },
    ];
  });

  await bulkUpsertMeetings(rows);

  const dates = [
    ...new Set(rows.map((row) => row.meetingDate.toISOString())),
  ].map((date) => new Date(date));
  const allRows = await prisma.meeting.findMany({
    where: { trackId: { in: trackIds }, meetingDate: { in: dates } },
    select: { id: true, trackId: true, meetingDate: true },
  });
  return new Map(
    allRows.map((row) => [naturalMeetingKey(row.trackId, row.meetingDate), row])
  );
}

async function ensureRaces(items: RaceWithMeeting[], now: Date) {
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
    sourceRawJson: item.race.sourceRawJson ?? null,
    lastSyncedAt: now,
  }));

  await bulkUpsertRaces(upserts);

  const allRows = await prisma.race.findMany({
    where: { meetingId: { in: meetingIds } },
    select: { id: true, meetingId: true, raceNumber: true },
  });
  return new Map(allRows.map((row) => [raceKey(row.meetingId, row), row]));
}

async function ensureRaceVideos(
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
        sourceRawJson: item.race.sourceRawJson ?? null,
        fetchedAt: now,
        lastSyncedAt: now,
      },
    ];
  });

  await bulkUpsertRaceVideos(rows);
  return rows.length;
}

async function bulkUpsertRaceVideos(rows: RaceVideoUpsertRow[]) {
  const uniqueRows = uniqueBy(
    rows,
    (row) => `${row.raceId}:${row.sourceProvider}:${row.kind}`
  );
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await prisma.$executeRaw`
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
        "streamUrl" = EXCLUDED."streamUrl",
        "streamContentType" = EXCLUDED."streamContentType",
        "title" = EXCLUDED."title",
        "description" = EXCLUDED."description",
        "sourceRawJson" = EXCLUDED."sourceRawJson",
        "fetchedAt" = EXCLUDED."fetchedAt",
        "lastSyncedAt" = EXCLUDED."lastSyncedAt",
        "updatedAt" = NOW()`)}
    `;
  }
}

async function bulkUpsertMeetings(rows: MeetingUpsertRow[]) {
  const uniqueRows = uniqueBy(rows, (row) =>
    naturalMeetingKey(row.trackId, row.meetingDate)
  );
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await prisma.$executeRaw`
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

async function bulkUpsertRaces(rows: RaceUpsertRow[]) {
  const uniqueRows = uniqueBy(rows, (row) =>
    raceKey(row.meetingId, { raceNumber: row.raceNumber })
  );
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await prisma.$executeRaw`
      INSERT INTO "Race"
        ("id", "meetingId", "raceNumber", "name", "raceTime", "distance", "grade", "prizeMoney", "resultStatus", "replayUrl", "photoFinishUrl", "sourceProvider", "sourceId", "sourceRawJson", "lastSyncedAt", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.meetingId}, ${row.raceNumber}, ${row.name}, ${row.raceTime}, ${row.distance}, ${row.grade}, ${row.prizeMoney}, ${row.resultStatus}, ${row.replayUrl}, ${row.photoFinishUrl}, ${row.sourceProvider}, ${row.sourceId}, ${row.sourceRawJson}, ${row.lastSyncedAt}, NOW())
        `)
      )}
      ON CONFLICT ("meetingId", "raceNumber") ${conflictAction(Prisma.sql`DO UPDATE SET
        "name" = EXCLUDED."name",
        "raceTime" = EXCLUDED."raceTime",
        "distance" = EXCLUDED."distance",
        "grade" = EXCLUDED."grade",
        "prizeMoney" = EXCLUDED."prizeMoney",
        "resultStatus" = EXCLUDED."resultStatus",
        "replayUrl" = EXCLUDED."replayUrl",
        "photoFinishUrl" = EXCLUDED."photoFinishUrl",
        "sourceProvider" = EXCLUDED."sourceProvider",
        "sourceId" = EXCLUDED."sourceId",
        "sourceRawJson" = EXCLUDED."sourceRawJson",
        "lastSyncedAt" = EXCLUDED."lastSyncedAt"`)}
    `;
  }
}

async function ensureDogs(dogs: LiveDog[]) {
  const byKey = new Map<string, LiveDog>();
  for (const dog of dogs) {
    const key = dogKey(dog);
    if (key && !byKey.has(key)) byKey.set(key, dog);
  }

  const values = [...byKey.values()];
  if (values.length === 0) return new Map<string, string>();
  const names = [...new Set(values.map((dog) => dog.name).filter(Boolean))];
  const earBrands = [
    ...new Set(values.map((dog) => dog.earBrand).filter((value): value is string => Boolean(value))),
  ];
  const dogLookupClauses: Prisma.DogWhereInput[] = [];
  if (names.length > 0) dogLookupClauses.push({ name: { in: names } });
  if (earBrands.length > 0) dogLookupClauses.push({ earBrand: { in: earBrands } });
  const existing = await prisma.dog.findMany({
    where: { OR: dogLookupClauses },
    select: { id: true, name: true, earBrand: true },
  });
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
      await prisma.dog.update({
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
    await prisma.dog.createMany({
      data: missing.map((dog) => ({
        name: dog.name,
        earBrand: dog.earBrand,
        sex: dog.sex,
        colour: dog.colour,
      })),
      skipDuplicates: true,
    });
    const created = await prisma.dog.findMany({
      where: {
        OR: [
          { name: { in: missing.map((dog) => dog.name) } },
          {
            earBrand: {
              in: missing
                .map((dog) => dog.earBrand)
                .filter((value): value is string => Boolean(value)),
            },
          },
        ],
      },
      select: { id: true, name: true, earBrand: true },
    });
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

async function ensureTrainers(names: Array<string | undefined>) {
  const uniqueNames = [
    ...new Set(names.filter((name): name is string => Boolean(name))),
  ];
  if (uniqueNames.length === 0) return new Map<string, string>();

  const existing = await prisma.trainer.findMany({
    where: { name: { in: uniqueNames } },
    select: { id: true, name: true },
  });
  const ids = new Map(existing.map((trainer) => [trainer.name, trainer.id]));
  const missing = uniqueNames.filter((name) => !ids.has(name));

  if (missing.length > 0) {
    await prisma.trainer.createMany({
      data: missing.map((name) => ({ name })),
    });
    const created = await prisma.trainer.findMany({
      where: { name: { in: missing } },
      select: { id: true, name: true },
    });
    for (const trainer of created) {
      if (!ids.has(trainer.name)) ids.set(trainer.name, trainer.id);
    }
  }

  return ids;
}

async function ensureRunners(
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
      startingPrice: item.runner.startingPrice ?? null,
      scratched: item.runner.scratched ?? false,
      sourceProvider: item.runner.sourceProvider ?? item.sourceProvider ?? null,
      sourceId:
        item.runner.sourceId ??
        (item.raceSourceId ? `${item.raceSourceId}#box-${item.runner.boxNumber}` : null),
      sourceRawJson: item.runner.sourceRawJson ?? null,
    });
  }

  await bulkUpsertRunners(upserts);

  const allRows = await prisma.runner.findMany({
    where: { raceId: { in: raceIds } },
    select: { id: true, raceId: true, boxNumber: true, dogId: true },
  });
  return new Map(allRows.map((row) => [runnerKey(row.raceId, row.boxNumber), row]));
}

async function bulkUpsertRunners(rows: RunnerUpsertRow[]) {
  const uniqueRows = uniqueBy(rows, (row) => runnerKey(row.raceId, row.boxNumber));
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await prisma.$executeRaw`
      INSERT INTO "Runner"
        ("id", "raceId", "boxNumber", "dogId", "weight", "trainerId", "startingPrice", "scratched", "sourceProvider", "sourceId", "sourceRawJson", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.raceId}, ${row.boxNumber}, ${row.dogId}, ${row.weight}, ${row.trainerId}, ${row.startingPrice}, ${row.scratched}, ${row.sourceProvider}, ${row.sourceId}, ${row.sourceRawJson}, NOW())
        `)
      )}
      ON CONFLICT ("raceId", "boxNumber") ${conflictAction(Prisma.sql`DO UPDATE SET
        "dogId" = EXCLUDED."dogId",
        "weight" = EXCLUDED."weight",
        "trainerId" = EXCLUDED."trainerId",
        "startingPrice" = EXCLUDED."startingPrice",
        "scratched" = EXCLUDED."scratched",
        "sourceProvider" = EXCLUDED."sourceProvider",
        "sourceId" = EXCLUDED."sourceId",
        "sourceRawJson" = EXCLUDED."sourceRawJson"`)}
    `;
  }
}

async function ensureResults(
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
        splitTime: item.runner.splitTime ?? null,
        sectionals: item.runner.sectionals ?? null,
        sourceProvider: item.runner.sourceProvider ?? item.sourceProvider ?? null,
        sourceId:
          item.runner.sourceId ??
          (item.raceSourceId ? `${item.raceSourceId}#box-${item.runner.boxNumber}` : null),
        sourceRawJson: item.runner.sourceRawJson ?? null,
        lastSyncedAt: now,
      },
    ];
  });

  await bulkUpsertResults(rows);
  return rows.length;
}

async function bulkUpsertResults(rows: ResultUpsertRow[]) {
  const uniqueRows = mergeResultRows(rows);
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await prisma.$executeRaw`
      INSERT INTO "Result"
        ("id", "runnerId", "raceId", "finishingPosition", "runningTime", "margin", "splitTime", "sectionals", "sourceProvider", "sourceId", "sourceRawJson", "lastSyncedAt", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.runnerId}, ${row.raceId}, ${row.finishingPosition}, ${row.runningTime}, ${row.margin}, ${row.splitTime}, ${row.sectionals}, ${row.sourceProvider}, ${row.sourceId}, ${row.sourceRawJson}, ${row.lastSyncedAt}, NOW())
        `)
      )}
      ON CONFLICT ("runnerId") ${conflictAction(Prisma.sql`DO UPDATE SET
        "raceId" = EXCLUDED."raceId",
        "finishingPosition" = EXCLUDED."finishingPosition",
        "runningTime" = COALESCE(EXCLUDED."runningTime", "Result"."runningTime"),
        "margin" = COALESCE(EXCLUDED."margin", "Result"."margin"),
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
      splitTime: row.splitTime ?? existing.splitTime,
      sectionals: row.sectionals ?? existing.sectionals,
      sourceRawJson: row.sourceRawJson ?? existing.sourceRawJson,
    });
  }
  return [...byRunner.values()];
}

async function ensureFormEntries(
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

  await bulkUpsertFormEntries(rows);
}

async function bulkUpsertFormEntries(rows: FormEntryUpsertRow[]) {
  const uniqueRows = uniqueBy(rows, (row) => `${row.dogId}:${row.raceId}`);
  for (let index = 0; index < uniqueRows.length; index += BULK_WRITE_CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + BULK_WRITE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await prisma.$executeRaw`
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
  const track = tracks.get(meeting.trackName);
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
    return null;
  }
  return null;
}

function uniqueBy<T>(rows: T[], keyFor: (row: T) => string) {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(keyFor(row), row);
  return [...byKey.values()];
}
