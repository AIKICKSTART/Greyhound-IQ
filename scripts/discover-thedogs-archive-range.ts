/**
 * Discover which dates are exposed by The Dogs public racing index.
 *
 * This only fetches date index pages and parses meeting links; it does not
 * fetch race pages, write raw archives, or touch the database.
 *
 * Examples:
 *   npm run discover:thedogs:archive-range
 *   npm run discover:thedogs:archive-range -- --from 2006-07-01 --to 2006-08-05 --output-file .backfill/reports/thedogs-archive-range-latest.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseMeetingLinks } from "../src/lib/live/thedogs";

const DEFAULT_FROM = "2006-07-01";
const DEFAULT_TO = "2006-08-10";
const THEDOGS_BASE = process.env.THEDOGS_BASE_URL ?? "https://www.thedogs.com.au";
const FETCH_TIMEOUT_MS = positiveInt(process.env.THEDOGS_FETCH_TIMEOUT_MS, 45_000);
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type Options = {
  from: string;
  to: string;
  pauseMs: number;
  compact: boolean;
  outputFile?: string;
};

type DateProbe = {
  date: string;
  status?: number;
  ok: boolean;
  meetings: number;
  sampleTracks: string[];
  durationMs: number;
  error?: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const records: DateProbe[] = [];

  for (const date of enumerateDates(options.from, options.to)) {
    records.push(await probeDate(date));
    if (options.pauseMs > 0) await sleep(options.pauseMs);
  }

  const datesWithMeetings = records.filter((record) => record.meetings > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    source: "thedogs",
    baseUrl: THEDOGS_BASE,
    rangeFrom: options.from,
    rangeTo: options.to,
    datesScanned: records.length,
    successfulFetches: records.filter((record) => record.ok).length,
    failedFetches: records.filter((record) => !record.ok).length,
    datesWithMeetings: datesWithMeetings.length,
    firstDateWithMeetings: datesWithMeetings[0]?.date ?? null,
    lastDateWithMeetings: datesWithMeetings.at(-1)?.date ?? null,
    leadingEmptyDates:
      datesWithMeetings.length > 0
        ? records.findIndex((record) => record.date === datesWithMeetings[0]?.date)
        : records.length,
    records,
  };

  if (options.outputFile) {
    await mkdir(path.dirname(options.outputFile), { recursive: true });
    await writeFile(options.outputFile, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify(report, null, options.compact ? 0 : 2));
}

async function probeDate(date: string): Promise<DateProbe> {
  const startedAt = Date.now();
  try {
    const url = new URL("/racing", THEDOGS_BASE);
    url.searchParams.set("date", date);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": USER_AGENT,
      },
    });
    const html = await response.text();
    const links = response.ok
      ? parseMeetingLinks(html).filter((link) => link.date === date)
      : [];
    return {
      date,
      status: response.status,
      ok: response.ok,
      meetings: links.length,
      sampleTracks: links.slice(0, 5).map((link) => link.name),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      date,
      ok: false,
      meetings: 0,
      sampleTracks: [],
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseOptions(args: string[]): Options {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inlineValue != null) {
      values.set(rawKey, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(rawKey, next);
      index += 1;
    } else {
      values.set(rawKey, true);
    }
  }

  const from = stringOption(values, "from") ?? DEFAULT_FROM;
  const to = stringOption(values, "to") ?? DEFAULT_TO;
  assertDate(from, "--from");
  assertDate(to, "--to");
  if (dayValue(from) > dayValue(to)) throw new Error("--from must be before or equal to --to");

  return {
    from,
    to,
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 250),
    compact: values.has("compact"),
    outputFile: stringOption(values, "output-file"),
  };
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = [];
  for (let cursor = dayValue(from); cursor <= dayValue(to); cursor += 86_400_000) {
    dates.push(formatDate(cursor));
  }
  return dates;
}

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(dayValue(value))) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function dayValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDate(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("[discover:thedogs:archive-range] failed:", error);
  process.exitCode = 1;
});
