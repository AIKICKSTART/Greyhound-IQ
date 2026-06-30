import { loadEnvConfig } from "@next/env";
import { prisma } from "../src/lib/db";
import { TheDogsProvider } from "../src/lib/live/thedogs";

loadEnvConfig(process.cwd());

async function main() {
  const days = daysArg();
  const provider = new TheDogsProvider();
  const expectedMeetings = await provider.fetchResults(days);
  const expectedRaces = expectedMeetings.flatMap((meeting) =>
    meeting.races.flatMap((race) => {
      const runners = race.runners
        .filter((runner) => runner.finishingPosition != null)
        .map((runner) => ({
          boxNumber: runner.boxNumber,
          finishingPosition: runner.finishingPosition!,
          runningTime: runner.runningTime,
          margin: runner.margin,
          splitTime: runner.splitTime,
          sectionals: runner.sectionals,
          sourceId: runner.sourceId,
        }));
      if (runners.length === 0) return [];
      const date = meeting.meetingDate.slice(0, 10);
      return [
        {
          key: raceKey(meeting.trackName, date, race.raceNumber),
          trackName: meeting.trackName,
          date,
          raceNumber: race.raceNumber,
          runners,
        },
      ];
    })
  );

  const dbMeetings = await prisma.meeting.findMany({
    where: {
      sourceProvider: { not: null },
      track: { name: { in: [...new Set(expectedRaces.map((race) => race.trackName))] } },
      meetingDate: {
        in: [...new Set(expectedRaces.map((race) => new Date(`${race.date}T00:00:00.000Z`)))],
      },
    },
    include: {
      track: true,
      races: {
        include: {
          runners: {
            include: { result: true },
          },
        },
      },
    },
  });

  const dbRaces = new Map(
    dbMeetings.flatMap((meeting) =>
      meeting.races.map((race) => [
        raceKey(meeting.track.name, meeting.meetingDate.toISOString().slice(0, 10), race.raceNumber),
        race,
      ])
    )
  );

  const gaps = expectedRaces.flatMap((expected) => {
    const dbRace = dbRaces.get(expected.key);
    if (!dbRace) return [{ key: expected.key, reason: "missing_race" }];

    const dbByBox = new Map(dbRace.runners.map((runner) => [runner.boxNumber, runner]));
    return expected.runners.flatMap((runner) => {
      const dbRunner = dbByBox.get(runner.boxNumber);
      if (!dbRunner?.result) {
        return [{ key: expected.key, boxNumber: runner.boxNumber, reason: "missing_result" }];
      }
      if (
        !dbRunner.result.sourceProvider ||
        !dbRunner.result.sourceId ||
        !dbRunner.result.lastSyncedAt
      ) {
        return [
          {
            key: expected.key,
            boxNumber: runner.boxNumber,
            reason: "missing_result_provenance",
          },
        ];
      }
      if (dbRunner.result.finishingPosition !== runner.finishingPosition) {
        return [
          {
            key: expected.key,
            boxNumber: runner.boxNumber,
            reason: "finish_mismatch",
            expected: runner.finishingPosition,
            actual: dbRunner.result.finishingPosition,
          },
        ];
      }
      if (
        runner.runningTime != null &&
        dbRunner.result.runningTime != null &&
        Math.abs(dbRunner.result.runningTime - runner.runningTime) > 0.001
      ) {
        return [
          {
            key: expected.key,
            boxNumber: runner.boxNumber,
            reason: "time_mismatch",
            expected: runner.runningTime,
            actual: dbRunner.result.runningTime,
          },
        ];
      }
      if (
        runner.splitTime != null &&
        (dbRunner.result.splitTime == null ||
          Math.abs(dbRunner.result.splitTime - runner.splitTime) > 0.001)
      ) {
        return [
          {
            key: expected.key,
            boxNumber: runner.boxNumber,
            reason: "split_time_mismatch",
            expected: runner.splitTime,
            actual: dbRunner.result.splitTime,
          },
        ];
      }
      if (runner.sectionals && dbRunner.result.sectionals !== runner.sectionals) {
        return [
          {
            key: expected.key,
            boxNumber: runner.boxNumber,
            reason: "sectionals_mismatch",
            expected: runner.sectionals,
            actual: dbRunner.result.sectionals,
          },
        ];
      }
      return [];
    });
  });

  const summary = {
    days,
    expectedCompletedRaces: expectedRaces.length,
    expectedResultRows: expectedRaces.reduce((sum, race) => sum + race.runners.length, 0),
    dbMatchedRaces: expectedRaces.length - new Set(gaps.map((gap) => gap.key)).size,
    gaps: gaps.length,
  };

  console.log(JSON.stringify({ summary, gaps: gaps.slice(0, 50) }, null, 2));
  if (gaps.length > 0) process.exitCode = 1;
}

function daysArg() {
  const raw = process.argv[2] ?? "1";
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new Error("Usage: npm run audit:live-result-coverage -- [days:1-7]");
  }
  return days;
}

function raceKey(trackName: string, date: string, raceNumber: number) {
  return `${trackName}:${date}:R${raceNumber}`;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
