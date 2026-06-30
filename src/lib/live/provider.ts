// Live data abstraction. Any external feed (Topaz/GRV, TAB, etc.) maps its
// payload into these normalized DTOs; the sync layer (./sync) is provider-agnostic.

import { FastTrackPrototypeProvider } from "./fasttrack";
import { TopazProvider } from "./topaz";

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

export function getLiveProviderConfig() {
  const topazConfigured = Boolean(process.env.TOPAZ_API_KEY?.trim());
  const fastTrackPrototypeEnabled = isFastTrackPrototypeEnabled(topazConfigured);
  const activeProvider = topazConfigured
    ? "topaz"
    : fastTrackPrototypeEnabled
      ? "fasttrack-prototype"
      : null;

  return {
    activeProvider,
    feeds: [
      {
        name: "topaz",
        role: "live_race_fields_and_results",
        implemented: true,
        configured: topazConfigured,
        blocking: !fastTrackPrototypeEnabled,
        requiredEnv: ["TOPAZ_API_KEY"],
        optionalEnv: [
          "TOPAZ_API_BASE",
          "TOPAZ_OWNING_AUTHORITY_CODE",
          "TOPAZ_TIME_ZONE",
        ],
        missingEnv: topazConfigured ? [] : ["TOPAZ_API_KEY"],
      },
      {
        name: "fasttrack-prototype",
        role: "prototype_public_race_fields_and_results",
        implemented: true,
        configured: fastTrackPrototypeEnabled,
        blocking: false,
        requiredEnv: [],
        optionalEnv: [
          "FASTTRACK_PROTOTYPE_ENABLED",
          "FASTTRACK_BASE_URL",
          "FASTTRACK_MAX_MEETINGS",
        ],
        missingEnv: [],
      },
    ],
  };
}

// Returns the configured live provider. TOPAZ_API_KEY wins; the FastTrack reader
// is a bounded prototype fallback while the licensed key is not available.
export function getLiveProvider(): LiveDataProvider | null {
  const topazKey = process.env.TOPAZ_API_KEY?.trim();
  if (topazKey) {
    return new TopazProvider(topazKey);
  }
  if (isFastTrackPrototypeEnabled(false)) return new FastTrackPrototypeProvider();
  return null;
}

function isFastTrackPrototypeEnabled(topazConfigured: boolean) {
  const raw = process.env.FASTTRACK_PROTOTYPE_ENABLED?.trim().toLowerCase();
  if (!raw) return !topazConfigured;
  return !["0", "false", "off", "no"].includes(raw);
}
