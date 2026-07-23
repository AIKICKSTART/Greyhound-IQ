import type { LiveDataProvider, LiveMeeting, LiveRace, LiveRunner } from "./provider";
import { logExecutionWarn } from "../logger";
import { readBoundedTextResponse } from "../remote-response";
import {
  parseWatchdogPayload,
  type WatchdogMeeting,
  type WatchdogParticipant,
  type WatchdogPayload,
  type WatchdogRace,
} from "./watchdog-response";

const WATCHDOG_BASE =
  process.env.WATCHDOG_BASE_URL ?? "https://watchdog.grv.org.au";
const WATCHDOG_MAX_MEETINGS = Math.min(
  positiveInt(process.env.WATCHDOG_MAX_MEETINGS, 40),
  128
);
const WATCHDOG_CONCURRENCY = Math.min(
  positiveInt(process.env.WATCHDOG_CONCURRENCY, 4),
  10
);
const WATCHDOG_FETCH_TIMEOUT_MS = Math.min(
  positiveInt(process.env.WATCHDOG_FETCH_TIMEOUT_MS, 30_000),
  120_000
);
const WATCHDOG_JSON_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedContentTypes: ["application/json", "+json"],
} as const;
const WATCHDOG_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type FetchLike = typeof fetch;

export class WatchdogProvider implements LiveDataProvider {
  readonly name = "watchdog";

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]> {
    const payload = await this.getJson(
      `/api/public/form/upcoming-meetings/${new Date().toISOString()}`
    );
    const meetings = ensureArray(payload.meetings)
      .filter((meeting) => isMeetingInForwardWindow(meeting, days))
      .slice(0, WATCHDOG_MAX_MEETINGS);

    return this.fetchMeetingDetails(meetings);
  }

  async fetchResults(days: number): Promise<LiveMeeting[]> {
    const recent = await this.getJson("/api/public/form/recent");
    const meetings = ensureArray(recent.meetings)
      .filter((meeting) => isMeetingInRecentWindow(meeting, days))
      .slice(0, WATCHDOG_MAX_MEETINGS);

    return this.fetchMeetingDetails(meetings);
  }

  /**
   * Historical enumeration. The calendar-month endpoint returns roughly a
   * six-week window of VIC meetings around the given date (verified back to
   * 2006; race-level replay videoIds exist from 2014-01-01).
   */
  async fetchMeetingsByCalendarMonth(
    monthDate: Date,
    range: { from: Date; to: Date }
  ): Promise<LiveMeeting[]> {
    const payload = await this.getJson(
      `/api/public/form/calendar-month/${monthDate.toISOString()}`
    );
    const meetings = ensureArray(payload.meetings).filter((meeting) => {
      const date = new Date(meeting.meetingDate ?? meeting.startTime ?? "");
      if (Number.isNaN(date.getTime())) return false;
      return date >= range.from && date <= range.to;
    });
    return this.fetchMeetingDetails(meetings);
  }

  private async fetchMeetingDetails(
    meetings: WatchdogMeeting[]
  ): Promise<LiveMeeting[]> {
    const detailed = await mapLimit(
      meetings,
      WATCHDOG_CONCURRENCY,
      async (meeting) => {
        try {
          const payload = await this.getJson(
            `/api/public/form/meeting/${meeting.id}`
          );
          return mapWatchdogPayload(payload);
        } catch (err) {
          await logExecutionWarn("live.watchdog.meeting_skipped", {
            provider: this.name,
            meetingId: meeting.id,
          }, err);
          return [];
        }
      }
    );

    return detailed.flat();
  }

  private async getJson(path: string): Promise<WatchdogPayload> {
    const signal = AbortSignal.timeout(WATCHDOG_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, WATCHDOG_BASE), {
        redirect: "error",
        signal,
        headers: {
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": WATCHDOG_USER_AGENT,
        },
      });
    } catch {
      throw new Error(
        signal.aborted ? "watchdog.request_timeout" : "watchdog.request_failed"
      );
    }

    if (!response.ok) {
      throw new Error(`watchdog.request_failed:${response.status}`);
    }

    const body = await readBoundedTextResponse(response, WATCHDOG_JSON_POLICY);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error("watchdog.response_invalid_json");
    }
    return parseWatchdogPayload(payload);
  }
}

export function mapWatchdogPayload(payload: WatchdogPayload): LiveMeeting[] {
  const meetings = ensureArray(payload.meetings);
  const races = ensureArray(payload.races);
  const participants = ensureArray(payload.participants);

  return meetings
    .map((meeting) => {
      const meetingId = String(meeting.id);
      const meetingRaces =
        races.filter((race) => String(race.meetingId) === meetingId).length > 0
          ? races.filter((race) => String(race.meetingId) === meetingId)
          : meetings.length === 1
            ? races
            : [];

      return mapWatchdogMeeting(meeting, meetingRaces, participants);
    })
    .filter((meeting): meeting is LiveMeeting => meeting.races.length > 0);
}

function mapWatchdogMeeting(
  meeting: WatchdogMeeting,
  races: WatchdogRace[],
  participants: WatchdogParticipant[]
): LiveMeeting {
  const participantsByRace = groupBy(participants, (participant) =>
    participant.raceId == null ? "" : String(participant.raceId)
  );
  const meetingDate = startOfDayIso(meeting.meetingDate ?? meeting.startTime ?? new Date());

  return {
    sourceId: String(meeting.id),
    sourceRawJson: JSON.stringify({
      id: meeting.id,
      trackCode: meeting.trackCode,
      trackName: meeting.trackName,
      slot: meeting.slot,
      statusCode: meeting.statusCode,
      meetingDate: meeting.meetingDate,
      startTime: meeting.startTime,
      countRaces: meeting.countRaces,
      isInterstate: meeting.isInterstate,
    }),
    trackName: meeting.trackName?.trim() || meeting.trackCode?.trim() || "Unknown VIC track",
    state: "VIC",
    meetingDate,
    meetingType: [meeting.slot, meeting.statusCode].filter(Boolean).join(" ") || "Watchdog VIC",
    races: races
      .map((race) =>
        mapWatchdogRace(
          race,
          participantsByRace.get(String(race.id)) ?? [],
          meetingDate
        )
      )
      .filter((race): race is LiveRace => race.raceNumber > 0)
      .sort((a, b) => a.raceNumber - b.raceNumber),
  };
}

function mapWatchdogRace(
  race: WatchdogRace,
  participants: WatchdogParticipant[],
  meetingDate: string
): LiveRace {
  const videoId = race.videoId?.trim() || undefined;
  const prizeMoneyByPosition = placePrizeMoney(race);
  const runners = participants
    .map(mapWatchdogRunner)
    .filter((runner): runner is LiveRunner => runner != null)
    .map((runner) => applyPrizeMoneyWon(runner, prizeMoneyByPosition))
    .filter((runner) => runner.boxNumber > 0)
    .sort((a, b) => a.boxNumber - b.boxNumber);

  return {
    sourceId: String(race.id),
    sourceRawJson: JSON.stringify({
      id: race.id,
      number: race.number,
      raceNumber: race.raceNumber,
      meetingId: race.meetingId,
      sponsor: race.sponsor,
      distance: race.distance,
      grade: race.grade,
      gradeCode: race.gradeCode,
      firstPrize: race.firstPrize,
      secondPrize: race.secondPrize,
      thirdPrize: race.thirdPrize,
      fourthPrize: race.fourthPrize,
      fifthPrize: race.fifthPrize,
      sixthPrize: race.sixthPrize,
      seventhPrize: race.seventhPrize,
      eighthPrize: race.eighthPrize,
      videoId,
      photoFinishUrl: race.photoFinishUrl,
      declaration: race.declaration,
      startTime: race.startTime,
      trackCode: race.trackCode,
      participantCount: participants.length,
    }),
    raceNumber: Math.trunc(numberOr(race.number ?? race.raceNumber, 0)),
    name: race.sponsor?.trim() || undefined,
    raceTime: isoDate(race.startTime ?? meetingDate),
    distance: Math.trunc(numberOr(race.distance, 0)),
    grade: race.grade ?? race.gradeCode ?? undefined,
    prizeMoney: totalPrizeMoney(race),
    resultStatus: runners.some((runner) => runner.finishingPosition != null)
      ? "posted"
      : undefined,
    replayUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
    photoFinishUrl: race.photoFinishUrl ?? undefined,
    videoSourceId: videoId,
    videoSourceType: videoId ? "youtube" : undefined,
    runners,
  };
}

function mapWatchdogRunner(participant: WatchdogParticipant): LiveRunner | null {
  const boxNumber = Math.trunc(
    numberOr(participant.box, numberOr(participant.rugNumber, 0))
  );
  const dogSourceId = stableSourceId(participant.dogId);
  const dogName = participant.dogName?.trim();
  if (!dogSourceId || !isRealDogName(dogName)) return null;

  return {
    sourceId:
      participant.id != null
        ? String(participant.id)
        : participant.raceId != null
          ? `${participant.raceId}:box:${boxNumber}`
          : undefined,
    sourceProvider: "watchdog",
    sourceRawJson: JSON.stringify({
      id: participant.id,
      raceId: participant.raceId,
      rugNumber: participant.rugNumber,
      box: participant.box,
      isLateScratching: participant.isLateScratching,
      dogId: participant.dogId,
      dogName: participant.dogName,
      trainer: participant.trainer,
      trainerId: participant.trainerId,
      owner: participant.owner,
      last5: participant.last5,
      averageFirstSplitSpeed: participant.averageFirstSplitSpeed,
      resultPlace: participant.resultPlace,
      resultWeight: participant.resultWeight,
      resultMargin: participant.resultMargin,
      resultTime: participant.resultTime,
      resultFirstSplitTime: participant.resultFirstSplitTime,
      comments: participant.comments,
      sireName: participant.sireName,
      sireId: participant.sireId,
      damName: participant.damName,
      damId: participant.damId,
      colour: participant.colour,
      whelpedDate: participant.whelpedDate,
      sex: participant.sex,
      careerPrizeMoney: participant.careerPrizeMoney,
      pir: participant.pir,
      runLine: participant.runLine,
      jumpStyle: participant.jumpStyle,
    }),
    boxNumber,
    dog: {
      sourceProvider: "watchdog",
      sourceId: dogSourceId,
      name: dogName,
      sex: participant.sex ?? undefined,
      colour: participant.colour ?? undefined,
      whelpDate: participant.whelpedDate ?? undefined,
      sire: parentEvidence(participant.sireId, participant.sireName),
      dam: parentEvidence(participant.damId, participant.damName),
    },
    trainerName: participant.trainer ?? undefined,
    weight: numberOrNull(participant.resultWeight) ?? undefined,
    scratched:
      participant.isLateScratching === true ||
      String(participant.box ?? "").toLowerCase() === "scratched",
    finishingPosition: numberOrNull(participant.resultPlace) ?? undefined,
    runningTime: numberOrNull(participant.resultTime) ?? undefined,
    margin: parseMargin(participant.resultMargin) ?? undefined,
    splitTime: numberOrNull(participant.resultFirstSplitTime) ?? undefined,
  };
}

function parentEvidence(
  id: WatchdogParticipant["sireId"] | WatchdogParticipant["damId"],
  name: string | null | undefined,
) {
  const sourceId = stableSourceId(id);
  if (!sourceId && !isRealDogName(name)) return undefined;
  return {
    sourceProvider: sourceId ? "watchdog" : undefined,
    sourceId,
    name: isRealDogName(name) ? name.trim() : undefined,
  };
}

function stableSourceId(value: string | number | null | undefined) {
  if (value == null) return undefined;
  const sourceId = String(value).trim();
  return sourceId && sourceId.length <= 128 ? sourceId : undefined;
}

function isRealDogName(value?: string | null): value is string {
  const name = value?.trim();
  return Boolean(
    name &&
      !/^(?:unknown(?:\s+(?:dog|runner))?|unnamed|tba|tbd|n\/?a|vacant(?:\s+box)?|no\s+reserve|runner\s+\d+|dog\s+\d+|-)$/i.test(
        name,
      ),
  );
}

function totalPrizeMoney(race: WatchdogRace) {
  const values = placePrizeMoney(race)
    .filter((value): value is number => value != null);

  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

function placePrizeMoney(race: WatchdogRace) {
  return [
    race.firstPrize,
    race.secondPrize,
    race.thirdPrize,
    race.fourthPrize,
    race.fifthPrize,
    race.sixthPrize,
    race.seventhPrize,
    race.eighthPrize,
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

function isMeetingInForwardWindow(meeting: WatchdogMeeting, days: number) {
  const date = new Date(meeting.startTime ?? meeting.meetingDate ?? "");
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  const until = new Date(now.getTime() + Math.max(days, 1) * MS_PER_DAY);
  return date >= startOfDay(now) && date <= until;
}

function isMeetingInRecentWindow(meeting: WatchdogMeeting, days: number) {
  const date = new Date(meeting.startTime ?? meeting.meetingDate ?? "");
  if (Number.isNaN(date.getTime())) return true;
  const since = new Date(Date.now() - Math.max(days, 1) * MS_PER_DAY);
  return date >= since;
}

function startOfDayIso(input: string | Date) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return startOfDay(new Date()).toISOString();
  return startOfDay(date).toISOString();
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDate(input: string | Date) {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function parseMargin(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return null;
  return numberOrNull(String(value).match(/-?\d+(?:\.\d+)?/)?.[0]);
}

function numberOr(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOrNull(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    for (;;) {
      const current = index++;
      if (current >= items.length) return;
      results[current] = await mapper(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker)
  );

  return results;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    if (!key) continue;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return grouped;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
