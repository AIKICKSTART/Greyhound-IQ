import { getRacePresentationStatus } from "@/lib/race-status";

export type FeedRaceDaySourceMeeting = {
  id: string;
  track: {
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

export type FeedRaceDayRace = {
  id: string;
  track: string;
  state: string;
  raceNumber: number;
  raceTime: Date;
  distance: number;
  statusLabel: string;
};

export type FeedRaceDayData = {
  meetingCount: number;
  raceCount: number;
  stateLabel: string;
  nextRaces: FeedRaceDayRace[];
};

export function buildFeedRaceDayData(
  meetings: readonly FeedRaceDaySourceMeeting[],
  now: Date,
): FeedRaceDayData {
  const states = [...new Set(meetings.map(({ track }) => track.state).filter(Boolean))];
  const races = meetings.flatMap((meeting) =>
    meeting.races.map((race) => ({
      ...race,
      track: meeting.track.name,
      state: meeting.track.state,
    })),
  );
  const nextRaces = races
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
    .sort((a, b) => a.raceTime.getTime() - b.raceTime.getTime())
    .slice(0, 3)
    .map(({ id, track, state, raceNumber, raceTime, distance, status }) => ({
      id,
      track,
      state,
      raceNumber,
      raceTime,
      distance,
      statusLabel:
        status.key === "live" ? status.label : formatRaceCountdown(raceTime, now),
    }));

  return {
    meetingCount: meetings.length,
    raceCount: races.length,
    stateLabel: states.length > 0 ? states.join(", ") : "No meetings available",
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
