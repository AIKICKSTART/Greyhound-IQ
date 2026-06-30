import { prisma } from "../db";
import {
  getLiveProvider,
  getLiveProviderConfig,
  type LiveMeeting,
  type LiveRace,
} from "./provider";

type SyncCounts = {
  meetings: number;
  races: number;
  runners: number;
  results: number;
};

// Resolve-or-create helpers (the schema has no unique natural keys for these).
async function trackId(name: string, state?: string): Promise<string> {
  const existing = await prisma.track.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.track.create({ data: { name, state: state ?? "NSW" } });
  return created.id;
}

async function trainerId(name?: string): Promise<string | undefined> {
  if (!name) return undefined;
  const existing = await prisma.trainer.findFirst({ where: { name } });
  return (existing ?? (await prisma.trainer.create({ data: { name } }))).id;
}

async function dogId(name: string, earBrand?: string, sex?: string, colour?: string): Promise<string> {
  const existing = earBrand
    ? await prisma.dog.findFirst({ where: { earBrand } })
    : await prisma.dog.findFirst({ where: { name } });
  if (existing) return existing.id;
  return (await prisma.dog.create({ data: { name, earBrand, sex, colour } })).id;
}

async function upsertMeeting(m: LiveMeeting, counts: SyncCounts): Promise<void> {
  const tId = await trackId(m.trackName, m.state);
  const date = new Date(m.meetingDate);
  let meeting = await prisma.meeting.findFirst({ where: { trackId: tId, meetingDate: date } });
  if (!meeting) {
    meeting = await prisma.meeting.create({ data: { trackId: tId, meetingDate: date, meetingType: m.meetingType } });
  } else if (meeting.meetingType !== m.meetingType) {
    meeting = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { meetingType: m.meetingType },
    });
  }
  counts.meetings += 1;
  for (const race of m.races) await upsertRace(meeting.id, race, counts);
}

async function upsertRace(meetingId: string, race: LiveRace, counts: SyncCounts): Promise<void> {
  let row = await prisma.race.findFirst({ where: { meetingId, raceNumber: race.raceNumber } });
  const raceData = {
    raceTime: new Date(race.raceTime),
    distance: race.distance,
    grade: race.grade,
    prizeMoney: race.prizeMoney,
  };

  if (!row) {
    row = await prisma.race.create({
      data: {
        meetingId,
        raceNumber: race.raceNumber,
        ...raceData,
      },
    });
  } else {
    row = await prisma.race.update({
      where: { id: row.id },
      data: raceData,
    });
  }
  counts.races += 1;

  for (const r of race.runners) {
    const dId = await dogId(r.dog.name, r.dog.earBrand, r.dog.sex, r.dog.colour);
    const tId = await trainerId(r.trainerName);
    let runner = await prisma.runner.findFirst({ where: { raceId: row.id, boxNumber: r.boxNumber } });
    const runnerData = {
      dogId: dId,
      weight: r.weight,
      trainerId: tId,
      startingPrice: r.startingPrice,
      scratched: r.scratched ?? false,
    };

    if (!runner) {
      runner = await prisma.runner.create({
        data: {
          raceId: row.id,
          boxNumber: r.boxNumber,
          ...runnerData,
        },
      });
    } else {
      runner = await prisma.runner.update({
        where: { id: runner.id },
        data: runnerData,
      });
    }
    counts.runners += 1;

    if (r.finishingPosition != null) {
      const resultData = {
        raceId: row.id,
        finishingPosition: r.finishingPosition,
        runningTime: r.runningTime,
        margin: r.margin,
      };
      const existingResult = await prisma.result.findUnique({ where: { runnerId: runner.id } });
      if (!existingResult) {
        await prisma.result.create({
          data: {
            runnerId: runner.id,
            ...resultData,
          },
        });
      } else {
        await prisma.result.update({
          where: { runnerId: runner.id },
          data: resultData,
        });
      }
      counts.results += 1;
    }
  }
}

export interface SyncResult {
  synced: boolean;
  provider?: string;
  configured?: boolean;
  missingEnv?: string[];
  meetings?: number;
  races?: number;
  runners?: number;
  results?: number;
}

// Pulls upcoming meetings + recent results from the configured live provider and
// upserts them. No-ops (synced:false) when no provider is wired — the app keeps
// running on seeded data.
export async function syncLiveData(days = 3): Promise<SyncResult> {
  const provider = getLiveProvider();
  if (!provider) {
    const providerConfig = getLiveProviderConfig();
    const missingEnv = providerConfig.feeds.flatMap((feed) =>
      feed.blocking ? feed.missingEnv : []
    );
    console.log(
      "[live-sync] No live provider configured. Set TOPAZ_API_KEY or enable FASTTRACK_PROTOTYPE_ENABLED for prototype sync."
    );
    return {
      synced: false,
      provider: "none",
      configured: false,
      missingEnv,
    };
  }
  console.log(`[live-sync] Using provider: ${provider.name}`);
  const meetings = [
    ...(await provider.fetchUpcomingMeetings(days)),
    ...(await provider.fetchResults(days)),
  ];
  const counts: SyncCounts = { meetings: 0, races: 0, runners: 0, results: 0 };
  for (const m of meetings) await upsertMeeting(m, counts);
  console.log(
    `[live-sync] Synced ${counts.meetings} meetings, ${counts.races} races, ${counts.runners} runners, ${counts.results} results via ${provider.name}.`
  );
  return { synced: true, provider: provider.name, ...counts };
}
