import type { LiveDataProvider, LiveMeeting, LiveRace, LiveRunner } from "./provider";

/**
 * Topaz is GRV's official meeting and race data API.
 * Public OpenAPI reference: https://topaz.grv.org.au/docs/
 */
const TOPAZ_BASE = process.env.TOPAZ_API_BASE ?? "https://topaz.grv.org.au/api";
const TOPAZ_AUTHORITY = process.env.TOPAZ_OWNING_AUTHORITY_CODE ?? "VIC";
const TOPAZ_TIME_ZONE = process.env.TOPAZ_TIME_ZONE ?? "Australia/Sydney";
const MAX_RETRIES = 5;

type FetchLike = typeof fetch;

interface TopazMeeting {
  meetingId: number;
  trackName: string;
  meetingDate: string;
  meetingType?: string | null;
  meetingCategory?: string | null;
  owningAuthorityCode?: string | null;
  races?: TopazRace[];
}

interface TopazRace {
  raceId?: number;
  raceNumber: number;
  name?: string | null;
  raceStart?: string | null;
  raceTimeDateUTC?: string | null;
  raceTime?: string | null;
  distance: number;
  raceType?: string | null;
  raceTypeName?: string | null;
  raceTypeCode?: string | null;
  prizeMoneyTotal?: number | null;
  prizeMoney1?: number | null;
  prizeMoney2?: number | null;
  prizeMoney3?: number | null;
  prizeMoney4?: number | null;
  prizeMoney5?: number | null;
  prizeMoney6?: number | null;
  prizeMoney7?: number | null;
  prizeMoney8?: number | null;
  runs?: TopazRun[];
}

interface TopazRun {
  dogName?: string | null;
  name?: string | null;
  boxNumber?: number | null;
  rugNumber?: number | null;
  trainer?: string | null;
  trainerName?: string | null;
  weightInKg?: number | null;
  weight?: number | null;
  startingPrice?: number | null;
  startPrice?: number | null;
  scratched?: boolean | null;
  scratchIsScratched?: boolean | null;
  isLateScratching?: boolean | null;
  sex?: string | null;
  colourCode?: string | null;
  place?: number | null;
  resultTime?: number | null;
  resultMargin?: number | null;
}

interface TopazRecentResult {
  raceId: number;
  trackName: string;
  raceName?: string | null;
  raceTypeName?: string | null;
  raceTypeCode?: string | null;
  raceNumber: number;
  distance: number;
  raceStart: string;
  prizeMoney1st?: number | null;
  prizeMoney2nd?: number | null;
  prizeMoney3rd?: number | null;
  prizeMoney4th?: number | null;
  prizeMoney5th?: number | null;
  prizeMoney6th?: number | null;
  prizeMoney7th?: number | null;
  prizeMoney8th?: number | null;
  runs: TopazRun[];
}

export class TopazProvider implements LiveDataProvider {
  readonly name = "topaz";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]> {
    const from = formatDate(new Date());
    const to = formatDate(addDays(new Date(), days));
    const meetings = await this.get<TopazMeeting[]>("/meeting", {
      from,
      to,
      owningauthoritycode: TOPAZ_AUTHORITY,
    });

    return Promise.all(
      ensureArray(meetings).map(async (meeting) => {
        const detail = await this.get<TopazMeeting>(
          `/meeting/${meeting.meetingId}`,
          { format: "full" }
        );
        return mapMeeting(detail);
      })
    );
  }

  async fetchResults(days: number): Promise<LiveMeeting[]> {
    const since = addDays(new Date(), -Math.max(days, 1));
    const recent = await this.get<TopazRecentResult[]>("/raceresult/recent", {});
    return groupRecentResults(
      ensureArray(recent).filter((race) => new Date(race.raceStart) >= since)
    );
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
    attempt = 0
  ): Promise<T> {
    const url = new URL(path, TOPAZ_BASE);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url, {
      headers: { "X-API-Key": this.apiKey },
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(response, attempt));
      return this.get<T>(path, params, attempt + 1);
    }
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(response, attempt));
      return this.get<T>(path, params, attempt + 1);
    }
    if (!response.ok) {
      throw new Error(`[topaz] ${response.status} ${response.statusText} for ${path}`);
    }

    return response.json() as Promise<T>;
  }
}

export function mapMeeting(meeting: TopazMeeting): LiveMeeting {
  return {
    sourceId: String(meeting.meetingId),
    trackName: meeting.trackName,
    state: meeting.owningAuthorityCode ?? TOPAZ_AUTHORITY,
    meetingDate: startOfDayIso(meeting.meetingDate),
    meetingType: meeting.meetingType ?? meeting.meetingCategory ?? undefined,
    races: ensureArray(meeting.races).map(mapRace),
  };
}

export function mapRace(race: TopazRace): LiveRace {
  return {
    sourceId: race.raceId != null ? String(race.raceId) : undefined,
    raceNumber: Math.trunc(numberOr(race.raceNumber, 0)),
    raceTime: isoDate(
      race.raceStart ?? race.raceTimeDateUTC ?? race.raceTime ?? new Date()
    ),
    distance: Math.trunc(numberOr(race.distance, 0)),
    grade: race.raceType ?? race.raceTypeName ?? race.raceTypeCode ?? undefined,
    prizeMoney: totalPrizeMoney(race),
    runners: ensureArray(race.runs).map(mapRun),
  };
}

export function mapRun(run: TopazRun): LiveRunner {
  return {
    boxNumber: Math.trunc(numberOr(run.boxNumber ?? run.rugNumber, 0)),
    dog: {
      name: run.dogName ?? run.name ?? "Unknown runner",
      sex: run.sex ?? undefined,
      colour: run.colourCode ?? undefined,
    },
    trainerName: run.trainerName ?? run.trainer ?? undefined,
    weight: numberOrNull(run.weightInKg ?? run.weight) ?? undefined,
    startingPrice:
      numberOrNull(run.startingPrice ?? run.startPrice) ?? undefined,
    scratched:
      run.scratched ?? run.scratchIsScratched ?? run.isLateScratching ?? false,
    finishingPosition: numberOrNull(run.place) ?? undefined,
    runningTime: numberOrNull(run.resultTime) ?? undefined,
    margin: numberOrNull(run.resultMargin) ?? undefined,
  };
}

function groupRecentResults(races: TopazRecentResult[]): LiveMeeting[] {
  const meetings = new Map<string, LiveMeeting>();
  for (const race of races) {
    const key = `${race.trackName}:${startOfDayIso(race.raceStart)}`;
    const meeting =
      meetings.get(key) ??
      ({
        trackName: race.trackName,
        state: TOPAZ_AUTHORITY,
        meetingDate: startOfDayIso(race.raceStart),
        meetingType: "Result",
        races: [],
      } satisfies LiveMeeting);

    meeting.races.push(
      mapRace({
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        name: race.raceName,
        raceStart: race.raceStart,
        distance: race.distance,
        raceType: race.raceTypeName ?? race.raceTypeCode,
        prizeMoney1: race.prizeMoney1st,
        prizeMoney2: race.prizeMoney2nd,
        prizeMoney3: race.prizeMoney3rd,
        prizeMoney4: race.prizeMoney4th,
        prizeMoney5: race.prizeMoney5th,
        prizeMoney6: race.prizeMoney6th,
        prizeMoney7: race.prizeMoney7th,
        prizeMoney8: race.prizeMoney8th,
        runs: race.runs,
      })
    );
    meetings.set(key, meeting);
  }

  return [...meetings.values()].map((meeting) => ({
    ...meeting,
    races: meeting.races.sort((a, b) => a.raceNumber - b.raceNumber),
  }));
}

function totalPrizeMoney(race: TopazRace) {
  const explicit = numberOrNull(race.prizeMoneyTotal);
  if (explicit != null) return explicit;

  const parts = [
    race.prizeMoney1,
    race.prizeMoney2,
    race.prizeMoney3,
    race.prizeMoney4,
    race.prizeMoney5,
    race.prizeMoney6,
    race.prizeMoney7,
    race.prizeMoney8,
  ]
    .map(numberOrNull)
    .filter((value): value is number => value != null);

  return parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) : undefined;
}

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function numberOr(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: string | Date) {
  return new Date(value).toISOString();
}

function startOfDayIso(value: string | Date) {
  return `${formatDate(new Date(value))}T00:00:00.000Z`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOPAZ_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 60_000);
  }
  return Math.min(1000 * 2 ** attempt, 60_000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
