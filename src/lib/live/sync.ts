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

type SyncCounts = {
  meetings: number;
  races: number;
  runners: number;
  results: number;
};

export type SyncScope = "upcoming" | "results" | "all";

type TrackRow = { id: string; name: string; state: string };
type MeetingRow = { id: string; trackId: string; meetingDate: Date };
type RaceRow = { id: string; meetingId: string; raceNumber: number };
type RunnerRow = { id: string; raceId: string; boxNumber: number };

type RaceWithMeeting = {
  meeting: LiveMeeting;
  meetingId: string;
  race: LiveRace;
};

type RunnerWithRace = {
  raceId: string;
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
  const fetched: LiveMeeting[] = [];
  if (scope === "upcoming" || scope === "all") {
    fetched.push(...(await provider.fetchUpcomingMeetings(days)));
  }
  if (scope === "results" || scope === "all") {
    fetched.push(...(await provider.fetchResults(days)));
  }

  const meetings = stampMeetings(fetched, provider.name);
  const counts = await upsertMeetings(meetings);
  console.log(
    `[live-sync] Synced ${counts.meetings} meetings, ${counts.races} races, ${counts.runners} runners, ${counts.results} results via ${provider.name} (${scope}).`
  );
  return { synced: true, provider: provider.name, scope, ...counts };
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
  const tracks = await ensureTracks(meetings);
  const meetingRows = await ensureMeetings(meetings, tracks, now);
  counts.meetings = meetings.length;

  const raceItems = meetings.flatMap((meeting) => {
    const meetingId = meetingRows.get(meetingKey(meeting, tracks))?.id;
    if (!meetingId) return [];
    return meeting.races.map((race) => ({ meeting, meetingId, race }));
  });

  const raceRows = await ensureRaces(raceItems, now);
  counts.races = raceItems.length;

  const runnerItems = raceItems.flatMap((item) => {
    const raceId = raceRows.get(raceKey(item.meetingId, item.race))?.id;
    if (!raceId) return [];
    return item.race.runners.map((runner) => ({ raceId, runner }));
  });

  const dogIds = await ensureDogs(runnerItems.map((item) => item.runner.dog));
  const trainerIds = await ensureTrainers(
    runnerItems.map((item) => item.runner.trainerName)
  );
  const runnerRows = await ensureRunners(runnerItems, dogIds, trainerIds);
  counts.runners = runnerItems.length;
  counts.results = await ensureResults(runnerItems, runnerRows);

  return counts;
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
  const dates = [...new Set(meetings.map((meeting) => meetingDate(meeting).toISOString()))]
    .map((date) => new Date(date));
  const sourcePairs = meetings
    .filter((meeting) => meeting.sourceId)
    .map((meeting) => ({
      sourceProvider: meeting.sourceProvider,
      sourceId: meeting.sourceId,
    }));

  const existing = await prisma.meeting.findMany({
    where: {
      OR: [
        { trackId: { in: trackIds }, meetingDate: { in: dates } },
        ...sourcePairs.map((pair) => ({
          sourceProvider: pair.sourceProvider,
          sourceId: pair.sourceId,
        })),
      ],
    },
    select: { id: true, trackId: true, meetingDate: true },
  });
  const rows = new Map<string, MeetingRow>();
  for (const row of existing) {
    rows.set(naturalMeetingKey(row.trackId, row.meetingDate), row);
  }

  await mapLimit(meetings, 10, async (meeting) => {
    const track = tracks.get(meeting.trackName);
    if (!track) return;
    const key = naturalMeetingKey(track.id, meetingDate(meeting));
    const data = {
      meetingType: meeting.meetingType,
      sourceProvider: meeting.sourceProvider,
      sourceId: meeting.sourceId,
      lastSyncedAt: now,
    };
    const existingRow = rows.get(key);
    if (existingRow) {
      await prisma.meeting.update({
        where: { id: existingRow.id },
        data,
      });
      return;
    }
    const created = await prisma.meeting.create({
      data: {
        trackId: track.id,
        meetingDate: meetingDate(meeting),
        ...data,
      },
      select: { id: true, trackId: true, meetingDate: true },
    });
    rows.set(key, created);
  });

  return rows;
}

async function ensureRaces(items: RaceWithMeeting[], now: Date) {
  if (items.length === 0) return new Map<string, RaceRow>();
  const meetingIds = [...new Set(items.map((item) => item.meetingId))];
  const existing = await prisma.race.findMany({
    where: { meetingId: { in: meetingIds } },
    select: { id: true, meetingId: true, raceNumber: true },
  });
  const rows = new Map(existing.map((row) => [raceKey(row.meetingId, row), row]));

  await mapLimit(items, 25, async (item) => {
    const key = raceKey(item.meetingId, item.race);
    const data = {
      raceTime: new Date(item.race.raceTime),
      distance: item.race.distance,
      grade: item.race.grade,
      prizeMoney: item.race.prizeMoney,
      sourceProvider: item.race.sourceProvider ?? item.meeting.sourceProvider,
      sourceId: item.race.sourceId,
      lastSyncedAt: now,
    };
    const existingRow = rows.get(key);
    if (existingRow) {
      await prisma.race.update({ where: { id: existingRow.id }, data });
      return;
    }
    const created = await prisma.race.create({
      data: {
        meetingId: item.meetingId,
        raceNumber: item.race.raceNumber,
        ...data,
      },
      select: { id: true, meetingId: true, raceNumber: true },
    });
    rows.set(key, created);
  });

  return rows;
}

async function ensureDogs(dogs: LiveDog[]) {
  const byName = new Map<string, LiveDog>();
  for (const dog of dogs) {
    if (dog.name && !byName.has(dog.name)) byName.set(dog.name, dog);
  }

  const existing = await prisma.dog.findMany({
    where: { name: { in: [...byName.keys()] } },
    select: { id: true, name: true },
  });
  const ids = new Map(existing.map((dog) => [dog.name, dog.id]));
  const missing = [...byName.values()].filter((dog) => !ids.has(dog.name));

  if (missing.length > 0) {
    await prisma.dog.createMany({
      data: missing.map((dog) => ({
        name: dog.name,
        earBrand: dog.earBrand,
        sex: dog.sex,
        colour: dog.colour,
      })),
    });
    const created = await prisma.dog.findMany({
      where: { name: { in: missing.map((dog) => dog.name) } },
      select: { id: true, name: true },
    });
    for (const dog of created) {
      if (!ids.has(dog.name)) ids.set(dog.name, dog.id);
    }
  }

  return ids;
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
    const dogId = dogIds.get(item.runner.dog.name);
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
    });
  }

  await bulkUpsertRunners(upserts);

  const allRows = await prisma.runner.findMany({
    where: { raceId: { in: raceIds } },
    select: { id: true, raceId: true, boxNumber: true },
  });
  return new Map(allRows.map((row) => [runnerKey(row.raceId, row.boxNumber), row]));
}

async function bulkUpsertRunners(rows: RunnerUpsertRow[]) {
  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    if (chunk.length === 0) continue;

    await prisma.$executeRaw`
      INSERT INTO "Runner"
        ("id", "raceId", "boxNumber", "dogId", "weight", "trainerId", "startingPrice", "scratched", "createdAt")
      VALUES ${Prisma.join(
        chunk.map((row) => Prisma.sql`
          (${row.id}, ${row.raceId}, ${row.boxNumber}, ${row.dogId}, ${row.weight}, ${row.trainerId}, ${row.startingPrice}, ${row.scratched}, NOW())
        `)
      )}
      ON CONFLICT ("raceId", "boxNumber") DO UPDATE SET
        "dogId" = EXCLUDED."dogId",
        "weight" = EXCLUDED."weight",
        "trainerId" = EXCLUDED."trainerId",
        "startingPrice" = EXCLUDED."startingPrice",
        "scratched" = EXCLUDED."scratched"
    `;
  }
}

async function ensureResults(
  items: RunnerWithRace[],
  runners: Map<string, RunnerRow>
) {
  const resultItems = items.filter((item) => item.runner.finishingPosition != null);
  if (resultItems.length === 0) return 0;

  const runnerIds = resultItems
    .map((item) => runners.get(runnerKey(item.raceId, item.runner.boxNumber))?.id)
    .filter((id): id is string => Boolean(id));
  const existing = await prisma.result.findMany({
    where: { runnerId: { in: runnerIds } },
    select: { runnerId: true },
  });
  const existingIds = new Set(existing.map((result) => result.runnerId));

  const creates = resultItems.flatMap((item) => {
    const runner = runners.get(runnerKey(item.raceId, item.runner.boxNumber));
    if (!runner || existingIds.has(runner.id)) return [];
    return [
      {
        runnerId: runner.id,
        raceId: item.raceId,
        finishingPosition: item.runner.finishingPosition,
        runningTime: item.runner.runningTime,
        margin: item.runner.margin,
      },
    ];
  });
  const updates = resultItems.flatMap((item) => {
    const runner = runners.get(runnerKey(item.raceId, item.runner.boxNumber));
    if (!runner || !existingIds.has(runner.id)) return [];
    return [{ runnerId: runner.id, raceId: item.raceId, runner: item.runner }];
  });

  if (creates.length > 0) await prisma.result.createMany({ data: creates });
  await mapLimit(updates, 30, async (item) => {
    await prisma.result.update({
      where: { runnerId: item.runnerId },
      data: {
        raceId: item.raceId,
        finishingPosition: item.runner.finishingPosition,
        runningTime: item.runner.runningTime,
        margin: item.runner.margin,
      },
    });
  });

  return resultItems.length;
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, limit) }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        await worker(items[index]);
      }
    })
  );
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
