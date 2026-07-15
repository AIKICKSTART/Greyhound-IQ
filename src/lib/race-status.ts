export const RACE_LIVE_WINDOW_MS = 20 * 60 * 1000;

export type RaceSourceStatus =
  | "abandoned"
  | "postponed"
  | "completed"
  | null;

export type RacePresentationStatusKey =
  | "abandoned"
  | "postponed"
  | "live"
  | "upcoming"
  | "replay"
  | "completed"
  | "awaiting-result";

export type RacePresentationStatus = {
  key: RacePresentationStatusKey;
  label: string;
  terminal: boolean;
};

type RacePresentationInput = {
  resultStatus: string | null | undefined;
  raceTime: Date;
  now: Date;
  hasResults: boolean;
  hasReplay: boolean;
};

const ABANDONED_SOURCE_STATUSES = new Set([
  "abandon",
  "abandoned",
  "meeting abandon",
  "meeting abandoned",
  "race abandon",
  "race abandoned",
]);

const POSTPONED_SOURCE_STATUSES = new Set([
  "meeting postpone",
  "meeting postponed",
  "postpone",
  "postponed",
  "race postpone",
  "race postponed",
]);

const COMPLETED_SOURCE_STATUSES = new Set([
  "complete",
  "completed",
  "final",
  "finalised",
  "finalized",
  "posted",
  "result posted",
  "resulted",
  "results posted",
]);

export function normaliseRaceSourceStatus(
  value: string | null | undefined,
): RaceSourceStatus {
  const canonical = value
    ?.trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!canonical) return null;
  if (ABANDONED_SOURCE_STATUSES.has(canonical)) return "abandoned";
  if (POSTPONED_SOURCE_STATUSES.has(canonical)) return "postponed";
  if (COMPLETED_SOURCE_STATUSES.has(canonical)) return "completed";
  return null;
}

export function getRacePresentationStatus({
  resultStatus,
  raceTime,
  now,
  hasResults,
  hasReplay,
}: RacePresentationInput): RacePresentationStatus {
  const sourceStatus = normaliseRaceSourceStatus(resultStatus);

  if (sourceStatus === "abandoned") {
    return { key: "abandoned", label: "Abandoned", terminal: true };
  }
  if (sourceStatus === "postponed") {
    return { key: "postponed", label: "Postponed", terminal: true };
  }

  if (
    sourceStatus !== "completed" &&
    raceTime <= now &&
    now.getTime() - raceTime.getTime() < RACE_LIVE_WINDOW_MS
  ) {
    return { key: "live", label: "Live", terminal: false };
  }
  if (sourceStatus !== "completed" && raceTime > now) {
    return { key: "upcoming", label: "Upcoming", terminal: false };
  }
  if (hasReplay) {
    return { key: "replay", label: "Replay", terminal: true };
  }
  if (sourceStatus === "completed" || hasResults) {
    return { key: "completed", label: "Completed", terminal: true };
  }
  return {
    key: "awaiting-result",
    label: "Awaiting result",
    terminal: false,
  };
}

export function isRaceEligibleForNextToGo(
  race: Pick<RacePresentationInput, "resultStatus" | "raceTime" | "now">,
) {
  const sourceStatus = normaliseRaceSourceStatus(race.resultStatus);
  if (sourceStatus === "abandoned" || sourceStatus === "postponed") return false;
  if (sourceStatus === "completed") return false;
  return (
    race.raceTime > race.now ||
    (race.raceTime <= race.now &&
      race.now.getTime() - race.raceTime.getTime() < RACE_LIVE_WINDOW_MS)
  );
}

export function raceSchemaEventStatus(
  resultStatus: string | null | undefined,
) {
  const sourceStatus = normaliseRaceSourceStatus(resultStatus);
  if (sourceStatus === "abandoned") {
    return "https://schema.org/EventCancelled" as const;
  }
  if (sourceStatus === "postponed") {
    return "https://schema.org/EventPostponed" as const;
  }
  return "https://schema.org/EventScheduled" as const;
}
