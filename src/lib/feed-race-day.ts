import { getRacePresentationStatus } from "@/lib/race-status";

export type FeedRaceDaySourceMeeting = {
  id: string;
  track: {
    id: string;
    name: string;
    state: string;
  };
  races: readonly {
    id: string;
    raceNumber: number;
    raceTime: Date;
    distance: number;
    resultStatus: string | null;
    videos: readonly { streamUrl: string | null }[];
  }[];
};

export type FeedRaceDayClaimedRunner = {
  raceId: string;
  dogId: string;
  dogName: string;
  trainerId: string | null;
  trainerName: string | null;
  claimSources: Array<"dog" | "trainer">;
};

export type FeedRaceDayClaimedDog = {
  id: string;
  name: string;
  trainerId: string | null;
  trainerName: string | null;
  claimSources: Array<"dog" | "trainer">;
};

export type FeedRaceDayRace = {
  id: string;
  track: string;
  state: string;
  raceNumber: number;
  raceTime: Date;
  distance: number;
  statusLabel: string;
  claimedDogs: FeedRaceDayClaimedDog[];
};

export type FeedRaceDayData = {
  meetingCount: number;
  raceCount: number;
  stateLabel: string;
  claimedDogCount: number;
  claimedTrainerCount: number;
  myRaces: FeedRaceDayRace[];
  nextRaces: FeedRaceDayRace[];
};

export type RacingDayTrackOption = {
  id: string;
  name: string;
  state: string;
};

// Distinct tracks running today, for the "My racing day" configurator.
export function listRacingDayTrackOptions(
  meetings: readonly FeedRaceDaySourceMeeting[],
): RacingDayTrackOption[] {
  const seen = new Map<string, RacingDayTrackOption>();
  for (const { track } of meetings) {
    if (!seen.has(track.id)) {
      seen.set(track.id, { id: track.id, name: track.name, state: track.state });
    }
  }
  return [...seen.values()].sort(
    (a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name),
  );
}

// Filters today's meetings to the user's saved tracks. Empty/absent selection
// keeps every meeting, so a user with no preference sees the full racing day.
export function selectRacingDayMeetings(
  meetings: readonly FeedRaceDaySourceMeeting[],
  selectedTrackIds?: readonly string[] | null,
  claimedRaceIds: readonly string[] = [],
): readonly FeedRaceDaySourceMeeting[] {
  if (!selectedTrackIds || selectedTrackIds.length === 0) return meetings;
  const selected = new Set(selectedTrackIds);
  const claimed = new Set(claimedRaceIds);
  const filtered = meetings.filter(
    ({ track, races }) =>
      selected.has(track.id) || races.some(({ id }) => claimed.has(id)),
  );
  // A stale selection (all chosen tracks idle today) falls back to all meetings.
  return filtered.length > 0 ? filtered : meetings;
}

export function buildFeedRaceDayData(
  meetings: readonly FeedRaceDaySourceMeeting[],
  now: Date,
  claimedRunners: readonly FeedRaceDayClaimedRunner[] = [],
): FeedRaceDayData {
  const claimedByRace = new Map<string, FeedRaceDayClaimedDog[]>();
  const claimedDogIds = new Set<string>();
  const claimedTrainerIds = new Set<string>();
  for (const runner of claimedRunners) {
    claimedDogIds.add(runner.dogId);
    if (
      runner.trainerId &&
      runner.claimSources.includes("trainer")
    ) {
      claimedTrainerIds.add(runner.trainerId);
    }
    const dogs = claimedByRace.get(runner.raceId) ?? [];
    const existingDog = dogs.find(({ id }) => id === runner.dogId);
    if (existingDog) {
      existingDog.claimSources = [
        ...new Set([...existingDog.claimSources, ...runner.claimSources]),
      ];
    } else {
      dogs.push({
        id: runner.dogId,
        name: runner.dogName,
        trainerId: runner.trainerId,
        trainerName: runner.trainerName,
        claimSources: runner.claimSources,
      });
      claimedByRace.set(runner.raceId, dogs);
    }
  }

  const states = [...new Set(meetings.map(({ track }) => track.state).filter(Boolean))];
  const races = meetings.flatMap((meeting) =>
    meeting.races.map((race) => ({
      ...race,
      track: meeting.track.name,
      state: meeting.track.state,
      claimedDogs: claimedByRace.get(race.id) ?? [],
    })),
  );
  const availableRaces = races
    .map((race) => ({
      ...race,
      status: getRacePresentationStatus({
        resultStatus: race.resultStatus,
        raceTime: race.raceTime,
        now,
        hasResults: false,
        hasReplay: race.videos.some(({ streamUrl }) => Boolean(streamUrl)),
      }),
    }))
    .filter(({ status }) => status.key === "live" || status.key === "upcoming")
    .sort((a, b) => a.raceTime.getTime() - b.raceTime.getTime());
  const present = (
    candidates: typeof availableRaces,
    limit: number,
  ): FeedRaceDayRace[] =>
    candidates
      .slice(0, limit)
      .map(
        ({
          id,
          track,
          state,
          raceNumber,
          raceTime,
          distance,
          status,
          claimedDogs,
        }) => ({
          id,
          track,
          state,
          raceNumber,
          raceTime,
          distance,
          statusLabel:
            status.key === "live"
              ? status.label
              : formatRaceCountdown(raceTime, now),
          claimedDogs,
        }),
      );
  const myRaces = present(
    availableRaces.filter(({ claimedDogs }) => claimedDogs.length > 0),
    6,
  );
  const nextRaces = present(availableRaces, 3);

  return {
    meetingCount: meetings.length,
    raceCount: races.length,
    stateLabel: states.length > 0 ? states.join(", ") : "No meetings available",
    claimedDogCount: claimedDogIds.size,
    claimedTrainerCount: claimedTrainerIds.size,
    myRaces,
    nextRaces,
  };
}

function formatRaceCountdown(raceTime: Date, now: Date) {
  const minutes = Math.max(1, Math.ceil((raceTime.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} hr ${remainder} min` : `${hours} hr`;
}
