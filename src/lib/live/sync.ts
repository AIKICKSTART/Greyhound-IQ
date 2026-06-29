import { prisma } from "../db";
import { getLiveProvider, type LiveMeeting, type LiveRace } from "./provider";

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

async function upsertMeeting(m: LiveMeeting): Promise<void> {
  const tId = await trackId(m.trackName, m.state);
  const date = new Date(m.meetingDate);
  let meeting = await prisma.meeting.findFirst({ where: { trackId: tId, meetingDate: date } });
  if (!meeting) {
    meeting = await prisma.meeting.create({ data: { trackId: tId, meetingDate: date, meetingType: m.meetingType } });
  }
  for (const race of m.races) await upsertRace(meeting.id, race);
}

async function upsertRace(meetingId: string, race: LiveRace): Promise<void> {
  let row = await prisma.race.findFirst({ where: { meetingId, raceNumber: race.raceNumber } });
  if (!row) {
    row = await prisma.race.create({
      data: {
        meetingId,
        raceNumber: race.raceNumber,
        raceTime: new Date(race.raceTime),
        distance: race.distance,
        grade: race.grade,
        prizeMoney: race.prizeMoney,
      },
    });
  }
  for (const r of race.runners) {
    const dId = await dogId(r.dog.name, r.dog.earBrand, r.dog.sex, r.dog.colour);
    let runner = await prisma.runner.findFirst({ where: { raceId: row.id, boxNumber: r.boxNumber } });
    if (!runner) {
      runner = await prisma.runner.create({
        data: {
          raceId: row.id,
          dogId: dId,
          boxNumber: r.boxNumber,
          weight: r.weight,
          trainerId: await trainerId(r.trainerName),
          startingPrice: r.startingPrice,
          scratched: r.scratched ?? false,
        },
      });
    }
    if (r.finishingPosition != null) {
      const hasResult = await prisma.result.findUnique({ where: { runnerId: runner.id } });
      if (!hasResult) {
        await prisma.result.create({
          data: {
            runnerId: runner.id,
            raceId: row.id,
            finishingPosition: r.finishingPosition,
            runningTime: r.runningTime,
            margin: r.margin,
          },
        });
      }
    }
  }
}

export interface SyncResult {
  synced: boolean;
  provider?: string;
  meetings?: number;
}

// Pulls upcoming meetings + recent results from the configured live provider and
// upserts them. No-ops (synced:false) when no provider is wired — the app keeps
// running on seeded data.
export async function syncLiveData(days = 3): Promise<SyncResult> {
  const provider = getLiveProvider();
  if (!provider) {
    console.log("[live-sync] No live provider configured (set TOPAZ_API_KEY to enable). App uses seeded data.");
    return { synced: false };
  }
  console.log(`[live-sync] Using provider: ${provider.name}`);
  const meetings = [
    ...(await provider.fetchUpcomingMeetings(days)),
    ...(await provider.fetchResults(days)),
  ];
  for (const m of meetings) await upsertMeeting(m);
  console.log(`[live-sync] Synced ${meetings.length} meetings via ${provider.name}.`);
  return { synced: true, provider: provider.name, meetings: meetings.length };
}
