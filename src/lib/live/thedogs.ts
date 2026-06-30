import type { LiveDataProvider, LiveMeeting, LiveRace, LiveRunner } from "./provider";

const THEDOGS_BASE =
  process.env.THEDOGS_BASE_URL ?? "https://www.thedogs.com.au";
const THEDOGS_MAX_MEETINGS = positiveInt(
  process.env.THEDOGS_MAX_MEETINGS,
  80
);
const THEDOGS_CONCURRENCY = positiveInt(process.env.THEDOGS_CONCURRENCY, 5);
const THEDOGS_TIME_ZONE =
  process.env.THEDOGS_TIME_ZONE ?? "Australia/Sydney";
const THEDOGS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type FetchLike = typeof fetch;
type FeedKind = "upcoming" | "recent";

interface TheDogsMeetingLink {
  href: string;
  name: string;
  state?: string;
  date: string;
}

export class TheDogsProvider implements LiveDataProvider {
  readonly name = "thedogs";

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
    const indexPath = kind === "upcoming" ? "/racing/racecards" : "/racing";
    const index = await this.getText(indexPath);
    const links = parseMeetingLinks(index)
      .filter((link) => isMeetingInWindow(link.date, kind, days))
      .slice(0, THEDOGS_MAX_MEETINGS);

    return (
      await mapLimit(links, THEDOGS_CONCURRENCY, async (link) => {
        try {
          const html = await this.getText(link.href);
          return parseTheDogsMeeting(html, link);
        } catch (err) {
          console.warn(
            `[thedogs] Skipping ${link.href}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          return null;
        }
      })
    ).filter((meeting): meeting is LiveMeeting => meeting != null);
  }

  private async getText(path: string): Promise<string> {
    const url = new URL(path, THEDOGS_BASE);
    const response = await this.fetchImpl(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": THEDOGS_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }

    return response.text();
  }
}

export function parseTheDogsMeeting(
  html: string,
  link: TheDogsMeetingLink
): LiveMeeting {
  const venue = parseVenue(html);
  const date = link.date;
  const raceTimes = parseRaceTimes(html);
  const races = splitRaceSections(html)
    .map((section) => parseRace(section, raceTimes, date))
    .filter((race): race is LiveRace => race != null)
    .sort((a, b) => a.raceNumber - b.raceNumber);

  return {
    sourceId: link.href,
    trackName: venue.name || link.name,
    state: venue.state || link.state,
    meetingDate: `${date}T00:00:00.000Z`,
    meetingType: "The Dogs Live",
    races,
  };
}

export function parseMeetingLinks(html: string): TheDogsMeetingLink[] {
  const links = new Map<string, TheDogsMeetingLink>();
  for (const match of html.matchAll(/<li class="list__row">([\s\S]*?)<\/li>/gi)) {
    const row = match[1];
    if (!row) continue;
    const href = firstMatch(
      row,
      /<a class="list__row" href="(\/racing\/[^/]+\/\d{4}-\d{2}-\d{2}\?trial=false)"/i
    );
    if (!href || links.has(href)) continue;

    const date = href.match(/\/(\d{4}-\d{2}-\d{2})\?trial=false$/)?.[1];
    if (!date) continue;

    const name = cleanHtml(
      firstMatch(row, /<div class="meeting__info__name">([\s\S]*?)<\/div>/i)
    );
    const caption = firstMatch(
      row,
      /<div class="meeting__info__caption">([\s\S]*?)<\/div>/i
    );
    const state = cleanHtml(firstMatch(caption, /<span>([A-Z]{2,3})<\/span>/i));

    links.set(href, { href, name, state: state || undefined, date });
  }

  return [...links.values()];
}

function parseVenue(html: string) {
  return {
    name: cleanHtml(
      firstMatch(
        html,
        /<div class="meeting-header__venue__name">([\s\S]*?)<\/div>/i
      )
    ),
    state: cleanHtml(
      firstMatch(
        html,
        /<div class="meeting-header__venue__state">([\s\S]*?)<\/div>/i
      )
    ),
  };
}

function parseRaceTimes(html: string) {
  const times = new Map<number, string>();
  for (const match of html.matchAll(/<a class="race-box[^"]*"([^>]*)>/gi)) {
    const attrs = match[1] ?? "";
    const href = firstMatch(attrs, /href="([^"]+)"/i);
    const raceNumber = Number(
      href.match(/\/racing\/[^/]+\/\d{4}-\d{2}-\d{2}\/(\d+)\//)?.[1]
    );
    const raceTime = firstMatch(attrs, /data-race-box="([^"]+)"/i);
    if (raceNumber && raceTime) times.set(raceNumber, new Date(raceTime).toISOString());
  }
  return times;
}

function splitRaceSections(html: string) {
  const starts = [...html.matchAll(/<a class="race-header" href="([^"]+)">/gi)]
    .map((match) => ({ index: match.index, href: match[1] }))
    .filter((match): match is { index: number; href: string } => match.index != null);

  return starts.map((start, index) => ({
    href: start.href,
    html: html.slice(start.index, starts[index + 1]?.index ?? html.length),
  }));
}

function parseRace(
  section: { href: string; html: string },
  raceTimes: Map<number, string>,
  date: string
): LiveRace | null {
  const raceNumber = Number(section.href.match(/\/(\d+)\//)?.[1]);
  if (!Number.isFinite(raceNumber) || raceNumber <= 0) return null;

  const gradeAndDistance = cleanHtml(
    firstMatch(
      section.html,
      /<div class="race-header__info__grade">([\s\S]*?)<\/div>/i
    )
  );
  const distance = Number(gradeAndDistance.match(/(\d{3,4})m\b/i)?.[1] ?? 0);

  return {
    sourceId: section.href,
    raceNumber,
    raceTime: raceTimes.get(raceNumber) ?? fallbackRaceTimeIso(date, raceNumber),
    distance,
    grade:
      gradeAndDistance.replace(/\s*\d{3,4}m\s*$/i, "").trim() || undefined,
    prizeMoney: parseMoney(
      firstMatch(
        section.html,
        /<div class="race-header__prize__total">([\s\S]*?)<\/div>/i
      )
    ),
    runners: parseRunners(section.html),
  };
}

function parseRunners(section: string): LiveRunner[] {
  return [...section.matchAll(/<tr class="race-runner">([\s\S]*?)<\/tr>/gi)]
    .map((match, index) => parseRunner(match[1] ?? "", index))
    .filter((runner): runner is LiveRunner => runner != null);
}

function parseRunner(row: string, index: number): LiveRunner | null {
  const boxNumber = Number(firstMatch(row, /sprite-svg name="rug_(\d+)"/i)) || index + 1;
  const rawDogName = cleanHtml(
    firstMatch(row, /<div class="race-runners__name__dog">([\s\S]*?)<\/div>/i)
  );
  const dogName = rawDogName.replace(/\s*\(SCR\)\s*$/i, "").trim();
  if (!dogName || /vacant box/i.test(dogName)) return null;

  const colourSex = cleanHtml(
    firstMatch(
      row,
      /<div class="race-runners__name__dog__color__sex">([\s\S]*?)<\/div>/i
    )
  );

  return {
    boxNumber,
    dog: {
      name: dogName,
      colour: parseColour(colourSex),
      sex: parseSex(colourSex),
    },
    trainerName:
      cleanHtml(firstMatch(row, /T:\s*([^<]+)/i)) ||
      cleanHtml(
        firstMatch(
          row,
          /<td class="table__cell--tight race-runners__trainer">([\s\S]*?)<\/td>/i
        )
      ) ||
      undefined,
    scratched: /\(SCR\)|scratched/i.test(row),
  };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    for (;;) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

function isMeetingInWindow(date: string, kind: FeedKind, days: number) {
  const meetingDay = dayValue(date);
  const today = dayValue(formatSydneyDate(new Date()));
  const span = Math.max(days, 1) * MS_PER_DAY;
  if (kind === "upcoming") return meetingDay >= today && meetingDay <= today + span;
  return meetingDay <= today && meetingDay >= today - span;
}

function fallbackRaceTimeIso(date: string, raceNumber: number) {
  return new Date(
    `${date}T12:${raceNumber.toString().padStart(2, "0")}:00+10:00`
  ).toISOString();
}

function formatSydneyDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: THEDOGS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dayValue(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function parseMoney(value?: string) {
  const parsed = Number(cleanHtml(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseSex(value: string) {
  const sex = value.match(/\b([BD])$/i)?.[1]?.toUpperCase();
  if (sex === "B") return "F";
  if (sex === "D") return "M";
  return undefined;
}

function parseColour(value: string) {
  const cleaned = value.replace(/\b[BD]\b$/i, "").trim();
  return cleaned || undefined;
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? "";
}

function cleanHtml(value = "") {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
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

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
