const BLOCKED_ARCHIVE_KEYS = new Set([
  "startingprice",
  "startprice",
  "fixedwinprice",
  "totewinprice",
  "oddsfixedwin",
  "oddstotewin",
  "sp",
  "bsp",
  "suggestedbet",
  "bestbet",
  "betname",
  "dividend",
  "dividends",
]);

export type ProviderSnapshotKind = "meeting" | "race" | "runner";

const PROVIDER_SNAPSHOT_KEYS: Record<
  "thedogs" | "watchdog",
  Record<ProviderSnapshotKind, ReadonlySet<string>>
> = {
  thedogs: {
    meeting: new Set(["href", "date", "state", "source"]),
    race: new Set([
      "href",
      "resultPage",
      "replayUrl",
      "photoFinishUrl",
      "weather",
      "trackRecord",
      "prizePlaces",
      "resultSummary",
      "videoSourceId",
      "raceTimeSource",
    ]),
    runner: new Set([
      "dogId",
      "dogProfileUrl",
      "dogDisplayTime",
      "boxNumber",
      "finish",
      "runningTime",
      "margin",
      "sectionals",
      "raceTrait",
      "grade",
      "trainerId",
      "trainerProfileUrl",
    ]),
  },
  watchdog: {
    meeting: new Set([
      "id",
      "trackCode",
      "trackName",
      "slot",
      "statusCode",
      "meetingDate",
      "startTime",
      "countRaces",
      "isInterstate",
    ]),
    race: new Set([
      "id",
      "number",
      "raceNumber",
      "meetingId",
      "sponsor",
      "distance",
      "grade",
      "gradeCode",
      "firstPrize",
      "secondPrize",
      "thirdPrize",
      "fourthPrize",
      "fifthPrize",
      "sixthPrize",
      "seventhPrize",
      "eighthPrize",
      "videoId",
      "photoFinishUrl",
      "declaration",
      "startTime",
      "trackCode",
      "participantCount",
    ]),
    runner: new Set([
      "id",
      "raceId",
      "rugNumber",
      "box",
      "isLateScratching",
      "dogId",
      "dogName",
      "trainer",
      "trainerId",
      "owner",
      "last5",
      "averageFirstSplitSpeed",
      "resultPlace",
      "resultWeight",
      "resultMargin",
      "resultTime",
      "resultFirstSplitTime",
      "comments",
      "sireName",
      "sireId",
      "damName",
      "damId",
      "colour",
      "whelpedDate",
      "sex",
      "careerPrizeMoney",
      "pir",
      "runLine",
      "jumpStyle",
    ]),
  },
};

export function whitelistProviderSnapshot(
  raw: string | null | undefined,
  provider: string | null | undefined,
  kind: ProviderSnapshotKind
) {
  if (!raw || !provider) return null;
  const providerKey = provider.toLowerCase().includes("watchdog")
    ? "watchdog"
    : provider.toLowerCase().includes("thedogs")
      ? "thedogs"
      : null;
  if (!providerKey) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return null;
    }
    const allowed = PROVIDER_SNAPSHOT_KEYS[providerKey][kind];
    const snapshot = Object.fromEntries(
      Object.entries(parsed)
        .filter(([key]) => allowed.has(key) && !isBlockedArchiveKey(key))
        .map(([key, value]) => [key, sanitizeArchiveValue(value)])
    );
    return JSON.stringify(snapshot);
  } catch {
    return null;
  }
}

export function sanitizeArchiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeArchiveValue);
  if (value instanceof Date) return value;
  if (typeof value === "string") return sanitizeArchiveString(value);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isBlockedArchiveKey(key))
      .map(([key, entry]) => [key, sanitizeArchiveValue(entry)])
  );
}

export function sanitizeRawJson(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeArchiveValue(parsed);
    return JSON.stringify(sanitized) === JSON.stringify(parsed)
      ? raw
      : JSON.stringify(sanitized);
  } catch {
    return sanitizeProviderHtml(raw);
  }
}

export function sanitizeArchiveText(raw: string) {
  const newline = raw.endsWith("\r\n") ? "\r\n" : raw.endsWith("\n") ? "\n" : "";
  try {
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeArchiveValue(parsed);
    return JSON.stringify(sanitized) === JSON.stringify(parsed)
      ? raw
      : `${JSON.stringify(sanitized)}${newline}`;
  } catch {
    return sanitizeProviderHtml(raw);
  }
}

export function sanitizeProviderHtml(html: string) {
  return html
    .replace(
      /<(td|th)\b[^>]*class=["'][^"']*(?:starting[-_ ]?price|odds?)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    .replace(/<th\b[^>]*>\s*(?:SP|Starting Price|Odds?)\s*<\/th>/gi, "");
}

function sanitizeArchiveString(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      const sanitized = sanitizeArchiveValue(parsed);
      return JSON.stringify(sanitized) === JSON.stringify(parsed)
        ? value
        : JSON.stringify(sanitized);
    } catch {
      // Not JSON; continue with provider HTML cleanup.
    }
  }
  return sanitizeProviderHtml(value);
}

function isBlockedArchiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    BLOCKED_ARCHIVE_KEYS.has(normalized) ||
    normalized.includes("odds") ||
    normalized.includes("startingprice") ||
    normalized.includes("dividend") ||
    /^(?:fixed|tote).+price$/.test(normalized)
  );
}
