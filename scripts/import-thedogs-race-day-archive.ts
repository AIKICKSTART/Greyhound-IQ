/**
 * Store harvested The Dogs race-day raw JSON as one database row per date.
 *
 * This is intentionally lighter than normalized race replay. It preserves the
 * full source payload in Postgres while the row-level sync can be replayed later.
 */
import "./load-import-env";
import { randomUUID } from "node:crypto";
import { access, appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import type { LiveMeeting } from "../src/lib/live/provider";

const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_PROGRESS = ".backfill/thedogs-raw-archive-import-progress.jsonl";

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
  writeProgress: boolean;
  skipSchemaEnsure: boolean;
  continueOnError: boolean;
  maxErrors: number;
  dbMaxRetries: number;
  dbRetryBaseMs: number;
  shardIndex?: number;
  shardCount?: number;
};

type RawCandidate = {
  date: string;
  rawPath: string;
};

type RawArchive = {
  source?: string;
  date?: string;
  fetchedAt?: string;
  meetings?: LiveMeeting[];
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const completed = options.resume
    ? await readCompletedDates(options.progressFile)
    : new Set<string>();
  const candidates = await findCandidates(options);
  const shardCandidates = filterShard(candidates, options);
  const pending = shardCandidates.filter((candidate) => !completed.has(candidate.date));
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
        writeProgress: options.writeProgress,
        skipSchemaEnsure: options.skipSchemaEnsure,
        continueOnError: options.continueOnError,
        maxErrors: options.maxErrors,
        dbMaxRetries: options.dbMaxRetries,
        dbRetryBaseMs: options.dbRetryBaseMs,
        full: options.full,
        limit: options.limit,
        shardIndex: options.shardIndex ?? null,
        shardCount: options.shardCount ?? null,
        discoveredRawDates: candidates.length,
        shardRawDates: shardCandidates.length,
        completedImports: completed.size,
        pendingDates: pending.length,
        selectedDates: selected.length,
      },
      null,
      2
    )
  );

  if (!options.dryRun && selected.length > 0 && !options.skipSchemaEnsure) {
    await ensureRaceDayArchiveTable();
  }

  let errorCount = 0;
  for (const candidate of selected) {
    const startedAt = Date.now();
    try {
      const rawJson = await readFile(candidate.rawPath, "utf8");
      const archive = parseArchive(candidate, rawJson);
      const counts = countsFromMeetings(archive.meetings ?? []);
      let dbAttempts = 0;

      if (!options.dryRun) {
        const result = await saveArchiveWithRetry(candidate, archive, rawJson, counts, options);
        dbAttempts = result.attempts;
      }

      if (options.writeProgress) {
        await appendProgress(options.progressFile, {
          date: candidate.date,
          ok: true,
          imported: !options.dryRun,
          dryRun: options.dryRun,
          rawPath: candidate.rawPath,
          durationMs: Date.now() - startedAt,
          dbAttempts,
          ...counts,
        });
      }
      const retryText = dbAttempts > 1 ? ` after ${dbAttempts} db attempts` : "";
      console.log(
        `[import:thedogs:race-day-archive] ${candidate.date} ok: ${counts.meetings} meetings, ${counts.races} races, ${counts.runners} runners in ${Date.now() - startedAt}ms${retryText}`
      );
    } catch (err) {
      if (options.writeProgress) {
        await appendProgress(options.progressFile, {
          date: candidate.date,
          ok: false,
          imported: false,
          dryRun: options.dryRun,
          rawPath: candidate.rawPath,
          durationMs: Date.now() - startedAt,
          retryable: isRetryableImportError(err),
          error: err instanceof Error ? err.message : String(err),
        });
      }
      errorCount += 1;
      if (options.continueOnError && errorCount < options.maxErrors) {
        console.error(
          `[import:thedogs:race-day-archive] ${candidate.date} failed; continuing (${errorCount}/${options.maxErrors})`,
          err
        );
        continue;
      }
      throw err;
    }
  }
}

async function ensureRaceDayArchiveTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "RaceDayArchive" (
      "id" TEXT NOT NULL,
      "sourceProvider" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "fetchedAt" TIMESTAMP(3),
      "rawPath" TEXT,
      "meetings" INTEGER NOT NULL DEFAULT 0,
      "races" INTEGER NOT NULL DEFAULT 0,
      "runners" INTEGER NOT NULL DEFAULT 0,
      "results" INTEGER NOT NULL DEFAULT 0,
      "dogs" INTEGER NOT NULL DEFAULT 0,
      "trainers" INTEGER NOT NULL DEFAULT 0,
      "rawJson" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RaceDayArchive_pkey" PRIMARY KEY ("id")
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "RaceDayArchive_date_idx"
    ON "RaceDayArchive"("date")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "RaceDayArchive_sourceProvider_idx"
    ON "RaceDayArchive"("sourceProvider")
  `;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "RaceDayArchive_sourceProvider_date_key"
    ON "RaceDayArchive"("sourceProvider", "date")
  `;
}

async function saveArchiveWithRetry(
  candidate: RawCandidate,
  archive: RawArchive,
  rawJson: string,
  counts: ReturnType<typeof countsFromMeetings>,
  options: Options
) {
  let retry = 0;
  for (;;) {
    try {
      await saveArchive(candidate, archive, rawJson, counts);
      return { attempts: retry + 1 };
    } catch (err) {
      if (!isRetryableImportError(err) || retry >= options.dbMaxRetries) {
        throw err;
      }
      retry += 1;
      const delayMs = retryDelayMs(retry, options.dbRetryBaseMs);
      console.error(
        `[import:thedogs:race-day-archive] ${candidate.date} transient DB write failed; retrying ${retry}/${options.dbMaxRetries} in ${delayMs}ms: ${formatError(err)}`
      );
      await sleep(delayMs);
    }
  }
}

async function saveArchive(
  candidate: RawCandidate,
  archive: RawArchive,
  rawJson: string,
  counts: ReturnType<typeof countsFromMeetings>
) {
  const sourceProvider = archive.source || "thedogs";
  await prisma.$executeRaw`
    INSERT INTO "RaceDayArchive" (
      "id",
      "sourceProvider",
      "date",
      "fetchedAt",
      "rawPath",
      "meetings",
      "races",
      "runners",
      "results",
      "dogs",
      "trainers",
      "rawJson",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${sourceProvider},
      ${dateFromKey(candidate.date)},
      ${archive.fetchedAt ? new Date(archive.fetchedAt) : null},
      ${candidate.rawPath},
      ${counts.meetings},
      ${counts.races},
      ${counts.runners},
      ${counts.results},
      ${counts.dogs},
      ${counts.trainers},
      ${rawJson},
      NOW(),
      NOW()
    )
    ON CONFLICT ("sourceProvider", "date") DO UPDATE SET
      "fetchedAt" = EXCLUDED."fetchedAt",
      "rawPath" = EXCLUDED."rawPath",
      "meetings" = EXCLUDED."meetings",
      "races" = EXCLUDED."races",
      "runners" = EXCLUDED."runners",
      "results" = EXCLUDED."results",
      "dogs" = EXCLUDED."dogs",
      "trainers" = EXCLUDED."trainers",
      "rawJson" = EXCLUDED."rawJson",
      "updatedAt" = NOW()
  `;
}

function parseArchive(candidate: RawCandidate, rawJson: string): RawArchive {
  const archive = JSON.parse(rawJson) as RawArchive;
  if (archive.source && archive.source !== "thedogs") {
    throw new Error(`${candidate.rawPath} has unsupported source=${archive.source}`);
  }
  if (archive.date && archive.date !== candidate.date) {
    throw new Error(
      `${candidate.rawPath} date mismatch: expected ${candidate.date}, got ${archive.date}`
    );
  }
  if (!Array.isArray(archive.meetings)) {
    throw new Error(`${candidate.rawPath} is missing meetings[]`);
  }
  return archive;
}

function countsFromMeetings(meetings: LiveMeeting[]) {
  const races = meetings.flatMap((meeting) => meeting.races);
  const runners = races.flatMap((race) => race.runners);
  const dogs = new Set(runners.map((runner) => runner.dog?.name).filter(Boolean));
  const trainers = new Set(runners.map((runner) => runner.trainerName).filter(Boolean));
  return {
    meetings: meetings.length,
    races: races.length,
    runners: runners.length,
    results: runners.filter((runner) => runner.finishingPosition != null).length,
    dogs: dogs.size,
    trainers: trainers.size,
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
    for (const date of enumerateDates(from, to)) {
      const rawPath = rawPathForDate(options.rawDir, date);
      if (await fileExists(rawPath)) candidates.push({ date, rawPath });
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

async function readCompletedDates(progressFile: string) {
  const completed = new Set<string>();
  const progressFiles = await findResumeProgressFiles(progressFile);
  for (const file of progressFiles) {
    await readCompletedDatesFromFile(file, completed);
  }
  return completed;
}

async function readCompletedDatesFromFile(progressFile: string, completed: Set<string>) {
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
}

async function findResumeProgressFiles(progressFile: string) {
  const files = new Set<string>();
  if (await fileExists(progressFile)) files.add(progressFile);

  const dir = path.dirname(progressFile);
  const name = path.basename(progressFile);
  if (!/^thedogs-raw-archive-import.*\.jsonl$/i.test(name)) return [...files].sort();

  try {
    for (const entry of await readdir(dir)) {
      if (/^thedogs-raw-archive-import.*\.jsonl$/i.test(entry)) {
        files.add(path.join(dir, entry));
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  return [...files].sort();
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
  const shardIndex = optionalPositiveInt(stringOption(values, "shard-index"));
  const shardCount = optionalPositiveInt(stringOption(values, "shard-count"));
  if (date && (from || to)) throw new Error("Use --date or --from/--to, not both.");
  if (date) assertDate(date, "--date");
  if (from) assertDate(from, "--from");
  if (to) assertDate(to, "--to");
  if ((shardIndex == null) !== (shardCount == null)) {
    throw new Error("--shard-index and --shard-count must be provided together");
  }
  if (shardIndex != null && shardCount != null && shardIndex > shardCount) {
    throw new Error("--shard-index must be less than or equal to --shard-count");
  }
  return {
    date,
    from,
    to,
    rawDir: stringOption(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    full: values.has("full"),
    limit: positiveInt(stringOption(values, "limit"), 25),
    resume: !values.has("no-resume"),
    dryRun: values.has("dry-run"),
    writeProgress: !values.has("no-progress"),
    skipSchemaEnsure: values.has("skip-schema-ensure"),
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 100),
    dbMaxRetries: nonNegativeInt(stringOption(values, "db-max-retries"), 6),
    dbRetryBaseMs: positiveInt(stringOption(values, "db-retry-base-ms"), 1_500),
    shardIndex,
    shardCount,
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

function dateFromRawPath(rootDir: string, rawPath: string) {
  const relative = path.relative(rootDir, rawPath);
  const parts = relative.split(path.sep);
  if (parts.length !== 3) return null;
  const [year, month, fileName] = parts;
  const day = fileName.replace(/\.json$/i, "");
  const date = `${year}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = [];
  for (let cursor = dayValue(from); cursor <= dayValue(to); cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
}

function dateFromKey(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
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

function optionalPositiveInt(value: string | undefined) {
  if (value == null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function filterShard(candidates: RawCandidate[], options: Options) {
  if (options.date || options.shardIndex == null || options.shardCount == null) {
    return candidates;
  }
  return candidates.filter(
    (candidate) => shardIndexFor(candidate.date, options.shardCount as number) === options.shardIndex
  );
}

function shardIndexFor(date: string, shardCount: number) {
  const dayNumber = Math.trunc(dayValue(date) / 86_400_000);
  return (dayNumber % shardCount) + 1;
}

function dayValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isRetryableImportError(error: unknown) {
  const text = formatError(error);
  return /P2024|connection pool|Timed out fetching a new connection|statement timeout|57014|40P01|40001|EMAXCONNSESSION|max clients reached|server has closed the connection|authentication did not complete|ETIMEDOUT|ECONNRESET|ECONNREFUSED|connection terminated|connection closed|can't reach database|timeout/i.test(
    text
  );
}

function retryDelayMs(retry: number, baseMs: number) {
  return Math.min(baseMs * 2 ** Math.max(retry - 1, 0), 30_000);
}

function formatError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((err) => {
    console.error("[import:thedogs:race-day-archive] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Preserve the original import result.
    }
  });
