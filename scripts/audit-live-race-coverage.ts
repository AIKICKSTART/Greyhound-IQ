import "./load-env";
import { PrismaClient } from "@prisma/client";
import { TheDogsProvider } from "../src/lib/live/thedogs";

const prisma = new PrismaClient();
const days = positiveInt(process.argv[2], 7);

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function meetingKey(trackName: string, state: string | null | undefined, date: string) {
  return `${normalize(trackName)}:${(state ?? "").toUpperCase()}:${date}`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const provider = new TheDogsProvider();
  const expected = await provider.fetchUpcomingMeetings(days);
  const expectedDates = [
    ...new Set(expected.map((meeting) => dateKey(meeting.meetingDate))),
  ].map((date) => new Date(`${date}T00:00:00.000Z`));

  const dbMeetings = await prisma.meeting.findMany({
    where: {
      meetingDate: { in: expectedDates },
      sourceProvider: { not: null },
    },
    select: {
      id: true,
      meetingDate: true,
      sourceProvider: true,
      sourceId: true,
      lastSyncedAt: true,
      track: { select: { name: true, state: true } },
      races: {
        select: {
          id: true,
          raceNumber: true,
          sourceProvider: true,
          sourceId: true,
          lastSyncedAt: true,
          _count: { select: { runners: true } },
        },
      },
    },
  });

  const dbByKey = new Map(
    dbMeetings.map((meeting) => [
      meetingKey(
        meeting.track.name,
        meeting.track.state,
        dateKey(meeting.meetingDate)
      ),
      meeting,
    ])
  );

  const expectedRows = expected.map((meeting) => {
    const key = meetingKey(
      meeting.trackName,
      meeting.state,
      dateKey(meeting.meetingDate)
    );
    const dbMeeting = dbByKey.get(key);
    const expectedRunnerCount = meeting.races.reduce(
      (sum, race) => sum + race.runners.length,
      0
    );
    const dbRunnerCount =
      dbMeeting?.races.reduce((sum, race) => sum + race._count.runners, 0) ?? 0;

    return {
      key,
      trackName: meeting.trackName,
      state: meeting.state ?? null,
      date: dateKey(meeting.meetingDate),
      expectedRaces: meeting.races.length,
      expectedRunners: expectedRunnerCount,
      dbSourceProvider: dbMeeting?.sourceProvider ?? null,
      dbLastSyncedAt: dbMeeting?.lastSyncedAt?.toISOString() ?? null,
      dbRaces: dbMeeting?.races.length ?? 0,
      dbRunners: dbRunnerCount,
      ok:
        dbMeeting != null &&
        dbMeeting.races.length >= meeting.races.length &&
        dbRunnerCount >= expectedRunnerCount &&
        dbMeeting.races.every((race) => race.sourceProvider != null),
    };
  });

  const missingOrStale = expectedRows.filter((row) => !row.ok);
  const dbOnly = dbMeetings
    .filter((meeting) => {
      const key = meetingKey(
        meeting.track.name,
        meeting.track.state,
        dateKey(meeting.meetingDate)
      );
      return !expectedRows.some((row) => row.key === key);
    })
    .map((meeting) => ({
      trackName: meeting.track.name,
      state: meeting.track.state,
      date: dateKey(meeting.meetingDate),
      sourceProvider: meeting.sourceProvider,
      races: meeting.races.length,
    }));

  const summary = {
    days,
    expectedMeetings: expectedRows.length,
    expectedTracks: new Set(
      expectedRows.map((row) => `${row.trackName}:${row.state}`)
    ).size,
    dbLiveMeetings: dbMeetings.length,
    dbLiveTracks: new Set(
      dbMeetings.map((meeting) => `${meeting.track.name}:${meeting.track.state}`)
    ).size,
    missingOrStale: missingOrStale.length,
    dbOnly: dbOnly.length,
  };

  console.log(JSON.stringify({ summary, missingOrStale, dbOnly }, null, 2));
  if (missingOrStale.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
