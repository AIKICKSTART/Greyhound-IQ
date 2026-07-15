export const RACING_RESULT_FRESHNESS_WARNING_MS = 24 * 60 * 60 * 1000;

export type RacingDisclosureState = "current" | "stale" | "unavailable";

export type RacingDataDisclosure = {
  providers: string[];
  providerLabel: string;
  latestResultAt: string | null;
  latestResultLabel: string;
  checkedAt: string;
  checkedAtLabel: string;
  state: RacingDisclosureState;
  stateLabel: string;
};

type RacingFeedStatusInput = {
  timestamp: string;
  data: {
    database: string;
    liveProviders: { name: string | null }[];
    latestResultAt: string | null;
  };
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Australia/Sydney",
});

export function buildRacingDataDisclosure(
  status: RacingFeedStatusInput,
  now = new Date(status.timestamp),
): RacingDataDisclosure {
  const providers = [...new Set(
    status.data.liveProviders
      .map(({ name }) => normaliseProviderName(name))
      .filter((name): name is string => name !== null),
  )].sort((left, right) => left.localeCompare(right));
  const latestResultAt = parseIsoDate(status.data.latestResultAt);
  const checkedAt = parseIsoDate(status.timestamp) ?? now;
  const freshnessAge = latestResultAt
    ? Math.max(0, now.getTime() - latestResultAt.getTime())
    : null;
  const state: RacingDisclosureState =
    status.data.database !== "ok" || !latestResultAt
      ? "unavailable"
      : freshnessAge !== null && freshnessAge > RACING_RESULT_FRESHNESS_WARNING_MS
        ? "stale"
        : "current";

  return {
    providers,
    providerLabel:
      providers.length > 0
        ? providers.join(", ")
        : "No loaded provider attribution",
    latestResultAt: latestResultAt?.toISOString() ?? null,
    latestResultLabel: latestResultAt
      ? dateTimeFormatter.format(latestResultAt)
      : "Not available",
    checkedAt: checkedAt.toISOString(),
    checkedAtLabel: dateTimeFormatter.format(checkedAt),
    state,
    stateLabel:
      state === "current"
        ? "Latest synced result is within 24 hours"
        : state === "stale"
          ? "Delayed: latest synced result is over 24 hours old"
          : "Freshness unavailable: verify data before relying on it",
  };
}

function normaliseProviderName(value: string | null) {
  const provider = value?.trim().toLowerCase();
  if (!provider) return null;
  if (provider === "thedogs") return "The Dogs";
  if (provider === "watchdog") return "Watchdog";
  if (provider === "topaz") return "Topaz";
  if (provider === "fasttrack-prototype") return "FastTrack prototype";
  if (provider === "greyhoundiq-demo") return "GreyhoundIQ demo fixture";
  return provider
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function parseIsoDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
