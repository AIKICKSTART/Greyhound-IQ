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

interface TheDogsRaceLink {
  href: string;
  raceNumber: number;
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

  async fetchResultsForDate(date: string): Promise<LiveMeeting[]> {
    const index = await this.getText(`/racing?date=${encodeURIComponent(date)}`);
    const links = parseMeetingLinks(index)
      .filter((link) => link.date === date)
      .slice(0, THEDOGS_MAX_MEETINGS);

    return this.fetchResultMeetings(links);
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

    if (kind === "recent") return this.fetchResultMeetings(links);

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

  private async fetchResultMeetings(
    links: TheDogsMeetingLink[]
  ): Promise<LiveMeeting[]> {
    return (
      await mapLimit(links, THEDOGS_CONCURRENCY, async (link) => {
        try {
          const html = await this.getText(link.href);
          const meeting = parseTheDogsMeeting(html, link);
          const resultLinks = parseResultRaceLinks(html);
          const resultRaces = (
            await mapLimit(resultLinks, THEDOGS_CONCURRENCY, async (raceLink) => {
              try {
                const raceHtml = await this.getText(raceLink.href, {
                  accept: "application/json, text/javascript, */*; q=0.01",
                  "X-Application-Layout": "injection",
                });
                return parseTheDogsRaceResult(raceHtml, raceLink, link.date);
              } catch (err) {
                console.warn(
                  `[thedogs] Skipping ${raceLink.href}: ${
                    err instanceof Error ? err.message : String(err)
                  }`
                );
                return null;
              }
            })
          ).filter((race): race is LiveRace => race != null);

          return mergeResultRaces(meeting, resultRaces);
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

  private async getText(
    path: string,
    extraHeaders: Record<string, string> = {}
  ): Promise<string> {
    const url = new URL(path, THEDOGS_BASE);
    const response = await this.fetchImpl(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": THEDOGS_USER_AGENT,
        ...extraHeaders,
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
    sourceRawJson: JSON.stringify({
      href: link.href,
      date: link.date,
      state: link.state,
      source: "meeting_page",
    }),
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
    const href = firstMatch(row, /href="(\/racing\/[^/]+\/\d{4}-\d{2}-\d{2}\?trial=false)"/i);
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

export function parseTheDogsRaceResult(
  html: string,
  link: TheDogsRaceLink,
  date: string
): LiveRace | null {
  const gradeAndDistance = cleanHtml(
    firstMatch(
      html,
      /<div class="race-header__info__grade">([\s\S]*?)<\/div>/i
    )
  );
  const distance = Number(gradeAndDistance.match(/(\d{3,4})m\b/i)?.[1] ?? 0);
  const raceTime = parseRaceTimestamp(html) ?? fallbackRaceTimeIso(date, link.raceNumber);
  const runners = parseRunners(html);
  const replayUrl = parseReplayUrl(html);
  const photoFinishUrl = parsePhotoFinishUrl(html);

  if (runners.length === 0) return null;

  return {
    sourceId: link.href,
    sourceRawJson: JSON.stringify({
      href: link.href,
      resultPage: true,
      replayUrl,
      photoFinishUrl,
      weather: parseWeatherIcon(html),
      trackRecord: parseTrackRecord(html),
      prizePlaces: parsePrizePlaces(html),
      resultSummary: parseActiveResultOrder(html),
    }),
    raceNumber: link.raceNumber,
    name: cleanHtml(
      firstMatch(
        html,
        /<div class="race-header__info__name[^"]*">([\s\S]*?)<\/div>/i
      )
    ),
    raceTime,
    distance,
    grade:
      gradeAndDistance.replace(/\s*\d{3,4}m\s*$/i, "").trim() || undefined,
    prizeMoney:
      parseMoney(firstMatch(html, /<div class="race-header__prize__total">([\s\S]*?)<\/div>/i)) ??
      parseMoney(
        firstMatch(
          html,
          /<div class="race-header__prize__title">PRIZE MONEY\s*([\s\S]*?)<sup>/i
        )
      ),
    resultStatus: runners.some((runner) => runner.finishingPosition != null)
      ? "posted"
      : "pending",
    replayUrl,
    photoFinishUrl,
    runners,
  };
}

function parseResultRaceLinks(html: string): TheDogsRaceLink[] {
  const links = new Map<number, TheDogsRaceLink>();
  for (const match of html.matchAll(/<a class="race-header" href="([^"]+)">([\s\S]*?)<\/a>/gi)) {
    const href = match[1];
    const body = match[2] ?? "";
    if (!href || !body.includes("race-box--result")) continue;
    const raceNumber = extractRaceNumber(href);
    if (!raceNumber) continue;
    links.set(raceNumber, { href, raceNumber });
  }
  return [...links.values()].sort((a, b) => a.raceNumber - b.raceNumber);
}

function mergeResultRaces(meeting: LiveMeeting, resultRaces: LiveRace[]): LiveMeeting {
  if (resultRaces.length === 0) return meeting;

  const races = new Map(meeting.races.map((race) => [race.raceNumber, race]));
  for (const resultRace of resultRaces) {
    const existing = races.get(resultRace.raceNumber);
    races.set(resultRace.raceNumber, {
      ...existing,
      ...resultRace,
      distance: resultRace.distance || existing?.distance || 0,
      grade: resultRace.grade ?? existing?.grade,
      prizeMoney: resultRace.prizeMoney ?? existing?.prizeMoney,
      runners: resultRace.runners,
    });
  }

  return {
    ...meeting,
    races: [...races.values()].sort((a, b) => a.raceNumber - b.raceNumber),
  };
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
    const raceNumber = extractRaceNumber(href);
    const raceTime = firstMatch(attrs, /data-race-box="([^"]+)"/i);
    const parsed = raceTime ? validIso(raceTime) : undefined;
    if (raceNumber && parsed) times.set(raceNumber, parsed);
  }
  return times;
}

function splitRaceSections(html: string) {
  const starts = [...html.matchAll(/<a class="race-header" href="([^"]+)">/gi)]
    .map((match) => ({ index: match.index, href: match[1] }))
    .filter(
      (match): match is { index: number; href: string } =>
        match.index != null && extractRaceNumber(match.href) != null
    );

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
  const raceNumber = extractRaceNumber(section.href);
  if (!raceNumber) return null;

  const gradeAndDistance = cleanHtml(
    firstMatch(
      section.html,
      /<div class="race-header__info__grade">([\s\S]*?)<\/div>/i
    )
  );
  const distance = Number(gradeAndDistance.match(/(\d{3,4})m\b/i)?.[1] ?? 0);

  return {
    sourceId: section.href,
    sourceRawJson: JSON.stringify({
      href: section.href,
      resultSummary: parseResultOrder(section.html),
    }),
    raceNumber,
    name: cleanHtml(
      firstMatch(
        section.html,
        /<div class="race-header__info__name[^"]*">([\s\S]*?)<\/div>/i
      )
    ),
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
    resultStatus: section.html.includes("race-box--result") ? "posted" : "pending",
    runners: parseRunners(section.html),
  };
}

function parseRunners(section: string): LiveRunner[] {
  return [...section.matchAll(/<tr\b[^>]*class="[^"]*\brace-runner\b[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match, index) => parseRunner(match[1] ?? "", index))
    .filter((runner): runner is LiveRunner => runner != null);
}

function parseRunner(row: string, index: number): LiveRunner | null {
  const boxNumber = Number(firstMatch(row, /sprite-svg name="rug_(\d+)"/i)) || index + 1;
  const dog = parseDog(row);
  const rawDogName = dog.name;
  const dogName = rawDogName.replace(/\s*\(SCR\)\s*$/i, "").trim();
  if (!dogName || /vacant box/i.test(dogName)) return null;

  const colourSex = cleanHtml(
    firstMatch(
      row,
      /<div class="race-runners__name__dog__color__sex">([\s\S]*?)<\/div>/i
    )
  );
  const finish = parseOrdinal(
    firstMatch(row, /<td class="race-runners__finish-position">([\s\S]*?)<\/td>/i)
  );
  const sectionals = parseSectionals(row);
  const runningTime = parseNumber(
    firstMatch(row, /<td class="race-runners__time">([\s\S]*?)<\/td>/i)
  );
  const raceTrait = cleanHtml(
    firstMatch(row, /<td class="race-runners__track-sa-trait">([\s\S]*?)<\/td>/i)
  );
  const runnerGrade = cleanHtml(
    firstMatch(row, /<td class="race-runners__grade">([\s\S]*?)<\/td>/i)
  );
  const trainer = parseTrainer(row);
  const margin =
    finish === 1
      ? 0
      : parseNumber(firstMatch(row, /<td class="race-runners__margin">([\s\S]*?)<\/td>/i));

  return {
    sourceId: dog.sourceId ? `dog:${dog.sourceId}:box:${boxNumber}` : undefined,
    sourceRawJson: JSON.stringify({
      dogId: dog.sourceId,
      dogProfileUrl: dog.url,
      dogDisplayTime: parseNumber(
        firstMatch(row, /<span class="race-runners__name__time">([\s\S]*?)<\/span>/i)
      ),
      boxNumber,
      finish,
      runningTime,
      margin,
      sectionals,
      raceTrait: raceTrait || undefined,
      grade: runnerGrade || undefined,
      trainerId: trainer.sourceId,
      trainerProfileUrl: trainer.url,
    }),
    boxNumber,
    dog: {
      name: dogName,
      earBrand: dog.sourceId ? `thedogs:${dog.sourceId}` : undefined,
      colour: parseColour(colourSex),
      sex: parseSex(colourSex),
    },
    trainerName:
      trainer.name ||
      cleanHtml(firstMatch(row, /T:\s*([^<]+)/i)) ||
      undefined,
    weight: parseNumber(firstMatch(row, /<td class="race-runners__weight">([\s\S]*?)<\/td>/i)),
    startingPrice: parseMoney(
      firstMatch(row, /<td class="race-runners__starting-price">([\s\S]*?)<\/td>/i)
    ),
    scratched: /\(SCR\)|scratched/i.test(row),
    finishingPosition: finish,
    runningTime,
    margin,
    splitTime: sectionals[0],
    sectionals: sectionals.length > 0 ? JSON.stringify(sectionals) : undefined,
  };
}

function parseDog(row: string) {
  const dogLink = row.match(/<a\b[^>]*href="\/dogs\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  const body = dogLink?.[2] ?? "";
  const name =
    cleanHtml(firstMatch(body, /<div class="race-runners__name__dog">([\s\S]*?)<\/div>/i)) ||
    cleanHtml(body) ||
    cleanHtml(firstMatch(row, /<div class="race-runners__name__dog">([\s\S]*?)<\/div>/i));

  return {
    name,
    sourceId: dogLink?.[1],
    url: dogLink?.[1] ? firstMatch(dogLink[0] ?? "", /href="([^"]+)"/i) : undefined,
  };
}

function parseTrainer(row: string) {
  const link = row.match(/<a\b[^>]*href="\/trainers\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  if (link) {
    return {
      name: cleanHtml(link[2]).replace(/^T:\s*/i, ""),
      sourceId: link[1],
      url: firstMatch(link[0] ?? "", /href="([^"]+)"/i) || undefined,
    };
  }

  return {
    name: cleanHtml(
      firstMatch(row, /<td class="[^"]*\brace-runners__trainer\b[^"]*">([\s\S]*?)<\/td>/i)
    ),
    sourceId: undefined,
    url: undefined,
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
  const minute = Math.min(Math.max(raceNumber, 1), 59);
  return new Date(
    `${date}T12:${minute.toString().padStart(2, "0")}:00+10:00`
  ).toISOString();
}

function extractRaceNumber(href: string) {
  const parsed = Number(
    href.match(/\/racing\/[^/]+\/\d{4}-\d{2}-\d{2}\/(\d+)\//)?.[1] ??
      href.match(/\/(\d+)\//)?.[1]
  );
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 30 ? parsed : undefined;
}

function parseRaceTimestamp(html: string) {
  const raw = firstMatch(html, /<formatted-time[^>]*data-timestamp="(\d+)"/i);
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return validIso(seconds * 1000);
}

function validIso(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseReplayUrl(html: string) {
  return (
    firstMatch(html, /<a[^>]+data-turbolinks-action="video"[^>]+href="([^"]+)"/i) ||
    undefined
  );
}

function parsePhotoFinishUrl(html: string) {
  return (
    firstMatch(html, /<a[^>]+race-header__media__item--photo[^>]+href="([^"]+)"/i) ||
    firstMatch(html, /<a class="button button--size-small" href="([^"]+)"[^>]*>\s*<sprite-svg name="icon_camera"/i) ||
    undefined
  );
}

function parseWeatherIcon(html: string) {
  const name = firstMatch(
    html,
    /<div class="race-header__info__time">[\s\S]*?<sprite-svg[^>]+name="(weather_[^"]+)"/i
  );
  return name ? name.replace(/^weather_/i, "") : undefined;
}

function parseTrackRecord(html: string) {
  return parseNumber(
    firstMatch(html, /<div class="race-header__record">[\s\S]*?<th>TRACK RECORD<\/th><th>([\s\S]*?)<\/th>/i)
  );
}

function parsePrizePlaces(html: string) {
  const raw = cleanHtml(
    firstMatch(html, /<div class="race-header__prize__places">([\s\S]*?)<\/div>/i)
  );
  if (!raw) return undefined;

  const amounts = raw
    .split(/\s*-\s*/)
    .map((value) => parseMoney(value))
    .filter((value): value is number => value != null);
  return {
    text: raw,
    amounts: amounts.length > 0 ? amounts : undefined,
  };
}

function parseActiveResultOrder(html: string) {
  const header = firstMatch(
    html,
    /<div class="race-header race-header--result">([\s\S]*?)<div class="race-header__info">/i
  );
  const order = [...header.matchAll(/<div class="race-box__caption">([\s\S]*?)<\/div>/gi)]
    .flatMap((match) =>
      [...(match[1] ?? "").matchAll(/<span>(\d+)<\/span>/g)].map((span) =>
        Number(span[1])
      )
    )
    .filter((box) => Number.isFinite(box));
  return order.length > 0 ? order : undefined;
}

function parseResultOrder(html: string) {
  const order = [...html.matchAll(/<div class="race-box__caption">([\s\S]*?)<\/div>/gi)]
    .flatMap((match) =>
      [...(match[1] ?? "").matchAll(/<span>(\d+)<\/span>/g)].map((span) =>
        Number(span[1])
      )
    )
    .filter((box) => Number.isFinite(box));
  return order.length > 0 ? order : undefined;
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

function parseNumber(value?: string) {
  const cleaned = cleanHtml(value).replace(/[$,]/g, "");
  if (!cleaned || /^[-—]+$/.test(cleaned)) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseSectionals(row: string) {
  return [...row.matchAll(/<td class="race-runners__sectional">([\s\S]*?)<\/td>/gi)]
    .map((match) => parseNumber(match[1]))
    .filter((value): value is number => value != null);
}

function parseOrdinal(value?: string) {
  const parsed = Number(cleanHtml(value).match(/\d+/)?.[0] ?? "");
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
