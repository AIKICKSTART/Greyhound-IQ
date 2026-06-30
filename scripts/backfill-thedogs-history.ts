/**
 * Backfill historical race results from the public The Dogs racing archive.
 *
 * Examples:
 *   npm run backfill:thedogs -- --date 2025-06-30
 *   npm run backfill:thedogs -- --from 2025-01-01 --to 2025-01-31 --max-days 7
 *   npm run backfill:thedogs -- --from 2007-01-01 --to 2007-12-31 --full
 */
import { mkdir, readFile, appendFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../src/lib/db";
import { syncLiveMeetings, type SyncCounts } from "../src/lib/live/sync";
import type { LiveMeeting } from "../src/lib/live/provider";
import { TheDogsProvider } from "../src/lib/live/thedogs";

loadEnvConfig(process.cwd());

const DEFAULT_FROM = process.env.THEDOGS_BACKFILL_FROM ?? "2006-08-01";
const DEFAULT_PROGRESS = ".backfill/thedogs-history-progress.jsonl";
const DB_UNAVAILABLE_EXIT_CODE = 75;

type Options = {
  from: string;
  to: string;
  full: boolean;
  maxDays: number;
  pauseMs: number;
  progressFile: string;
  resume: boolean;
  globalResume: boolean;
  direction: "forward" | "backward";
  continueOnError: boolean;
  maxErrors: number;
  retryAttempts: number;
  retryDelayMs: number;
  stopOnDbError: boolean;
  rawOutputDir?: string;
  fetchOnly: boolean;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const allDates = enumerateDates(options.from, options.to, options.direction);
  const completed = options.resume
    ? await readCompletedDates(
        options.progressFile,
        options.globalResume,
        options.fetchOnly
      )
    : new Set<string>();
  const pending = allDates.filter((date) => !completed.has(date));
  const selected = options.full ? pending : pending.slice(0, options.maxDays);

  console.log(
    JSON.stringify(
      {
        from: options.from,
        to: options.to,
        direction: options.direction,
        totalDates: allDates.length,
        completedDates: completed.size,
        pendingDates: pending.length,
        selectedDates: selected.length,
        progressFile: options.progressFile,
        globalResume: options.globalResume,
        full: options.full,
        continueOnError: options.continueOnError,
        maxErrors: options.maxErrors,
        retryAttempts: options.retryAttempts,
        retryDelayMs: options.retryDelayMs,
        stopOnDbError: options.stopOnDbError,
        rawOutputDir: options.rawOutputDir,
        fetchOnly: options.fetchOnly,
      },
      null,
      2
    )
  );

  if (!options.full && pending.length > selected.length) {
    console.log(
      `[backfill:thedogs] Capped to ${selected.length} day(s). Pass --full or raise --max-days to continue more dates.`
    );
  }

  const provider = new TheDogsProvider();
  let errorCount = 0;
  for (const date of selected) {
    const result = await backfillDateWithRetries(date, provider, options);
    if (!result.ok) {
      const err = result.error;
      await appendProgress(options.progressFile, {
        date,
        ok: false,
        durationMs: result.durationMs,
        attempts: result.attempts,
        rawPath: result.rawPath,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[backfill:thedogs] ${date} failed`, err);
      errorCount += 1;
      const dbUnavailable = isDatabaseConnectivityError(err);
      process.exitCode =
        options.stopOnDbError && dbUnavailable ? DB_UNAVAILABLE_EXIT_CODE : 1;
      if (
        (options.stopOnDbError && dbUnavailable) ||
        !options.continueOnError ||
        errorCount >= options.maxErrors
      ) {
        break;
      }
    }

    if (options.pauseMs > 0) await sleep(options.pauseMs);
  }
}

async function backfillDateWithRetries(
  date: string,
  provider: TheDogsProvider,
  options: Options
) {
  const startedAt = Date.now();
  const maxAttempts = options.retryAttempts + 1;
  let lastError: unknown;
  let lastRawPath: string | undefined;
  let attemptsUsed = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const meetings = await provider.fetchResultsForDate(date);
      const rawPath = options.rawOutputDir
        ? await writeRawArchive(date, meetings, options.rawOutputDir)
        : undefined;
      lastRawPath = rawPath;
      if (options.fetchOnly) {
        const counts = countsFromMeetings(meetings);
        await appendProgress(options.progressFile, {
          date,
          ok: true,
          rawOnly: true,
          rawPath,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
          ...counts,
        });
        console.log(
          `[backfill:thedogs] ${date} raw ok: ${formatCounts(counts)} in ${Date.now() - startedAt}ms (attempt ${attempt}/${maxAttempts})`
        );
        return { ok: true as const };
      }
      const counts = await syncLiveMeetings(meetings, provider.name);
      await appendProgress(options.progressFile, {
        date,
        ok: true,
        rawPath,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
        ...counts,
      });
      console.log(
        `[backfill:thedogs] ${date} ok: ${formatCounts(counts)} in ${Date.now() - startedAt}ms (attempt ${attempt}/${maxAttempts})`
      );
      return { ok: true as const };
    } catch (err) {
      lastError = err;
      if (options.stopOnDbError && isDatabaseConnectivityError(err)) break;
      if (attempt >= maxAttempts) break;
      console.warn(
        `[backfill:thedogs] ${date} attempt ${attempt}/${maxAttempts} failed; retrying in ${options.retryDelayMs}ms`,
        err
      );
      if (options.retryDelayMs > 0) await sleep(options.retryDelayMs);
    }
  }
  return {
    ok: false as const,
    error: lastError,
    rawPath: lastRawPath,
    attempts: attemptsUsed,
    durationMs: Date.now() - startedAt,
  };
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

  const singleDate = stringOption(values, "date");
  const from = singleDate ?? stringOption(values, "from") ?? DEFAULT_FROM;
  const to = singleDate ?? stringOption(values, "to") ?? formatSydneyDate(new Date());
  const direction = stringOption(values, "direction") === "backward" ? "backward" : "forward";

  assertDate(from, "--from");
  assertDate(to, "--to");
  if (dayValue(from) > dayValue(to)) throw new Error("--from must be before or equal to --to");

  return {
    from,
    to,
    direction,
    full: values.has("full"),
    maxDays: positiveInt(stringOption(values, "max-days"), 7),
    pauseMs: positiveInt(stringOption(values, "pause-ms"), 750),
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    resume: !values.has("no-resume"),
    globalResume: !values.has("no-global-resume"),
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 50),
    retryAttempts: positiveInt(stringOption(values, "retry-attempts"), 3),
    retryDelayMs: positiveInt(stringOption(values, "retry-delay-ms"), 10_000),
    stopOnDbError: values.has("stop-on-db-error"),
    rawOutputDir: stringOption(values, "raw-output-dir") ?? process.env.THEDOGS_RAW_ARCHIVE_DIR,
    fetchOnly: values.has("fetch-only"),
  };
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function enumerateDates(from: string, to: string, direction: "forward" | "backward") {
  const dates: string[] = [];
  for (let cursor = dayValue(from); cursor <= dayValue(to); cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return direction === "backward" ? dates.reverse() : dates;
}

async function readCompletedDates(
  progressFile: string,
  globalResume: boolean,
  includeRawOnly = false
) {
  const completed = new Set<string>();
  const files = new Set([progressFile]);
  if (globalResume) {
    try {
      for (const entry of await readdir(".backfill")) {
        if (/^thedogs-history.*\.jsonl$/i.test(entry)) {
          files.add(path.join(".backfill", entry));
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  for (const file of files) {
    await readCompletedDatesFromFile(file, completed, includeRawOnly);
  }

  return completed;
}

async function readCompletedDatesFromFile(
  progressFile: string,
  completed: Set<string>,
  includeRawOnly: boolean
) {
  try {
    const body = await readFile(progressFile, "utf8");
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as { date?: string; ok?: boolean; rawOnly?: boolean };
      if (record.date && record.ok && (includeRawOnly || !record.rawOnly)) {
        completed.add(record.date);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

async function appendProgress(progressFile: string, record: Record<string, unknown>) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await appendFile(progressFile, `${JSON.stringify({ ...record, loggedAt: new Date().toISOString() })}\n`);
}

function formatCounts(counts: SyncCounts) {
  return `${counts.meetings} meetings, ${counts.races} races, ${counts.runners} runners, ${counts.results} results`;
}

async function writeRawArchive(
  date: string,
  meetings: LiveMeeting[],
  rawOutputDir: string
) {
  const [year, month, day] = date.split("-");
  const file = path.join(rawOutputDir, year, month, `${day}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify({
      source: "thedogs",
      date,
      fetchedAt: new Date().toISOString(),
      meetings,
    })}\n`
  );
  return file;
}

function countsFromMeetings(meetings: LiveMeeting[]): SyncCounts {
  const races = meetings.flatMap((meeting) => meeting.races);
  const runners = races.flatMap((race) => race.runners);
  const results = runners.filter(
    (runner) =>
      runner.finishingPosition != null ||
      runner.runningTime != null ||
      runner.margin != null ||
      runner.splitTime != null
  ).length;
  return {
    meetings: meetings.length,
    races: races.length,
    runners: runners.length,
    results,
  };
}

function isDatabaseConnectivityError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /can't reach database server/i.test(message) ||
    /timed out fetching a new connection/i.test(message) ||
    /too many clients/i.test(message) ||
    /remaining connection slots/i.test(message) ||
    /\bEMAXCONNSESSION\b/i.test(message) ||
    /\bP1001\b/i.test(message) ||
    /\bP1002\b/i.test(message)
  );
}

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function dayValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatSydneyDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((err) => {
    console.error("[backfill:thedogs] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
