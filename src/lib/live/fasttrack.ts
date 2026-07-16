import type { LiveDataProvider, LiveMeeting, LiveRace, LiveRunner } from "./provider";
import { logExecutionWarn } from "../logger";
import { readBoundedTextResponse } from "../remote-response";

const FASTTRACK_BASE =
  process.env.FASTTRACK_BASE_URL ?? "https://fasttrack.grv.org.au";
const FASTTRACK_MAX_MEETINGS = Math.min(
  positiveInt(process.env.FASTTRACK_MAX_MEETINGS, 1),
  40
);
const FASTTRACK_FETCH_TIMEOUT_MS = Math.min(
  positiveInt(process.env.FASTTRACK_FETCH_TIMEOUT_MS, 30_000),
  120_000
);
const FASTTRACK_HTML_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedContentTypes: ["text/html", "application/xhtml+xml"],
} as const;
const FASTTRACK_TIME_ZONE = process.env.TOPAZ_TIME_ZONE ?? "Australia/Sydney";
const FASTTRACK_USER_AGENT =
  "GreyhoundIQ prototype live feed (https://www.grv.org.au/)";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type FetchLike = typeof fetch;
type FeedKind = "upcoming" | "recent";

interface MeetingLink {
  id: string;
  label: string;
}

interface MeetingDateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Temporary public FastTrack reader for prototype/demo work.
 *
 * Production should prefer the official Topaz API. This provider intentionally
 * reads a small bounded set of public FastTrack HTML pages and maps them into
 * the same DTOs as Topaz so the rest of the app can be exercised before the
 * licensed API key is available.
 */
export class FastTrackPrototypeProvider implements LiveDataProvider {
  readonly name = "fasttrack-prototype";
  private homeHtml?: Promise<string>;

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchUpcomingMeetings(days: number): Promise<LiveMeeting[]> {
    return this.fetchMeetings("upcoming", days);
  }

  async fetchResults(days: number): Promise<LiveMeeting[]> {
    return this.fetchMeetings("recent", days);
  }

  private async fetchMeetings(
    kind: FeedKind,
    days: number
  ): Promise<LiveMeeting[]> {
    const home = await this.getHome();
    const links = parseMeetingLinks(home, kind).slice(0, FASTTRACK_MAX_MEETINGS);
    const meetings: LiveMeeting[] = [];

    for (const link of links) {
      try {
        const html = await this.getText(
          `/RaceField/ViewRaces/${link.id}?raceId=0`
        );
        const meeting = parseFastTrackMeeting(html, link.label);
        if (meeting.races.length > 0 && isMeetingInWindow(meeting, kind, days)) {
          meetings.push({
            ...meeting,
            sourceId: link.id,
            races: meeting.races.map((race) => ({
              ...race,
              sourceId: `${link.id}:R${race.raceNumber}`,
            })),
          });
        }
      } catch (err) {
        await logExecutionWarn("live.fasttrack.meeting_skipped", {
          provider: this.name,
          meetingId: link.id,
        }, err);
      }
    }

    return meetings;
  }

  private getHome() {
    this.homeHtml ??= this.getText("/");
    return this.homeHtml;
  }

  private async getText(path: string): Promise<string> {
    const url = new URL(path, FASTTRACK_BASE);
    const signal = AbortSignal.timeout(FASTTRACK_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        redirect: "error",
        signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": FASTTRACK_USER_AGENT,
        },
      });
    } catch {
      throw new Error(
        signal.aborted ? "fasttrack.request_timeout" : "fasttrack.request_failed"
      );
    }

    if (!response.ok) {
      throw new Error(`fasttrack.request_failed:${response.status}`);
    }

    return readBoundedTextResponse(response, FASTTRACK_HTML_POLICY);
  }
}

export function parseFastTrackMeeting(
  html: string,
  fallbackLabel = "FastTrack meeting"
): LiveMeeting {
  const meta = parseMeetingMeta(html, fallbackLabel);

  return {
    trackName: meta.trackName,
    state: "VIC",
    meetingDate: meetingDateIso(meta.dateParts),
    meetingType: "FastTrack Prototype",
    races: parseRaceSections(html, meta.dateParts),
  };
}

function parseMeetingLinks(html: string, kind: FeedKind): MeetingLink[] {
  const heading = kind === "upcoming" ? "Upcoming Meetings" : "Recent Results";
  const section = rightNavSection(html, heading);
  const links = new Map<string, MeetingLink>();
  const anchorPattern =
    /<a\s+href="\/RaceField\/ViewRaces\/(\d+)(?:\?[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of section.matchAll(anchorPattern)) {
    const id = match[1];
    if (!id || links.has(id)) continue;
    links.set(id, { id, label: cleanHtml(match[2]) });
    if (links.size >= FASTTRACK_MAX_MEETINGS) break;
  }

  return [...links.values()];
}

function rightNavSection(html: string, heading: string) {
  const headingIndex = html.indexOf(`<h2>${heading}</h2>`);
  if (headingIndex < 0) return html;

  const start =
    html.lastIndexOf('<div class="rightNavSectionContainer"', headingIndex) ??
    headingIndex;
  const next = html.indexOf(
    '<div class="rightNavSectionContainer"',
    headingIndex + heading.length
  );
  return html.slice(start < 0 ? headingIndex : start, next < 0 ? html.length : next);
}

function parseMeetingMeta(html: string, fallbackLabel: string) {
  const title = cleanHtml(firstMatch(html, /<title>([\s\S]*?)<\/title>/i));
  const titleMatch = title.match(/^(.+?)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (titleMatch) {
    const dateParts = {
      year: Number(titleMatch[4]),
      month: Number(titleMatch[3]),
      day: Number(titleMatch[2]),
    };
    if (isValidDateParts(dateParts)) {
      return {
        trackName: normalizeTrackName(titleMatch[1]),
        dateParts,
      };
    }
  }

  const labelDate = fallbackLabel.match(/(\d{1,2})\/(\d{1,2})/);
  const now = new Date();
  const labelDateParts = labelDate
    ? {
        year: now.getFullYear(),
        month: Number(labelDate[2]),
        day: Number(labelDate[1]),
      }
    : undefined;
  if (!labelDateParts || !isValidDateParts(labelDateParts)) {
    throw new Error("fasttrack.response_invalid");
  }
  return {
    trackName: normalizeTrackName(fallbackLabel.replace(/\s+-\s+.*$/, "")),
    dateParts: labelDateParts,
  };
}

function parseRaceSections(
  html: string,
  dateParts: MeetingDateParts
): LiveRace[] {
  return splitRaceSections(html)
    .map((section) => parseRace(section, dateParts))
    .filter((race): race is LiveRace => race != null)
    .sort((a, b) => a.raceNumber - b.raceNumber);
}

function splitRaceSections(html: string) {
  const starts = [...html.matchAll(/<div class="race-detail clear-both">/gi)]
    .map((match) => match.index)
    .filter((index): index is number => index != null)
    .slice(0, 64);

  return starts.map((start, index) =>
    html.slice(start, starts[index + 1] ?? html.length)
  );
}

function parseRace(
  section: string,
  dateParts: MeetingDateParts
): LiveRace | null {
  const raceNumber = parseInteger(
    cleanHtml(firstMatch(section, /<div class="race-number">\s*([\s\S]*?)<\/div>/i))
  );
  if (!raceNumber || raceNumber > 64) return null;

  const raceTimeText = cleanHtml(
    firstMatch(section, /<div class="race-time"[^>]*>([\s\S]*?)<\/div>/i)
  );
  const raceTime = raceTimeIso(dateParts, raceTimeText);
  if (!raceTime) return null;
  const runners = parseResultRunners(section);

  return {
    raceNumber,
    raceTime,
    distance: parseDistance(section),
    grade: parseGrade(section),
    prizeMoney: parsePrizeMoney(section),
    runners: runners.length > 0 ? runners : parseFormGuideRunners(section),
  };
}

function parseResultRunners(section: string): LiveRunner[] {
  const table = firstMatch(
    section,
    /<table class="raceResultsTable">([\s\S]*?)<\/table>/i
  );
  if (!table) return [];

  return parseTableRows(table)
    .flatMap<LiveRunner>((cells, index) => {
      const dog = parseDog(cells[1]?.raw ?? "");
      if (!dog) return [];
      const finishingPosition = parseInteger(cells[0]?.text);
      const runningTime = parseNumber(cells[8]?.text);
      const margin = parseNumber(cells[9]?.text);
      const weight = parseNumber(cells[5]?.text);
      return [{
        boxNumber:
          parseInteger(cells[3]?.text) ??
          parseInteger(cells[4]?.text) ??
          index + 1,
        dog,
        trainerName: optionalText(cells[2]?.text),
        weight: weight && weight > 0 ? weight : undefined,
        scratched: finishingPosition == null && (runningTime == null || runningTime === 0),
        finishingPosition: finishingPosition ?? undefined,
        runningTime: runningTime && runningTime > 0 ? runningTime : undefined,
        margin: margin && margin > 0 ? margin : undefined,
      } satisfies LiveRunner];
    })
    .filter(isRealRunner);
}

function parseFormGuideRunners(section: string): LiveRunner[] {
  const rows = [
    ...section.matchAll(
      /<tr class="ReportRaceDogLine">([\s\S]*?)<\/tr>/gi
    ),
  ];

  return rows
    .slice(0, 32)
    .flatMap<LiveRunner>((match, index) => {
      const cells = parseCells(match[1]);
      const dog = parseDog(cells[2]?.raw ?? "");
      if (!dog) return [];
      return [{
        boxNumber: parseInteger(cells[1]?.text) ?? index + 1,
        dog,
        trainerName: optionalText(cells[6]?.text),
        scratched: /scratched/i.test(cells.map((cell) => cell.text).join(" ")),
      } satisfies LiveRunner];
    })
    .filter(isRealRunner);
}

function parseTableRows(tableHtml: string) {
  const body = firstMatch(tableHtml, /<tbody[^>]*>([\s\S]*?)<\/tbody>/i) || tableHtml;
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .slice(0, 32)
    .map((match) => parseCells(match[1]))
    .filter((cells) => cells.length > 0);
}

function parseCells(rowHtml: string) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => ({
    raw: match[1] ?? "",
    text: cleanHtml(match[1] ?? ""),
  }));
}

function parseDistance(section: string) {
  const labelled = valueAfterLabel(
    section,
    "SelectedResultsForRace_DistanceInMetres"
  );
  const distance = parseInteger(
    labelled.match(/(\d{3,4})\s*(?:metres|m)\b/i)?.[1] ??
      firstMatch(section, /(\d{3,4})\s*(?:metres|m)\b/i)
  );
  return distance != null && distance <= 5_000 ? distance : 0;
}

function parseGrade(section: string) {
  const labelled = valueAfterLabel(section, "SelectedResultsForRace_RaceTypeName");
  if (labelled) return labelled;

  const description = firstMatch(
    section,
    /<div class="race-description-content">([\s\S]*?)<h5>/i
  );
  const values = [...description.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)]
    .map((match) => cleanHtml(match[1]))
    .filter((value) => value && !/\d{3,4}\s*(?:metres|m)\b/i.test(value));

  return optionalText(values[0]);
}

function parsePrizeMoney(section: string) {
  const labelled = valueAfterLabel(section, "SelectedResultsForRace_PrizeMoney");
  if (labelled) return parseMoney(labelled) ?? undefined;

  const text = cleanHtml(
    firstMatch(
      section,
      /((?:Stakemoney|Prize\s*Money)[\s\S]{0,2000})/i,
    ),
    2_000,
  );
  const total = text.match(
    /(?:Stakemoney|Prize\s*Money)\s+Of\s+\$?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/i
  );
  return parseNumber(total?.[1]) ?? undefined;
}

function valueAfterLabel(section: string, labelFor: string) {
  return cleanHtml(
    firstMatch(
      section,
      new RegExp(
        `for="${escapeRegExp(labelFor)}"[^>]*>[\\s\\S]*?<\\/label>[\\s\\S]*?<div class="display-value-race-results"[^>]*>([\\s\\S]*?)<\\/div>`,
        "i"
      )
    )
  );
}

function raceTimeIso(
  dateParts: MeetingDateParts,
  raceTimeText: string
) {
  const timeMatch = raceTimeText.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m?/i);
  if (!timeMatch) return undefined;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return undefined;
  }
  const meridiem = timeMatch[3].toLowerCase();
  if (meridiem === "p" && hour !== 12) hour += 12;
  if (meridiem === "a" && hour === 12) hour = 0;

  const offset = sydneyOffsetHours(dateParts);
  return new Date(
    `${dateKey(dateParts)}T${pad(hour)}:${pad(minute)}:00${offset}`
  ).toISOString();
}

function sydneyOffsetHours(dateParts: MeetingDateParts) {
  const daylightSavingMonth = dateParts.month >= 10 || dateParts.month <= 4;
  return daylightSavingMonth ? "+11:00" : "+10:00";
}

function isMeetingInWindow(
  meeting: LiveMeeting,
  kind: FeedKind,
  days: number
) {
  const meetingDay = dayValue(meeting.meetingDate);
  const today = dayValue(`${formatSydneyDate(new Date())}T00:00:00.000Z`);
  const span = Math.max(days, 1) * MS_PER_DAY;

  if (kind === "upcoming") {
    return meetingDay >= today && meetingDay <= today + span;
  }

  return meetingDay <= today && meetingDay >= today - span;
}

function dayValue(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function parseDog(raw: string) {
  const text = cleanHtml(raw);
  const sourceId =
    firstMatch(raw, /\bdata-(?:dog|greyhound)-id=["']([1-9][0-9]*)["']/i) ||
    firstMatch(raw, /[?&](?:dogId|greyhoundId)=([1-9][0-9]*)(?:[&#"']|$)/i);
  const sex = text.match(/\[([MF])\]\s*$/i)?.[1]?.toUpperCase();
  const name =
    text
      .replace(/\[[^\]]+\]/g, "")
      .replace(/\s+\([A-Z]{2,4}\)\s*$/i, "")
      .trim();

  if (!sourceId || !isRealDogName(name)) return null;
  return {
    sourceProvider: "fasttrack-prototype",
    sourceId,
    name,
    sex,
  };
}

function isRealRunner(runner: LiveRunner) {
  return isRealDogName(runner.dog.name) && Boolean(runner.dog.sourceId);
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

function normalizeTrackName(value: string) {
  return cleanHtml(value).replace(/\s+-\s+.*$/, "").trim();
}

function meetingDateIso(dateParts: MeetingDateParts) {
  return `${dateKey(dateParts)}T00:00:00.000Z`;
}

function isValidDateParts(dateParts: MeetingDateParts) {
  const date = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)
  );
  return (
    date.getUTCFullYear() === dateParts.year &&
    date.getUTCMonth() + 1 === dateParts.month &&
    date.getUTCDate() === dateParts.day
  );
}

function formatSydneyDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FASTTRACK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dateKey(dateParts: MeetingDateParts) {
  return `${dateParts.year}-${pad(dateParts.month)}-${pad(dateParts.day)}`;
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? "";
}

function optionalText(value?: string) {
  const text = value?.trim();
  return text ? text : undefined;
}

function parseInteger(value?: string) {
  const cleaned = value?.replace(/,/g, "").trim() ?? "";
  if (!/^-?\d+$/.test(cleaned)) return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value?: string) {
  const parsed = Number(value?.replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) && Math.abs(parsed) <= 1_000_000_000
    ? parsed
    : null;
}

function parseMoney(value?: string) {
  const match = value?.match(/\$?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
  const parsed = parseNumber(match?.[1]);
  return parsed != null && parsed >= 0 && parsed <= 100_000_000 ? parsed : null;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanHtml(value: string, maxLength = 500) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, maxLength);
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 10))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}
