import type { LiveDataProvider, LiveMeeting, LiveRace, LiveRunner } from "./provider";

const WATCHDOG_BASE =
  process.env.WATCHDOG_BASE_URL ?? "https://watchdog.grv.org.au";
const WATCHDOG_MAX_MEETINGS = positiveInt(process.env.WATCHDOG_MAX_MEETINGS, 40);
const WATCHDOG_CONCURRENCY = positiveInt(process.env.WATCHDOG_CONCURRENCY, 4);
const WATCHDOG_FETCH_TIMEOUT_MS = positiveInt(
  process.env.WATCHDOG_FETCH_TIMEOUT_MS,
  30_000
);
const WATCHDOG_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type FetchLike = typeof fetch;

interface WatchdogPayload {
  meetings?: WatchdogMeeting[];
  races?: WatchdogRace[];
  participants?: WatchdogParticipant[];
}

interface WatchdogMeeting {
  id: number | string;
  trackCode?: string | null;
  trackName?: string | null;
  slot?: string | null;
  statusCode?: string | null;
  meetingDate?: string | null;
  startTime?: string | null;
  countRaces?: number | null;
  isInterstate?: boolean | null;
}

interface WatchdogRace {
  id: number | string;
  number?: number | null;
  raceNumber?: number | null;
  meetingId?: number | string | null;
  sponsor?: string | null;
  distance?: number | null;
  grade?: string | null;
  gradeCode?: string | null;
  firstPrize?: number | null;
  secondPrize?: number | null;
  thirdPrize?: number | null;
  fourthPrize?: number | null;
  fifthPrize?: number | null;
  sixthPrize?: number | null;
  seventhPrize?: number | null;
  eighthPrize?: number | null;
  suggestedBet?: string | null;
  watchDogTips?: number[] | null;
  overview?: string | null;
  videoId?: string | null;
  photoFinishUrl?: string | null;
  declaration?: string | null;
  startTime?: string | null;
  trackCode?: string | null;
  dividends?: unknown;
  betName?: string | null;
}

interface WatchdogParticipant {
  id?: number | string | null;
  raceId?: number | string | null;
  rugNumber?: number | null;
  box?: string | number | null;
  isLateScratching?: boolean | null;
  dogId?: number | string | null;
  dogName?: string | null;
  trainer?: string | null;
  trainerId?: number | string | null;
  owner?: string | null;
  last5?: string | null;
  averageFirstSplitSpeed?: number | null;
  resultPlace?: number | null;
  resultWeight?: number | null;
  resultMargin?: string | number | null;
  resultTime?: number | null;
  resultFirstSplitTime?: number | null;
  comments?: string | null;
  sireName?: string | null;
  sireId?: number | string | null;
  damName?: string | null;
  damId?: number | string | null;
  colour?: string | null;
  whelpedDate?: string | null;
  sex?: string | null;
  careerPrizeMoney?: number | null;
  pir?: string | null;
  runLine?: string | null;
  jumpStyle?: string | null;
  oddsFixedWin?: number | null;
  oddsToteWin?: number | null;
}

export class WatchdogProvider implements LiveDataProvider {
  readonly name = "watchdog";

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]> {
    const payload = await this.getJson<WatchdogPayload>(
      `/api/public/form/upcoming-meetings/${new Date().toISOString()}`
    );
    const meetings = ensureArray(payload.meetings)
      .filter((meeting) => isMeetingInForwardWindow(meeting, days))
      .slice(0, WATCHDOG_MAX_MEETINGS);

    return this.fetchMeetingDetails(meetings);
  }

  async fetchResults(days: number): Promise<LiveMeeting[]> {
    const recent = await this.getJson<WatchdogPayload>("/api/public/form/recent");
    const meetings = ensureArray(recent.meetings)
      .filter((meeting) => isMeetingInRecentWindow(meeting, days))
      .slice(0, WATCHDOG_MAX_MEETINGS);

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
          const payload = await this.getJson<WatchdogPayload>(
            `/api/public/form/meeting/${meeting.id}`
          );
          return mapWatchdogPayload(payload);
        } catch (err) {
          console.warn(
            `[watchdog] Skipping meeting ${meeting.id}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          return [];
        }
      }
    );

    return detailed.flat();
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(new URL(path, WATCHDOG_BASE), {
      signal: AbortSignal.timeout(WATCHDOG_FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": WATCHDOG_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${path}`);
    }

    return response.json() as Promise<T>;
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
    sourceRawJson: JSON.stringify(meeting),
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
  const runners = participants
    .map(mapWatchdogRunner)
    .filter((runner): runner is LiveRunner => runner.boxNumber > 0)
    .sort((a, b) => a.boxNumber - b.boxNumber);

  return {
    sourceId: String(race.id),
    sourceRawJson: JSON.stringify({
      ...race,
      videoId,
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

function mapWatchdogRunner(participant: WatchdogParticipant): LiveRunner {
  const boxNumber = Math.trunc(
    numberOr(participant.box, numberOr(participant.rugNumber, 0))
  );
  const dogSourceId = participant.dogId == null ? undefined : String(participant.dogId);

  return {
    sourceId:
      participant.id != null
        ? String(participant.id)
        : participant.raceId != null
          ? `${participant.raceId}:box:${boxNumber}`
          : undefined,
    sourceRawJson: JSON.stringify(participant),
    boxNumber,
    dog: {
      name: participant.dogName?.trim() || "Unknown runner",
      earBrand: dogSourceId ? `watchdog:${dogSourceId}` : undefined,
      sex: participant.sex ?? undefined,
      colour: participant.colour ?? undefined,
    },
    trainerName: participant.trainer ?? undefined,
    weight: numberOrNull(participant.resultWeight) ?? undefined,
    startingPrice:
      numberOrNull(participant.oddsFixedWin ?? participant.oddsToteWin) ?? undefined,
    scratched:
      participant.isLateScratching === true ||
      String(participant.box ?? "").toLowerCase() === "scratched",
    finishingPosition: numberOrNull(participant.resultPlace) ?? undefined,
    runningTime: numberOrNull(participant.resultTime) ?? undefined,
    margin: parseMargin(participant.resultMargin) ?? undefined,
    splitTime: numberOrNull(participant.resultFirstSplitTime) ?? undefined,
  };
}

function totalPrizeMoney(race: WatchdogRace) {
  const values = [
    race.firstPrize,
    race.secondPrize,
    race.thirdPrize,
    race.fourthPrize,
    race.fifthPrize,
    race.sixthPrize,
    race.seventhPrize,
    race.eighthPrize,
  ]
    .map(numberOrNull)
    .filter((value): value is number => value != null);

  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined;
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
