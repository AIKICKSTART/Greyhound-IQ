// Live data abstraction. Any external feed (Topaz/GRV, TAB, etc.) maps its
// payload into these normalized DTOs; the sync layer (./sync) is provider-agnostic.

import { logExecutionWarn } from "../logger";
import { FastTrackPrototypeProvider } from "./fasttrack";
import { isTheDogsLicensedUseApproved } from "./thedogs-access";
import { TheDogsProvider } from "./thedogs";
import { TopazProvider } from "./topaz";
import { WatchdogProvider } from "./watchdog";

export interface LiveDogParentEvidence {
  sourceProvider?: string;
  sourceId?: string;
  name?: string;
}

export interface LiveDog {
  sourceProvider?: string;
  sourceId?: string;
  profileUrl?: string;
  name: string;
  // Actual registry ear brand only. Provider IDs belong in sourceId.
  earBrand?: string;
  sex?: string;
  colour?: string;
  whelpDate?: string;
  sire?: LiveDogParentEvidence;
  dam?: LiveDogParentEvidence;
}

export interface LiveRunner {
  sourceProvider?: string;
  sourceId?: string;
  sourceRawJson?: string;
  boxNumber: number;
  dog: LiveDog;
  trainerName?: string;
  trainerSourceId?: string;
  trainerProfileUrl?: string;
  weight?: number;
  scratched?: boolean;
  // Present only for completed races:
  finishingPosition?: number;
  runningTime?: number;
  margin?: number;
  prizeMoneyWon?: number;
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
  raceTimeSource?: "provider" | "fallback";
  distance: number;
  grade?: string;
  prizeMoney?: number;
  resultStatus?: string;
  replayUrl?: string;
  photoFinishUrl?: string;
  videoSourceId?: string;
  videoSourceType?: string;
  runners: LiveRunner[];
}

export interface LiveMeeting {
  sourceProvider?: string;
  sourceId?: string;
  sourceRawJson?: string;
  trackSourceId?: string;
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
  const watchdogEnabled = isWatchdogProviderEnabled();
  const fastTrackPrototypeEnabled = isFastTrackPrototypeEnabled(
    topazConfigured || theDogsEnabled || watchdogEnabled
  );
  const activeProviders = [
    theDogsEnabled ? "thedogs" : null,
    topazConfigured ? "topaz" : null,
    watchdogEnabled ? "watchdog" : null,
    !theDogsEnabled && !topazConfigured && !watchdogEnabled && fastTrackPrototypeEnabled
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
        requiredEnv: ["THEDOGS_LICENSED_USE_APPROVED"],
        optionalEnv: [
          "THEDOGS_PROVIDER_ENABLED",
          "THEDOGS_BASE_URL",
          "THEDOGS_MAX_MEETINGS",
          "THEDOGS_CONCURRENCY",
          "THEDOGS_TIME_ZONE",
        ],
        missingEnv: isTheDogsLicensedUseApproved()
          ? []
          : ["THEDOGS_LICENSED_USE_APPROVED"],
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
        name: "watchdog",
        role: "victoria_public_racecards_results_tips_and_replay_ids",
        implemented: true,
        configured: watchdogEnabled,
        blocking: false,
        requiredEnv: [],
        optionalEnv: [
          "WATCHDOG_PROVIDER_ENABLED",
          "WATCHDOG_BASE_URL",
          "WATCHDOG_MAX_MEETINGS",
          "WATCHDOG_CONCURRENCY",
          "WATCHDOG_FETCH_TIMEOUT_MS",
        ],
        missingEnv: [],
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

// Returns the configured live provider. The Dogs supplies the national baseline,
// Topaz supplies licensed VIC data when configured, and Watchdog enriches VIC
// public racecards/results/replays. FastTrack is only a bounded prototype fallback.
export function getLiveProvider(): LiveDataProvider | null {
  const providers: LiveDataProvider[] = [];
  const topazKey = process.env.TOPAZ_API_KEY?.trim();
  if (isTheDogsProviderEnabled()) {
    providers.push(new TheDogsProvider());
  }
  if (topazKey) {
    providers.push(new TopazProvider(topazKey));
  }
  if (isWatchdogProviderEnabled()) {
    providers.push(new WatchdogProvider());
  }
  if (providers.length === 0 && isFastTrackPrototypeEnabled(false)) {
    providers.push(new FastTrackPrototypeProvider());
  }
  if (providers.length === 1) return providers[0];
  if (providers.length > 1) return new CompositeLiveProvider(providers);
  return null;
}

export class CompositeLiveProvider implements LiveDataProvider {
  readonly name: string;

  constructor(private readonly providers: LiveDataProvider[]) {
    this.name = providers.map((provider) => provider.name).join("+");
  }

  async fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]> {
    return this.fetch("fetchUpcomingMeetings", days);
  }

  async fetchResults(days: number): Promise<LiveMeeting[]> {
    return this.fetch("fetchResults", days);
  }

  private async fetch(
    operation: "fetchUpcomingMeetings" | "fetchResults",
    days: number
  ): Promise<LiveMeeting[]> {
    const results = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          return withSourceProvider(
            await provider[operation](days),
            provider.name
          );
        } catch (err) {
          await logExecutionWarn(
            "live.composite.provider_failed",
            { provider: provider.name, operation },
            err
          );
          return null;
        }
      })
    );

    if (results.some((meetings) => meetings == null)) {
      throw new Error("live.composite.provider_failed");
    }

    return results.flatMap((meetings) => meetings ?? []);
  }
}

function withSourceProvider(meetings: LiveMeeting[], sourceProvider: string) {
  return meetings.map((meeting) => ({
    ...meeting,
    sourceProvider,
    races: meeting.races.map((race) => {
      const raceProvider = race.sourceProvider ?? sourceProvider;
      return {
        ...race,
        sourceProvider: raceProvider,
        runners: race.runners.map((runner) => {
          const runnerProvider = runner.sourceProvider ?? raceProvider;
          return {
            ...runner,
            sourceProvider: runnerProvider,
            dog: {
              ...runner.dog,
              sourceProvider:
                runner.dog.sourceProvider ?? runnerProvider,
            },
          };
        }),
      };
    }),
  }));
}

function isTheDogsProviderEnabled() {
  if (!isTheDogsLicensedUseApproved()) return false;
  const raw = process.env.THEDOGS_PROVIDER_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !["0", "false", "off", "no"].includes(raw);
}

function isWatchdogProviderEnabled() {
  const raw = process.env.WATCHDOG_PROVIDER_ENABLED?.trim().toLowerCase();
  return ["1", "true", "on", "yes"].includes(raw ?? "");
}

function isFastTrackPrototypeEnabled(topazConfigured: boolean) {
  const raw = process.env.FASTTRACK_PROTOTYPE_ENABLED?.trim().toLowerCase();
  if (!raw) return !topazConfigured;
  return !["0", "false", "off", "no"].includes(raw);
}
