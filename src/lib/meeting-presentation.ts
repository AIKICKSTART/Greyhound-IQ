import { getRacePresentationStatus } from "./race-status";

type MeetingRaceInput = Readonly<{
  resultStatus: string | null;
  raceTime: Date;
  replayUrl: string | null;
  _count: Readonly<{ runners: number }>;
  videos: readonly Readonly<{ streamUrl: string | null }>[];
  runners: readonly Readonly<{
    boxNumber: number;
    dog: Readonly<{ id: string; name: string }>;
    result: Readonly<{
      finishingPosition: number | null;
      runningTime: number | null;
      margin: number | null;
    }> | null;
  }>[];
}>;

export type MeetingRacePresentation = Readonly<{
  runnerCount: number;
  resultCount: number;
  hasReplay: boolean;
  status: ReturnType<typeof getRacePresentationStatus>;
  winner: MeetingRaceInput["runners"][number] | null;
}>;

export function buildMeetingRacePresentation(
  race: MeetingRaceInput,
  now: Date,
): MeetingRacePresentation {
  const settledRunners = race.runners.filter(({ result }) => result !== null);
  const hasReplay =
    race.replayUrl !== null || race.videos.some(({ streamUrl }) => streamUrl !== null);

  return {
    runnerCount: race._count.runners,
    resultCount: settledRunners.length,
    hasReplay,
    status: getRacePresentationStatus({
      resultStatus: race.resultStatus,
      raceTime: race.raceTime,
      now,
      hasResults: settledRunners.length > 0,
      hasReplay,
    }),
    winner:
      settledRunners.find(
        ({ result }) => result?.finishingPosition === 1,
      ) ?? null,
  };
}

export function buildMeetingSummary(
  races: readonly MeetingRacePresentation[],
) {
  return {
    races: races.length,
    runners: races.reduce((total, race) => total + race.runnerCount, 0),
    racesWithResults: races.filter(({ resultCount }) => resultCount > 0).length,
    replays: races.filter(({ hasReplay }) => hasReplay).length,
  };
}
