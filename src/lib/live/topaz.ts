import { z } from "zod";

import { readBoundedTextResponse } from "../remote-response";
import type { LiveDataProvider, LiveMeeting, LiveRace, LiveRunner } from "./provider";

/**
 * Topaz is GRV's official meeting and race data API.
 * Public OpenAPI reference: https://topaz.grv.org.au/docs/
 */
const TOPAZ_BASE = process.env.TOPAZ_API_BASE ?? "https://topaz.grv.org.au/api";
const TOPAZ_AUTHORITY = process.env.TOPAZ_OWNING_AUTHORITY_CODE ?? "VIC";
const TOPAZ_TIME_ZONE = process.env.TOPAZ_TIME_ZONE ?? "Australia/Sydney";
const MAX_RETRIES = 5;
const TOPAZ_RESPONSE_MAX_BYTES = 5 * 1024 * 1024;
const TOPAZ_REQUEST_TIMEOUT_MS = 15_000;
const TOPAZ_JSON_POLICY = {
  maxBytes: TOPAZ_RESPONSE_MAX_BYTES,
  allowedContentTypes: ["application/json", "+json"],
} as const;

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

const identifierSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const shortTextSchema = z.string().trim().min(1).max(200);
const optionalShortTextSchema = shortTextSchema.nullish();
const timestampSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .refine((value) => Number.isFinite(Date.parse(value)), "invalid timestamp");
const optionalTimestampSchema = timestampSchema.nullish();
const moneySchema = z.number().finite().min(0).max(100_000_000).nullish();

const topazRunSchema: z.ZodType<TopazRun> = z.object({
  dogName: optionalShortTextSchema,
  name: optionalShortTextSchema,
  boxNumber: z.number().int().min(0).max(20).nullish(),
  rugNumber: z.number().int().min(0).max(20).nullish(),
  trainer: optionalShortTextSchema,
  trainerName: optionalShortTextSchema,
  weightInKg: z.number().finite().min(0).max(100).nullish(),
  weight: z.number().finite().min(0).max(100).nullish(),
  scratched: z.boolean().nullish(),
  scratchIsScratched: z.boolean().nullish(),
  isLateScratching: z.boolean().nullish(),
  sex: z.string().trim().min(1).max(32).nullish(),
  colourCode: z.string().trim().min(1).max(32).nullish(),
  place: z.number().int().min(0).max(32).nullish(),
  resultTime: z.number().finite().min(0).max(1_000).nullish(),
  resultMargin: z.number().finite().min(0).max(1_000).nullish(),
});

const topazRaceSchema: z.ZodType<TopazRace> = z
  .object({
    raceId: identifierSchema.optional(),
    raceNumber: z.number().int().min(1).max(64),
    name: optionalShortTextSchema,
    raceStart: optionalTimestampSchema,
    raceTimeDateUTC: optionalTimestampSchema,
    raceTime: optionalTimestampSchema,
    distance: z.number().int().min(1).max(5_000),
    raceType: optionalShortTextSchema,
    raceTypeName: optionalShortTextSchema,
    raceTypeCode: optionalShortTextSchema,
    prizeMoneyTotal: moneySchema,
    prizeMoney1: moneySchema,
    prizeMoney2: moneySchema,
    prizeMoney3: moneySchema,
    prizeMoney4: moneySchema,
    prizeMoney5: moneySchema,
    prizeMoney6: moneySchema,
    prizeMoney7: moneySchema,
    prizeMoney8: moneySchema,
    runs: z.array(topazRunSchema).max(32).optional(),
  })
  .refine(
    (race) => Boolean(race.raceStart ?? race.raceTimeDateUTC ?? race.raceTime),
    "race timestamp required",
  );

const topazMeetingSchema: z.ZodType<TopazMeeting> = z.object({
  meetingId: identifierSchema,
  trackName: shortTextSchema,
  meetingDate: timestampSchema,
  meetingType: optionalShortTextSchema,
  meetingCategory: optionalShortTextSchema,
  owningAuthorityCode: z.string().trim().min(1).max(16).nullish(),
  races: z.array(topazRaceSchema).max(64).optional(),
});

const topazMeetingListSchema = z.array(topazMeetingSchema).max(512);
const topazMeetingDetailSchema: z.ZodType<TopazMeeting> = topazMeetingSchema;
const topazRecentResultSchema: z.ZodType<TopazRecentResult> = z.object({
  raceId: identifierSchema,
  trackName: shortTextSchema,
  raceName: optionalShortTextSchema,
  raceTypeName: optionalShortTextSchema,
  raceTypeCode: optionalShortTextSchema,
  raceNumber: z.number().int().min(1).max(64),
  distance: z.number().int().min(1).max(5_000),
  raceStart: timestampSchema,
  prizeMoney1st: moneySchema,
  prizeMoney2nd: moneySchema,
  prizeMoney3rd: moneySchema,
  prizeMoney4th: moneySchema,
  prizeMoney5th: moneySchema,
  prizeMoney6th: moneySchema,
  prizeMoney7th: moneySchema,
  prizeMoney8th: moneySchema,
  runs: z.array(topazRunSchema).max(32),
});
const topazRecentResultListSchema = z.array(topazRecentResultSchema).max(5_000);

export class TopazProvider implements LiveDataProvider {
  readonly name = "topaz";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]> {
    const from = formatDate(new Date());
    const to = formatDate(addDays(new Date(), days));
    const meetings = await this.get(
      "/meeting",
      {
        from,
        to,
        owningauthoritycode: TOPAZ_AUTHORITY,
      },
      topazMeetingListSchema,
    );

    return Promise.all(
      ensureArray(meetings).map(async (meeting) => {
        const detail = await this.get(
          `/meeting/${meeting.meetingId}`,
          { format: "full" },
          topazMeetingDetailSchema,
        );
        return mapMeeting(detail);
      })
    );
  }

  async fetchResults(days: number): Promise<LiveMeeting[]> {
    const since = addDays(new Date(), -Math.max(days, 1));
    const recent = await this.get(
      "/raceresult/recent",
      {},
      topazRecentResultListSchema,
    );
    return groupRecentResults(
      ensureArray(recent).filter((race) => new Date(race.raceStart) >= since)
    );
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
    schema: z.ZodType<T>,
    attempt = 0,
  ): Promise<T> {
    const url = new URL(path, TOPAZ_BASE);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("topaz.request_timeout")),
      TOPAZ_REQUEST_TIMEOUT_MS,
    );
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { "X-API-Key": this.apiKey },
        signal: controller.signal,
      });
    } catch {
      throw new Error(
        controller.signal.aborted
          ? "topaz.request_timeout"
          : "topaz.request_failed",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(response, attempt));
      return this.get(path, params, schema, attempt + 1);
    }
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(response, attempt));
      return this.get(path, params, schema, attempt + 1);
    }
    if (!response.ok) {
      throw new Error(`topaz.request_failed:${response.status}`);
    }

    const body = await readBoundedTextResponse(response, TOPAZ_JSON_POLICY);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error("topaz.response_invalid_json");
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new Error("topaz.response_invalid");
    return parsed.data;
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
  const prizeMoneyByPosition = placePrizeMoney(race);
  return {
    sourceId: race.raceId != null ? String(race.raceId) : undefined,
    raceNumber: Math.trunc(numberOr(race.raceNumber, 0)),
    raceTime: isoDate(
      race.raceStart ?? race.raceTimeDateUTC ?? race.raceTime ?? new Date()
    ),
    distance: Math.trunc(numberOr(race.distance, 0)),
    grade: race.raceType ?? race.raceTypeName ?? race.raceTypeCode ?? undefined,
    prizeMoney: totalPrizeMoney(race),
    runners: ensureArray(race.runs).map((run) =>
      applyPrizeMoneyWon(mapRun(run), prizeMoneyByPosition)
    ),
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

  const parts = placePrizeMoney(race)
    .filter((value): value is number => value != null);

  return parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) : undefined;
}

function placePrizeMoney(race: TopazRace) {
  return [
    race.prizeMoney1,
    race.prizeMoney2,
    race.prizeMoney3,
    race.prizeMoney4,
    race.prizeMoney5,
    race.prizeMoney6,
    race.prizeMoney7,
    race.prizeMoney8,
  ].map(numberOrNull);
}

function applyPrizeMoneyWon(
  runner: LiveRunner,
  prizeMoneyByPosition: Array<number | null>
) {
  if (
    runner.finishingPosition == null ||
    !prizeMoneyByPosition.some((value) => value != null)
  ) {
    return runner;
  }

  const prizeMoneyWon = prizeMoneyByPosition[runner.finishingPosition - 1] ?? 0;
  return { ...runner, prizeMoneyWon };
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
