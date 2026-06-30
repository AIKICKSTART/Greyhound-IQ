/**
 * Backfill historical race results from the public The Dogs racing archive.
 *
 * Examples:
 *   npm run backfill:thedogs -- --date 2025-06-30
 *   npm run backfill:thedogs -- --from 2025-01-01 --to 2025-01-31 --max-days 7
 *   npm run backfill:thedogs -- --from 2007-01-01 --to 2007-12-31 --full
 */
import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../src/lib/db";
import { syncLiveMeetings, type SyncCounts } from "../src/lib/live/sync";
import { TheDogsProvider } from "../src/lib/live/thedogs";

loadEnvConfig(process.cwd());

const DEFAULT_FROM = process.env.THEDOGS_BACKFILL_FROM ?? "2006-08-01";
const DEFAULT_PROGRESS = ".backfill/thedogs-history-progress.jsonl";

type Options = {
  from: string;
  to: string;
  full: boolean;
  maxDays: number;
  pauseMs: number;
  progressFile: string;
  resume: boolean;
  direction: "forward" | "backward";
  continueOnError: boolean;
  maxErrors: number;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const allDates = enumerateDates(options.from, options.to, options.direction);
  const completed = options.resume
    ? await readCompletedDates(options.progressFile)
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
        full: options.full,
        continueOnError: options.continueOnError,
        maxErrors: options.maxErrors,
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
    const startedAt = Date.now();
    try {
      const meetings = await provider.fetchResultsForDate(date);
      const counts = await syncLiveMeetings(meetings, provider.name);
      await appendProgress(options.progressFile, {
        date,
        ok: true,
        durationMs: Date.now() - startedAt,
        ...counts,
      });
      console.log(
        `[backfill:thedogs] ${date} ok: ${formatCounts(counts)} in ${Date.now() - startedAt}ms`
      );
    } catch (err) {
      await appendProgress(options.progressFile, {
        date,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[backfill:thedogs] ${date} failed`, err);
      errorCount += 1;
      process.exitCode = 1;
      if (!options.continueOnError || errorCount >= options.maxErrors) break;
    }

    if (options.pauseMs > 0) await sleep(options.pauseMs);
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
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 50),
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

async function readCompletedDates(progressFile: string) {
  const completed = new Set<string>();
  try {
    const body = await readFile(progressFile, "utf8");
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as { date?: string; ok?: boolean };
      if (record.date && record.ok) completed.add(record.date);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return completed;
}

async function appendProgress(progressFile: string, record: Record<string, unknown>) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await appendFile(progressFile, `${JSON.stringify({ ...record, loggedAt: new Date().toISOString() })}\n`);
}

function formatCounts(counts: SyncCounts) {
  return `${counts.meetings} meetings, ${counts.races} races, ${counts.runners} runners, ${counts.results} results`;
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
