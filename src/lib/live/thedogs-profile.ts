import { sanitizeProviderHtml } from "./raw-sanitizer";
import { readBoundedTextResponse } from "../remote-response";
import { assertTheDogsLicensedUseApproved } from "./thedogs-access";

const THEDOGS_BASE =
  process.env.THEDOGS_BASE_URL ?? "https://www.thedogs.com.au";
const THEDOGS_ORIGIN = new URL(THEDOGS_BASE).origin;
const THEDOGS_FETCH_TIMEOUT_MS = Math.min(
  positiveInt(process.env.THEDOGS_FETCH_TIMEOUT_MS, 60_000),
  120_000,
);
const THEDOGS_PROFILE_RESPONSE_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedContentTypes: ["text/html", "application/xhtml+xml"],
} as const;
const THEDOGS_FULL_FORM_RESPONSE_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedContentTypes: [
    "text/html",
    "application/xhtml+xml",
    "application/json",
    "application/javascript",
    "text/javascript",
    "+json",
  ],
} as const;
const THEDOGS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type TheDogsProfileDogLink = {
  sourceId: string;
  name: string;
  url: string;
};

export type TheDogsDogProfileForm = {
  sourceId: string;
  raceUrl: string;
  date: Date;
  trackCode?: string;
  raceName?: string;
  finishText?: string;
  finishingPosition?: number;
  starters?: number;
  boxNumber?: number;
  weight?: number;
  distance?: number;
  grade?: string;
  runningTime?: number;
  winnerTime?: number;
  bestOfNightTime?: number;
  firstSectional?: number;
  margin?: number;
  winnerDogName?: string;
  winnerDogSourceId?: string;
  inRunningPositions?: string;
  hasVideo: boolean;
  sourceRawJson: string;
};

export type TheDogsDogProfile = {
  sourceProvider: "thedogs";
  sourceId: string;
  profileUrl: string;
  name: string;
  trainerName?: string;
  ownerName?: string;
  sire?: TheDogsProfileDogLink;
  dam?: TheDogsProfileDogLink;
  colour?: string;
  sex?: string;
  whelpDate?: Date;
  careerStarts?: number;
  careerWins?: number;
  careerSeconds?: number;
  careerThirds?: number;
  prizeMoney?: number;
  winPercentage?: number;
  placePercentage?: number;
  profileStatsJson: string;
  bestTimesJson: string;
  boxHistoryJson: string;
  distanceHistoryJson: string;
  profileSourceRawJson: string;
  formRows: TheDogsDogProfileForm[];
};

type FetchLike = typeof fetch;

export class TheDogsDogProfileProvider {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchProfile(pathOrUrl: string) {
    return this.getText(pathOrUrl, "profile");
  }

  async fetchFullForm(pathOrUrl: string) {
    return this.getText(
      pathOrUrl,
      "full-form",
      {
        accept: "application/json, text/javascript, */*; q=0.01",
        "X-Application-Layout": "injection",
      },
    );
  }

  private async getText(
    pathOrUrl: string,
    kind: "profile" | "full-form",
    extraHeaders: Record<string, string> = {},
  ) {
    assertTheDogsLicensedUseApproved();
    const url = new URL(pathOrUrl, THEDOGS_BASE);
    const pathPattern = kind === "profile"
      ? /^\/dogs\/\d+\/[^/?#]+\/?$/i
      : /^\/dogs\/\d+\/[^/?#]+\/full-form\/?$/i;
    const queryIsValid = kind === "profile"
      ? url.search === ""
      : url.search === "?page=1&profile=true";
    if (
      url.origin !== THEDOGS_ORIGIN ||
      url.username ||
      url.password ||
      url.hash ||
      !queryIsValid ||
      !pathPattern.test(url.pathname)
    ) {
      throw new Error("thedogs.profile_request_url_invalid");
    }
    const response = await this.fetchImpl(url, {
      redirect: "error",
      signal: AbortSignal.timeout(THEDOGS_FETCH_TIMEOUT_MS),
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

    if (response.url) {
      const finalUrl = new URL(response.url);
      if (
        finalUrl.origin !== url.origin ||
        finalUrl.pathname !== url.pathname ||
        finalUrl.search !== url.search ||
        finalUrl.hash
      ) {
        throw new Error("thedogs.profile_response_url_mismatch");
      }
    }

    return readBoundedTextResponse(
      response,
      kind === "profile"
        ? THEDOGS_PROFILE_RESPONSE_POLICY
        : THEDOGS_FULL_FORM_RESPONSE_POLICY,
    );
  }
}

export function buildTheDogsProfilePath(sourceId: string, name: string) {
  return `/dogs/${sourceId}/${slugify(name)}`;
}

export function parseTheDogsDogProfile(
  html: string,
  sourceId: string,
  profilePath: string,
  fullFormHtml = ""
): TheDogsDogProfile {
  const combinedFormHtml = `${html}\n${fullFormHtml}`;
  const sexDob = parseSexDob(html);
  const career = parseCareer(html);
  const winPlace = parseWinPlace(html);
  const formRows = uniqueBy(
    parseProfileFormRows(combinedFormHtml),
    (row) => row.sourceId
  );
  const profileStats = {
    tables: {
      bestTimes: parseTablesByClass(html, "best-track-times"),
      boxHistory: parseTablesByClass(html, "box-history"),
      distanceHistory: parseTablesByClass(html, "distance-history"),
    },
    fullFormRows: formRows.length,
    showMorePath: parseShowMorePath(html),
  };

  return {
    sourceProvider: "thedogs",
    sourceId,
    profileUrl: new URL(profilePath, THEDOGS_BASE).toString(),
    name: cleanHtml(
      firstMatch(html, /<div class="dog-statistics__name">([\s\S]*?)<\/div>/i)
    ),
    trainerName: parseLinkedValue(html, "Trainer")?.name,
    ownerName: parseLinkedValue(html, "Owner")?.name,
    sire: parseParentDog(html, "S", sourceId),
    dam: parseParentDog(html, "D", sourceId),
    colour: parseGeneralValue(html, "COLOUR"),
    sex: sexDob.sex,
    whelpDate: sexDob.whelpDate,
    ...career,
    prizeMoney: parseMoney(parseGeneralValue(html, "PRIZE MONEY")),
    winPercentage: winPlace.winPercentage,
    placePercentage: winPlace.placePercentage,
    profileStatsJson: JSON.stringify(profileStats),
    bestTimesJson: JSON.stringify(profileStats.tables.bestTimes),
    boxHistoryJson: JSON.stringify(profileStats.tables.boxHistory),
    distanceHistoryJson: JSON.stringify(profileStats.tables.distanceHistory),
    profileSourceRawJson: JSON.stringify({
      sourceId,
      profilePath,
      showMorePath: profileStats.showMorePath,
      generalInformation: parseGeneralInformation(html),
      fetchedFormRows: formRows.length,
    }),
    formRows,
  };
}

export function parseShowMorePath(html: string) {
  const raw = firstMatch(html, /data-runner-show-more="([^"]+)"/i);
  return raw ? decodeEntities(raw) : undefined;
}

function parseProfileFormRows(html: string): TheDogsDogProfileForm[] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => parseProfileFormRow(match[1] ?? ""))
    .filter((row): row is TheDogsDogProfileForm => row != null);
}

function parseProfileFormRow(row: string): TheDogsDogProfileForm | null {
  if (!row.includes("runner-form__finish-position")) return null;
  const raceUrl = normalizeTheDogsRaceUrl(decodeEntities(
    firstMatch(
      row,
      /<td class="runner-form__date">[\s\S]*?<a href="([^"]+)"/i
    )
  ));
  const timestamp = Number(
    firstMatch(row, /<formatted-time[^>]*data-timestamp="(\d+)"/i)
  );
  if (!raceUrl || !Number.isFinite(timestamp) || timestamp <= 0) return null;

  const timeCells = [
    ...row.matchAll(/<td class="runner-form__time">([\s\S]*?)<\/td>/gi),
  ].map((match) => parseNumber(match[1]));
  const finishText = cleanHtml(
    firstMatch(row, /<td class="runner-form__finish-position">([\s\S]*?)<\/td>/i)
  );
  const finish = parseFinish(finishText);
  const winner = parseWinner(row);

  return {
    sourceId: raceUrl,
    raceUrl,
    date: new Date(timestamp * 1000),
    trackCode: cleanHtml(
      firstMatch(row, /<td class="runner-form__track">([\s\S]*?)<\/td>/i)
    ),
    raceName: cleanHtml(
      firstMatch(row, /<td class="runner-form__date">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
    ),
    finishText: finishText || undefined,
    finishingPosition: finish.position,
    starters: finish.starters,
    boxNumber: parseBoxNumber(row),
    weight: parseNumber(
      firstMatch(row, /<td class="runner-form__weight">([\s\S]*?)<\/td>/i)
    ),
    distance: parseInteger(
      firstMatch(row, /<td class="runner-form__distance">([\s\S]*?)<\/td>/i)
    ),
    grade:
      cleanHtml(firstMatch(row, /<td class="runner-form__grade">([\s\S]*?)<\/td>/i)) ||
      undefined,
    runningTime: timeCells[0],
    winnerTime: timeCells[1],
    bestOfNightTime: timeCells[2],
    firstSectional: timeCells[3],
    margin: parseNumber(
      firstMatch(row, /<td class="runner-form__margin">([\s\S]*?)<\/td>/i)
    ),
    winnerDogName: winner.name,
    winnerDogSourceId: winner.sourceId,
    inRunningPositions:
      cleanHtml(
        firstMatch(row, /<td class="runner-form__in-running-places">([\s\S]*?)<\/td>/i)
      ) || undefined,
    hasVideo: /runner-form__video[\s\S]*?href="[^"]+"/i.test(row),
    sourceRawJson: JSON.stringify({
      raceUrl,
      finishText,
      timeCells,
      rowText: cleanHtml(sanitizeProviderHtml(row)),
    }),
  };
}

function parseLinkedValue(html: string, label: string) {
  const match = html.match(
    new RegExp(
      `<span class="dog__trainer__owner__heading">${label}:<\\/span>\\s*<span>\\s*<a href="([^"]+)">([^<]+)<\\/a>`,
      "i"
    )
  );
  if (!match) return undefined;
  return {
    url: decodeEntities(match[1] ?? ""),
    name: cleanHtml(match[2]),
  };
}

function parseParentDog(
  html: string,
  label: "S" | "D",
  subjectSourceId: string
) {
  const match = html.match(
    new RegExp(`${label}:\\s*<a href="\\/dogs\\/(\\d+)\\/([^"]+)">([^<]+)<\\/a>`, "i")
  );
  if (!match || match[1] === subjectSourceId) return undefined;
  return {
    sourceId: match[1] ?? "",
    url: `/dogs/${match[1]}/${match[2]}`,
    name: cleanHtml(match[3]),
  };
}

function normalizeTheDogsRaceUrl(value: string) {
  let url: URL;
  let providerOrigin: string;
  try {
    url = new URL(value, THEDOGS_BASE);
    providerOrigin = new URL(THEDOGS_BASE).origin;
  } catch {
    return undefined;
  }

  const parameters = [...url.searchParams.entries()];
  if (
    url.origin !== providerOrigin ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    parameters.length > 1 ||
    parameters.some(([key, parameterValue]) =>
      key !== "trial" || (parameterValue !== "true" && parameterValue !== "false")
    )
  ) {
    return undefined;
  }

  const match = url.pathname.match(
    /^\/racing\/([a-z0-9-]+)\/(\d{4}-\d{2}-\d{2})\/(\d+)(?:\/([a-z0-9-]+))?\/?$/i
  );
  if (!match) return undefined;

  const [, track, date, raceNumber, slug] = match;
  const path = slug
    ? `/racing/${track}/${date}/${raceNumber}/${slug}`
    : `/racing/${track}/${date}/${raceNumber}/`;
  return `${path}${url.search}`;
}

function parseGeneralInformation(html: string) {
  const values: Record<string, string> = {};
  for (const heading of [
    "BREEDING",
    "COLOUR",
    "SEX/DOB",
    "CAREER",
    "PRIZE MONEY",
    "WIN / PLC",
  ]) {
    const value = parseGeneralValue(html, heading);
    if (value) values[heading] = value;
  }
  return values;
}

function parseGeneralValue(html: string, heading: string) {
  const pattern = new RegExp(
    `<div class="cell--heading">${escapeRegExp(heading)}<\\/div>\\s*<div(?: class="cell--content")?>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  return cleanHtml(firstMatch(html, pattern)) || undefined;
}

function parseSexDob(html: string) {
  const section = firstMatch(
    html,
    /<div class="cell--heading">SEX\/DOB<\/div>\s*<div class="cell--content">([\s\S]*?)<\/div>/i
  );
  const rawSex = cleanHtml(firstMatch(section, /<span>([^<]+)<\/span>/i));
  const timestamp = Number(
    firstMatch(section, /<formatted-time[^>]*data-timestamp="(\d+)"/i)
  );
  return {
    sex:
      /^dog$/i.test(rawSex) ? "M" : /^bitch$/i.test(rawSex) ? "F" : undefined,
    whelpDate:
      Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000)
        : undefined,
  };
}

function parseCareer(html: string) {
  const career = parseGeneralValue(html, "CAREER") ?? "";
  const match = career.match(/(\d+)\s*:\s*(\d+)-(\d+)-(\d+)/);
  if (!match) return {};
  return {
    careerStarts: Number(match[1]),
    careerWins: Number(match[2]),
    careerSeconds: Number(match[3]),
    careerThirds: Number(match[4]),
  };
}

function parseWinPlace(html: string) {
  const value = parseGeneralValue(html, "WIN / PLC") ?? "";
  const match = value.match(/([\d.]+)%\s*\/\s*([\d.]+)%/);
  return {
    winPercentage: match ? Number(match[1]) : undefined,
    placePercentage: match ? Number(match[2]) : undefined,
  };
}

function parseWinner(row: string) {
  const match = row.match(
    /<td class="runner-form__winner">[\s\S]*?<a href="\/dogs\/(\d+)\/[^"]+">([\s\S]*?)<\/a>/i
  );
  if (!match) return {};
  return {
    sourceId: match[1],
    name: cleanHtml(match[2]),
  };
}

function parseTablesByClass(html: string, className: string) {
  return [...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)]
    .filter((match) => (match[1] ?? "").includes(className))
    .map((match) => parseTable(match[2] ?? ""));
}

function parseTable(tableHtml: string) {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...(row[1] ?? "").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(
      (cell) => cleanHtml(cell[1])
    )
  );
}

function parseFinish(value: string) {
  const match = value.match(/^(\d+)(?:st|nd|rd|th)?(?:\/(\d+))?/i);
  return {
    position: match ? Number(match[1]) : undefined,
    starters: match?.[2] ? Number(match[2]) : undefined,
  };
}

function parseBoxNumber(row: string) {
  return parseInteger(firstMatch(row, /sprite-svg name="rug_(\d+)"/i));
}

function parseMoney(value?: string) {
  const parsed = Number(cleanHtml(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNumber(value?: string) {
  const cleaned = cleanHtml(value).replace(/[$,]|kg/gi, "");
  if (!cleaned || /^N\/A$/i.test(cleaned) || /^[-—]+$/.test(cleaned)) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value?: string) {
  const parsed = Number.parseInt(cleanHtml(value), 10);
  return Number.isInteger(parsed) ? parsed : undefined;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueBy<T>(rows: T[], keyFor: (row: T) => string) {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(keyFor(row), row);
  return [...byKey.values()];
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
