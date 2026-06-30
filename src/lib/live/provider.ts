// Live data abstraction. Any external feed (Topaz/GRV, TAB, etc.) maps its
// payload into these normalized DTOs; the sync layer (./sync) is provider-agnostic.

import { FastTrackPrototypeProvider } from "./fasttrack";
import { TheDogsProvider } from "./thedogs";
import { TopazProvider } from "./topaz";

export interface LiveDog {
  name: string;
  earBrand?: string;
  sex?: string;
  colour?: string;
}

export interface LiveRunner {
  sourceProvider?: string;
  sourceId?: string;
  sourceRawJson?: string;
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
  splitTime?: number;
  sectionals?: string;
}

export interface LiveRace {
  sourceProvider?: string;
  sourceId?: string;
  sourceRawJson?: string;
  raceNumber: number;
  name?: string;
  raceTime: string; // ISO
  distance: number;
  grade?: string;
  prizeMoney?: number;
  resultStatus?: string;
  replayUrl?: string;
  photoFinishUrl?: string;
  runners: LiveRunner[];
}

export interface LiveMeeting {
  sourceProvider?: string;
  sourceId?: string;
  sourceRawJson?: string;
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
  const theDogsEnabled = isTheDogsProviderEnabled();
  const fastTrackPrototypeEnabled = isFastTrackPrototypeEnabled(
    topazConfigured || theDogsEnabled
  );
  const activeProviders = [
    theDogsEnabled ? "thedogs" : null,
    topazConfigured ? "topaz" : null,
    !theDogsEnabled && !topazConfigured && fastTrackPrototypeEnabled
      ? "fasttrack-prototype"
      : null,
  ].filter((provider): provider is string => provider != null);

  return {
    activeProvider: activeProviders.join("+") || null,
    feeds: [
      {
        name: "thedogs",
        role: "all_australia_public_racecards_and_results",
        implemented: true,
        configured: theDogsEnabled,
        blocking: false,
        requiredEnv: [],
        optionalEnv: [
          "THEDOGS_PROVIDER_ENABLED",
          "THEDOGS_BASE_URL",
          "THEDOGS_MAX_MEETINGS",
          "THEDOGS_CONCURRENCY",
          "THEDOGS_TIME_ZONE",
        ],
        missingEnv: [],
      },
      {
        name: "topaz",
        role: "live_race_fields_and_results",
        implemented: true,
        configured: topazConfigured,
        blocking: !theDogsEnabled && !fastTrackPrototypeEnabled,
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
  const providers: LiveDataProvider[] = [];
  const topazKey = process.env.TOPAZ_API_KEY?.trim();
  if (isTheDogsProviderEnabled()) {
    providers.push(new TheDogsProvider());
  }
  if (topazKey) {
    providers.push(new TopazProvider(topazKey));
  }
  if (providers.length === 0 && isFastTrackPrototypeEnabled(false)) {
    providers.push(new FastTrackPrototypeProvider());
  }
  if (providers.length === 1) return providers[0];
  if (providers.length > 1) return new CompositeLiveProvider(providers);
  return null;
}

class CompositeLiveProvider implements LiveDataProvider {
  readonly name: string;

  constructor(private readonly providers: LiveDataProvider[]) {
    this.name = providers.map((provider) => provider.name).join("+");
  }

  async fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]> {
    return (await Promise.all(
      this.providers.map(async (provider) =>
        withSourceProvider(await provider.fetchUpcomingMeetings(days), provider.name)
      )
    )).flat();
  }

  async fetchResults(days: number): Promise<LiveMeeting[]> {
    return (await Promise.all(
      this.providers.map(async (provider) =>
        withSourceProvider(await provider.fetchResults(days), provider.name)
      )
    )).flat();
  }
}

function withSourceProvider(meetings: LiveMeeting[], sourceProvider: string) {
  return meetings.map((meeting) => ({
    ...meeting,
    sourceProvider,
    races: meeting.races.map((race) => ({
      ...race,
      sourceProvider,
    })),
  }));
}

function isTheDogsProviderEnabled() {
  const raw = process.env.THEDOGS_PROVIDER_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !["0", "false", "off", "no"].includes(raw);
}

function isFastTrackPrototypeEnabled(topazConfigured: boolean) {
  const raw = process.env.FASTTRACK_PROTOTYPE_ENABLED?.trim().toLowerCase();
  if (!raw) return !topazConfigured;
  return !["0", "false", "off", "no"].includes(raw);
}
