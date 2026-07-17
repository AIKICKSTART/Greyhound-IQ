export type MeetingRaceNavigationEntry = {
  id: string;
  raceNumber: number;
  raceTime: Date;
};

export type MeetingRaceNavigation<T extends MeetingRaceNavigationEntry> = {
  previous: T | null;
  next: T | null;
  position: number | null;
  total: number;
};

export type RaceListContext = {
  date: string | null;
  state: string | null;
  query: string | null;
  status: "all" | "upcoming" | "live" | "resulted" | "replay";
  sort: "time" | "relevance";
  meetingId: string | null;
};

type RaceListContextInput = Partial<
  Record<keyof RaceListContext, string | null | undefined>
>;

type RaceListContextSearchParams = Record<
  string,
  string | string[] | undefined
>;

const AUSTRALIAN_RACING_STATES = new Set([
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
]);
const RACE_LIST_STATUSES = new Set<RaceListContext["status"]>([
  "all",
  "upcoming",
  "live",
  "resulted",
  "replay",
]);
const RACE_LIST_SORTS = new Set<RaceListContext["sort"]>([
  "time",
  "relevance",
]);
const CONTEXT_KEYS = {
  date: "fromDate",
  state: "fromState",
  query: "fromQ",
  status: "fromStatus",
  sort: "fromSort",
  meetingId: "fromMeeting",
} as const;

/**
 * Resolve adjacent races inside one meeting without relying on database return
 * order. The id tie-breaker keeps malformed duplicate source rows stable.
 */
export function resolveMeetingRaceNavigation<
  T extends MeetingRaceNavigationEntry,
>(races: readonly T[], currentRaceId: string): MeetingRaceNavigation<T> {
  const ordered = [...races].sort(
    (left, right) =>
      left.raceNumber - right.raceNumber ||
      left.raceTime.getTime() - right.raceTime.getTime() ||
      left.id.localeCompare(right.id),
  );
  const currentIndex = ordered.findIndex(({ id }) => id === currentRaceId);

  if (currentIndex < 0) {
    return { previous: null, next: null, position: null, total: ordered.length };
  }

  return {
    previous: ordered[currentIndex - 1] ?? null,
    next: ordered[currentIndex + 1] ?? null,
    position: currentIndex + 1,
    total: ordered.length,
  };
}

export function normaliseRaceListContext(
  input: RaceListContextInput,
): RaceListContext {
  const state = input.state?.trim().toUpperCase() ?? "";
  const query = input.query?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
  const status = input.status?.trim().toLowerCase() ?? "";
  const sort = input.sort?.trim().toLowerCase() ?? "";
  const meetingId = input.meetingId?.trim() ?? "";

  return {
    date: normaliseDate(input.date),
    state: AUSTRALIAN_RACING_STATES.has(state) ? state : null,
    query: query || null,
    status: RACE_LIST_STATUSES.has(status as RaceListContext["status"])
      ? (status as RaceListContext["status"])
      : "all",
    sort: RACE_LIST_SORTS.has(sort as RaceListContext["sort"])
      ? (sort as RaceListContext["sort"])
      : "time",
    meetingId: /^[A-Za-z0-9_-]{1,128}$/.test(meetingId) ? meetingId : null,
  };
}

export function parseRaceListContext(
  searchParams: RaceListContextSearchParams,
): RaceListContext | null {
  const hasContext = Object.values(CONTEXT_KEYS).some(
    (key) => firstParam(searchParams[key]) !== null,
  );
  if (!hasContext) return null;

  return normaliseRaceListContext({
    date: firstParam(searchParams[CONTEXT_KEYS.date]),
    state: firstParam(searchParams[CONTEXT_KEYS.state]),
    query: firstParam(searchParams[CONTEXT_KEYS.query]),
    status: firstParam(searchParams[CONTEXT_KEYS.status]),
    sort: firstParam(searchParams[CONTEXT_KEYS.sort]),
    meetingId: firstParam(searchParams[CONTEXT_KEYS.meetingId]),
  });
}

export function buildRaceDetailHref(
  raceId: string,
  input: RaceListContextInput,
) {
  const context = normaliseRaceListContext(input);
  const params = contextParams(context);
  const query = params.toString();
  return `/races/${encodeURIComponent(raceId)}${query ? `?${query}` : ""}`;
}

export function buildRaceListReturnHref(input: RaceListContextInput) {
  const context = normaliseRaceListContext(input);
  const params = new URLSearchParams();
  if (context.date) params.set("date", context.date);
  if (context.state) params.set("state", context.state);
  if (context.query) params.set("q", context.query);
  if (context.status !== "all") params.set("status", context.status);
  if (context.sort !== "time") params.set("sort", context.sort);
  const query = params.toString();
  const anchor = context.meetingId
    ? `#meeting-${encodeURIComponent(context.meetingId)}`
    : "";
  return `/races${query ? `?${query}` : ""}${anchor}`;
}

function contextParams(context: RaceListContext) {
  const params = new URLSearchParams();
  if (context.date) params.set(CONTEXT_KEYS.date, context.date);
  if (context.state) params.set(CONTEXT_KEYS.state, context.state);
  if (context.query) params.set(CONTEXT_KEYS.query, context.query);
  if (context.status !== "all") {
    params.set(CONTEXT_KEYS.status, context.status);
  }
  if (context.sort !== "time") params.set(CONTEXT_KEYS.sort, context.sort);
  if (context.meetingId) {
    params.set(CONTEXT_KEYS.meetingId, context.meetingId);
  }
  return params;
}

function normaliseDate(value: string | null | undefined) {
  const candidate = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate
    ? null
    : candidate;
}

function firstParam(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate : null;
}
