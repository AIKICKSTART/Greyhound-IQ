/**
 * Replay raw The Dogs archive files into the application database.
 *
 * Examples:
 *   npm run import:thedogs:raw -- --date 2006-11-18 --dry-run
 *   npm run import:thedogs:raw -- --from 2006-11-18 --to 2006-11-30 --full --stop-on-db-error
 *   npm run import:thedogs:raw -- --full --raw-dir .backfill/thedogs-raw
 */
import { access, appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../src/lib/db";
import { syncLiveMeetings, type SyncCounts } from "../src/lib/live/sync";
import type { LiveMeeting } from "../src/lib/live/provider";

loadEnvConfig(process.cwd());

const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_PROGRESS = ".backfill/thedogs-raw-import-progress.jsonl";
const DB_UNAVAILABLE_EXIT_CODE = 75;

type Options = {
  date?: string;
  from?: string;
  to?: string;
  rawDir: string;
  progressFile: string;
  full: boolean;
  limit: number;
  resume: boolean;
  dryRun: boolean;
  continueOnError: boolean;
  maxErrors: number;
  stopOnDbError: boolean;
  pauseMs: number;
  retryAttempts: number;
  retryDelayMs: number;
};

type RawArchive = {
  source: "thedogs";
  date: string;
  fetchedAt?: string;
  meetings: LiveMeeting[];
};

type RawCandidate = {
  date: string;
  rawPath: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const completed = options.resume && !options.dryRun
    ? await readImportedDates(options.progressFile)
    : new Set<string>();
  const candidates = await findCandidates(options);
  const pending = candidates.filter((candidate) => !completed.has(candidate.date));
  const selected = options.full ? pending : pending.slice(0, options.limit);

  console.log(
    JSON.stringify(
      {
        rawDir: options.rawDir,
        progressFile: options.progressFile,
        date: options.date ?? null,
        from: options.from ?? null,
        to: options.to ?? null,
        dryRun: options.dryRun,
        resume: options.resume,
        full: options.full,
        limit: options.limit,
        discoveredRawDates: candidates.length,
        completedImports: completed.size,
        pendingDates: pending.length,
        selectedDates: selected.length,
        continueOnError: options.continueOnError,
        maxErrors: options.maxErrors,
        stopOnDbError: options.stopOnDbError,
        pauseMs: options.pauseMs,
        retryAttempts: options.retryAttempts,
        retryDelayMs: options.retryDelayMs,
      },
      null,
      2
    )
  );

  if (!options.full && pending.length > selected.length) {
    console.log(
      `[import:thedogs:raw] Capped to ${selected.length} day(s). Pass --full or raise --limit to import more raw dates.`
    );
  }

  let errorCount = 0;
  for (const candidate of selected) {
    const result = await importRawCandidateWithRetries(candidate, options);
    if (!result.ok) {
      await appendProgress(options.progressFile, {
        date: candidate.date,
        ok: false,
        dryRun: options.dryRun,
        rawPath: candidate.rawPath,
        durationMs: result.durationMs,
        attempts: result.attempts,
        error: errorMessage(result.error),
      });
      console.error(`[import:thedogs:raw] ${candidate.date} failed`, result.error);

      errorCount += 1;
      const dbUnavailable = isDatabaseConnectivityError(result.error);
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

async function importRawCandidateWithRetries(
  candidate: RawCandidate,
  options: Options
) {
  const startedAt = Date.now();
  const maxAttempts = options.retryAttempts + 1;
  let lastError: unknown;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const archive = await readRawArchive(candidate);
      const counts = options.dryRun
        ? countsFromMeetings(archive.meetings)
        : await syncLiveMeetings(archive.meetings, archive.source);

      await appendProgress(options.progressFile, {
        date: candidate.date,
        ok: true,
        dryRun: options.dryRun,
        imported: !options.dryRun,
        rawPath: candidate.rawPath,
        fetchedAt: archive.fetchedAt ?? null,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
        ...counts,
      });
      console.log(
        `[import:thedogs:raw] ${candidate.date} ${options.dryRun ? "dry-run" : "import"} ok: ${formatCounts(counts)} in ${Date.now() - startedAt}ms (attempt ${attempt}/${maxAttempts})`
      );
      return { ok: true as const };
    } catch (err) {
      lastError = err;
      if (options.stopOnDbError && isDatabaseConnectivityError(err)) break;
      if (attempt >= maxAttempts) break;
      console.warn(
        `[import:thedogs:raw] ${candidate.date} attempt ${attempt}/${maxAttempts} failed; retrying in ${options.retryDelayMs}ms`,
        err
      );
      if (options.retryDelayMs > 0) await sleep(options.retryDelayMs);
    }
  }

  return {
    ok: false as const,
    error: lastError,
    attempts: attemptsUsed,
    durationMs: Date.now() - startedAt,
  };
}

async function readRawArchive(candidate: RawCandidate): Promise<RawArchive> {
  const raw = JSON.parse(await readFile(candidate.rawPath, "utf8")) as unknown;
  if (!isRecord(raw)) {
    throw new Error(`${candidate.rawPath} is not a JSON object`);
  }
  if (raw.source !== "thedogs") {
    throw new Error(`${candidate.rawPath} has unsupported source=${String(raw.source)}`);
  }
  if (raw.date !== candidate.date) {
    throw new Error(
      `${candidate.rawPath} date mismatch: expected ${candidate.date}, got ${String(raw.date)}`
    );
  }
  if (!Array.isArray(raw.meetings)) {
    throw new Error(`${candidate.rawPath} is missing meetings[]`);
  }
  return {
    source: "thedogs",
    date: candidate.date,
    fetchedAt: typeof raw.fetchedAt === "string" ? raw.fetchedAt : undefined,
    meetings: raw.meetings as LiveMeeting[],
  };
}

async function findCandidates(options: Options) {
  if (options.date) {
    const rawPath = rawPathForDate(options.rawDir, options.date);
    await assertFileExists(rawPath, `No raw archive exists for ${options.date}`);
    return [{ date: options.date, rawPath }];
  }

  if (options.from || options.to) {
    const from = options.from ?? options.to;
    const to = options.to ?? options.from;
    if (!from || !to) throw new Error("--from/--to range could not be resolved");
    const candidates: RawCandidate[] = [];
    const missing: string[] = [];
    for (const date of enumerateDates(from, to)) {
      const rawPath = rawPathForDate(options.rawDir, date);
      if (await fileExists(rawPath)) {
        candidates.push({ date, rawPath });
      } else {
        missing.push(date);
      }
    }
    if (candidates.length === 0) {
      throw new Error(
        `No raw archives found in ${options.rawDir} for ${from} to ${to}. First missing date: ${missing[0] ?? "n/a"}`
      );
    }
    if (missing.length > 0) {
      console.warn(
        `[import:thedogs:raw] Skipping ${missing.length} missing raw date(s); first missing ${missing[0]}.`
      );
    }
    return candidates;
  }

  const candidates = await scanRawArchives(options.rawDir);
  if (candidates.length === 0) {
    throw new Error(`No raw archive files found under ${options.rawDir}`);
  }
  return candidates;
}

async function scanRawArchives(rawDir: string) {
  const files: RawCandidate[] = [];
  await collectRawArchives(rawDir, rawDir, files);
  return files.sort((a, b) => a.date.localeCompare(b.date));
}

async function collectRawArchives(
  rootDir: string,
  currentDir: string,
  files: RawCandidate[]
) {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectRawArchives(rootDir, fullPath, files);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const date = dateFromRawPath(rootDir, fullPath);
    if (date) files.push({ date, rawPath: fullPath });
  }
}

function dateFromRawPath(rootDir: string, rawPath: string) {
  const relative = path.relative(rootDir, rawPath);
  const parts = relative.split(path.sep);
  if (parts.length !== 3) return null;
  const [year, month, fileName] = parts;
  const day = fileName.replace(/\.json$/i, "");
  const date = `${year}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

async function readImportedDates(progressFile: string) {
  const completed = new Set<string>();
  try {
    const body = await readFile(progressFile, "utf8");
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as {
        date?: string;
        ok?: boolean;
        imported?: boolean;
        dryRun?: boolean;
      };
      if (record.date && record.ok && record.imported && !record.dryRun) {
        completed.add(record.date);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return completed;
}

async function appendProgress(progressFile: string, record: Record<string, unknown>) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await appendFile(
    progressFile,
    `${JSON.stringify({ ...record, loggedAt: new Date().toISOString() })}\n`
  );
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  const date = stringOption(values, "date");
  const from = stringOption(values, "from");
  const to = stringOption(values, "to");
  if (date && (from || to)) throw new Error("Use --date or --from/--to, not both.");
  if (date) assertDate(date, "--date");
  if (from) assertDate(from, "--from");
  if (to) assertDate(to, "--to");
  if (from && to && dayValue(from) > dayValue(to)) {
    throw new Error("--from must be before or equal to --to");
  }

  return {
    date,
    from,
    to,
    rawDir: stringOption(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    full: values.has("full"),
    limit: positiveInt(
      stringOption(values, "limit") ?? stringOption(values, "max-days"),
      7
    ),
    resume: !values.has("no-resume"),
    dryRun: values.has("dry-run"),
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 50),
    stopOnDbError: values.has("stop-on-db-error"),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 0),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 0),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 10_000),
  };
}

function parseFlags(args: string[]) {
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
  return values;
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

async function assertFileExists(rawPath: string, message: string) {
  if (!(await fileExists(rawPath))) throw new Error(message);
}

async function fileExists(rawPath: string) {
  try {
    await access(rawPath);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

function rawPathForDate(rawDir: string, date: string) {
  const [year, month, day] = date.split("-");
  return path.join(rawDir, year, month, `${day}.json`);
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = [];
  for (let cursor = dayValue(from); cursor <= dayValue(to); cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
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

function formatCounts(counts: SyncCounts) {
  return `${counts.meetings} meetings, ${counts.races} races, ${counts.runners} runners, ${counts.results} results`;
}

function isDatabaseConnectivityError(err: unknown) {
  const message = errorMessage(err);
  const name =
    isRecord(err) && typeof err.name === "string" ? err.name : "";
  return (
    /can't reach database server/i.test(message) ||
    /timed out fetching a new connection/i.test(message) ||
    /too many clients/i.test(message) ||
    /remaining connection slots/i.test(message) ||
    /\bEMAXCONNSESSION\b/i.test(message) ||
    /\bP1001\b/i.test(message) ||
    /\bP1002\b/i.test(message) ||
    (/PrismaClientInitializationError/i.test(name) &&
      /database server/i.test(message))
  );
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
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

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function dayValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((err) => {
    console.error("[import:thedogs:raw] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Preserve the import error/exit code if the client never connected.
    }
  });
