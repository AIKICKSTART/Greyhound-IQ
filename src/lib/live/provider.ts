// Live data abstraction. Any external feed (Topaz/GRV, TAB, etc.) maps its
// payload into these normalized DTOs; the sync layer (./sync) is provider-agnostic.

export interface LiveDog {
  name: string;
  earBrand?: string;
  sex?: string;
  colour?: string;
}

export interface LiveRunner {
  boxNumber: number;
  dog: LiveDog;
  trainerName?: string;
  weight?: number;
  startingPrice?: number;
  scratched?: boolean;
  // Present only for completed races:
  finishingPosition?: number;
  runningTime?: number;
  margin?: number;
}

export interface LiveRace {
  raceNumber: number;
  raceTime: string; // ISO
  distance: number;
  grade?: string;
  prizeMoney?: number;
  runners: LiveRunner[];
}

export interface LiveMeeting {
  trackName: string;
  state?: string;
  meetingDate: string; // ISO (date)
  meetingType?: string;
  races: LiveRace[];
}

export interface LiveDataProvider {
  readonly name: string;
  fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]>;
  fetchResults(days: number): Promise<LiveMeeting[]>;
}

import { TopazProvider } from "./topaz";

// Returns the configured live provider, or null when no feed is wired yet.
// Adding TOPAZ_API_KEY to the environment turns live sync on.
export function getLiveProvider(): LiveDataProvider | null {
  if (process.env.TOPAZ_API_KEY) {
    return new TopazProvider(process.env.TOPAZ_API_KEY);
  }
  return null;
}
