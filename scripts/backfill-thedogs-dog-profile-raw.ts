/**
 * Archive rich The Dogs dog profile pages without touching the database.
 *
 * Examples:
 *   npm run backfill:thedogs:dog-profile-raw -- --limit 25
 *   npm run backfill:thedogs:dog-profile-raw -- --source-id 60626 --no-resume
 *   npm run backfill:thedogs:dog-profile-raw -- --limit 2000 --sort appearances
 *   npm run backfill:thedogs:dog-profile-raw -- --full --concurrency 2
 *   npm run backfill:thedogs:dog-profile-raw -- --full --shard-index 1 --shard-count 20
 */
import "./load-env";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LiveMeeting, LiveRunner } from "../src/lib/live/provider";
import {
  buildTheDogsProfilePath,
  parseShowMorePath,
  parseTheDogsDogProfile,
  TheDogsDogProfileProvider,
} from "../src/lib/live/thedogs-profile";

const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_OUTPUT_DIR = ".backfill/thedogs-dog-profiles-raw";
const DEFAULT_PROGRESS = ".backfill/thedogs-dog-profile-raw-progress.jsonl";

type Options = {
  rawDir: string;
  outputDir: string;
  progressFile: string;
  full: boolean;
  limit: number;
  concurrency: number;
  pauseMs: number;
  resume: boolean;
  continueOnError: boolean;
  maxErrors: number;
  retryAttempts: number;
  retryDelayMs: number;
  sort: "first-seen" | "appearances";
  sourceId?: string;
  from?: string;
  to?: string;
  shardIndex?: number;
  shardCount?: number;
  dryRun: boolean;
};

type RawCandidate = {
  date: string;
  rawPath: string;
};

type DogCandidate = {
  sourceId: string;
  name: string;
  profilePath: string;
  firstSeenDate: string;
  lastSeenDate: string;
  raceAppearances: number;
  names: Record<string, number>;
  profilePaths: Record<string, number>;
};

type ProgressRecord = {
  sourceId?: string;
  ok?: boolean;
  archived?: boolean;
};

type RawArchive = {
  source?: string;
  date?: string;
  meetings?: LiveMeeting[];
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const [candidates, completed] = await Promise.all([
    discoverDogs(options),
    options.resume ? readCompletedProfiles(options) : Promise.resolve(new Set<string>()),
  ]);
  const shardCandidates = filterShard(candidates, options);
  const pending = sortCandidates(
    shardCandidates.filter((candidate) => !completed.has(candidate.sourceId)),
    options.sort
  );
  const selected = options.sourceId || options.full ? pending : pending.slice(0, options.limit);

  console.log(
    JSON.stringify(
      {
        rawDir: options.rawDir,
        outputDir: options.outputDir,
        progressFile: options.progressFile,
        from: options.from ?? null,
        to: options.to ?? null,
        sourceId: options.sourceId ?? null,
        dryRun: options.dryRun,
        resume: options.resume,
        full: options.full,
        limit: options.limit,
        concurrency: options.concurrency,
        discoveredDogs: candidates.length,
        shardIndex: options.shardIndex ?? null,
        shardCount: options.shardCount ?? null,
        shardDogs: shardCandidates.length,
        completedProfiles: completed.size,
        pendingProfiles: pending.length,
        selectedProfiles: selected.length,
        retryAttempts: options.retryAttempts,
        retryDelayMs: options.retryDelayMs,
        sort: options.sort,
      },
      null,
      2
    )
  );

  if (!options.full && !options.sourceId && pending.length > selected.length) {
    console.log(
      `[backfill:thedogs:dog-profile-raw] Capped to ${selected.length} profile(s). Pass --full or raise --limit to archive more.`
    );
  }
  if (options.dryRun) return;

  const provider = new TheDogsDogProfileProvider();
  let errorCount = 0;
  await mapLimit(selected, options.concurrency, async (candidate) => {
    const startedAt = Date.now();
    const result = await archiveProfileWithRetries(candidate, provider, options);
    if (result.ok) {
      await appendProgress(options.progressFile, {
        sourceId: candidate.sourceId,
        name: candidate.name,
        ok: true,
        archived: true,
        outputPath: result.outputPath,
        durationMs: Date.now() - startedAt,
        attempts: result.attempts,
        formRows: result.parsed.formRows.length,
        raceAppearances: candidate.raceAppearances,
      });
      console.log(
        `[backfill:thedogs:dog-profile-raw] ${candidate.name} (${candidate.sourceId}) ok: ${result.parsed.formRows.length} form rows in ${Date.now() - startedAt}ms (attempt ${result.attempts})`
      );
    } else {
      errorCount += 1;
      await appendProgress(options.progressFile, {
        sourceId: candidate.sourceId,
        name: candidate.name,
        ok: false,
        archived: false,
        durationMs: Date.now() - startedAt,
        attempts: result.attempts,
        error: errorMessage(result.error),
      });
      console.error(
        `[backfill:thedogs:dog-profile-raw] ${candidate.name} (${candidate.sourceId}) failed:`,
        result.error
      );
      if (!options.continueOnError || errorCount >= options.maxErrors) {
        throw result.error;
      }
    }

    if (options.pauseMs > 0) await sleep(options.pauseMs);
  });
}

async function archiveProfileWithRetries(
  candidate: DogCandidate,
  provider: TheDogsDogProfileProvider,
  options: Options
) {
  const maxAttempts = options.retryAttempts + 1;
  let lastError: unknown;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const profileHtml = await provider.fetchProfile(candidate.profilePath);
      const showMorePath = parseShowMorePath(profileHtml);
      const fullFormHtml = showMorePath
        ? await provider.fetchFullForm(showMorePath)
        : "";
      const parsed = parseTheDogsDogProfile(
        profileHtml,
        candidate.sourceId,
        candidate.profilePath,
        fullFormHtml
      );
      const outputPath = profilePathFor(options.outputDir, candidate.sourceId);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(
        outputPath,
        `${JSON.stringify({
          source: "thedogs",
          sourceId: candidate.sourceId,
          fetchedAt: new Date().toISOString(),
          candidate,
          showMorePath: showMorePath ?? null,
          profileHtml,
          fullFormHtml,
          parsed,
        })}\n`
      );

      return { ok: true as const, outputPath, parsed, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientProfileError(error)) break;
      console.warn(
        `[backfill:thedogs:dog-profile-raw] ${candidate.name} (${candidate.sourceId}) attempt ${attempt}/${maxAttempts} failed; retrying in ${options.retryDelayMs}ms: ${errorMessage(error)}`
      );
      if (options.retryDelayMs > 0) await sleep(options.retryDelayMs);
    }
  }

  return {
    ok: false as const,
    error: lastError,
    attempts: attemptsUsed,
  };
}

async function discoverDogs(options: Options) {
  if (options.sourceId) {
    return [
      {
        sourceId: options.sourceId,
        name: options.sourceId,
        profilePath: buildTheDogsProfilePath(options.sourceId, options.sourceId),
        firstSeenDate: "",
        lastSeenDate: "",
        raceAppearances: 0,
        names: {},
        profilePaths: {},
      },
    ];
  }

  const rawFiles = (await scanRawArchives(options.rawDir)).filter(
    (candidate) =>
      (!options.from || candidate.date >= options.from) &&
      (!options.to || candidate.date <= options.to)
  );
  const dogs = new Map<string, DogCandidate>();
  for (const rawFile of rawFiles) {
    const archive = await readRawArchive(rawFile);
    for (const meeting of archive.meetings ?? []) {
      for (const race of meeting.races) {
        for (const runner of race.runners) {
          addRunnerDog(dogs, rawFile.date, runner);
        }
      }
    }
  }

  return [...dogs.values()].sort((a, b) => {
    const dateOrder = a.firstSeenDate.localeCompare(b.firstSeenDate);
    if (dateOrder !== 0) return dateOrder;
    return a.sourceId.localeCompare(b.sourceId);
  });
}

function addRunnerDog(
  dogs: Map<string, DogCandidate>,
  date: string,
  runner: LiveRunner
) {
  const sourceId =
    runner.dog.earBrand?.match(/^thedogs:(\d+)$/i)?.[1] ??
    sourceIdFromRaw(runner.sourceRawJson);
  if (!sourceId) return;

  const name = runner.dog.name?.trim() || sourceId;
  const profilePath =
    profilePathFromRaw(runner.sourceRawJson) ??
    buildTheDogsProfilePath(sourceId, name);
  const existing = dogs.get(sourceId);
  if (!existing) {
    dogs.set(sourceId, {
      sourceId,
      name,
      profilePath,
      firstSeenDate: date,
      lastSeenDate: date,
      raceAppearances: 1,
      names: { [name]: 1 },
      profilePaths: { [profilePath]: 1 },
    });
    return;
  }

  existing.raceAppearances += 1;
  existing.firstSeenDate = minDate(existing.firstSeenDate, date);
  existing.lastSeenDate = maxDate(existing.lastSeenDate, date);
  existing.names[name] = (existing.names[name] ?? 0) + 1;
  existing.profilePaths[profilePath] = (existing.profilePaths[profilePath] ?? 0) + 1;
  existing.name = mostCommon(existing.names);
  existing.profilePath = mostCommon(existing.profilePaths);
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

async function readRawArchive(candidate: RawCandidate): Promise<RawArchive> {
  const raw = JSON.parse(await readFile(candidate.rawPath, "utf8")) as RawArchive;
  if (!Array.isArray(raw.meetings)) {
    throw new Error(`${candidate.rawPath} is missing meetings[]`);
  }
  return raw;
}

async function readCompletedProfiles(options: Options) {
  const completed = new Set<string>();
  for (const record of await readProgress(options.progressFile)) {
    if (record.sourceId && record.ok && record.archived) completed.add(record.sourceId);
  }
  await collectExistingProfiles(options.outputDir, completed);
  return completed;
}

async function collectExistingProfiles(outputDir: string, completed: Set<string>) {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await readdir(outputDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }

  for (const entry of entries) {
    const fullPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      await collectExistingProfiles(fullPath, completed);
    } else if (entry.isFile() && /^\d+\.json$/.test(entry.name)) {
      completed.add(entry.name.replace(/\.json$/, ""));
    }
  }
}

async function readProgress(progressFile: string) {
  try {
    const body = await readFile(progressFile, "utf8");
    return body
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ProgressRecord);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
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
  const from = stringOption(values, "from");
  const to = stringOption(values, "to");
  const sourceId = stringOption(values, "source-id");
  const shardIndex = optionalPositiveInt(stringOption(values, "shard-index"));
  const shardCount = optionalPositiveInt(stringOption(values, "shard-count"));
  if (from) assertDate(from, "--from");
  if (to) assertDate(to, "--to");
  if (from && to && from > to) throw new Error("--from must be before or equal to --to");
  if ((shardIndex == null) !== (shardCount == null)) {
    throw new Error("--shard-index and --shard-count must be provided together");
  }
  if (shardIndex != null && shardCount != null && shardIndex > shardCount) {
    throw new Error("--shard-index must be less than or equal to --shard-count");
  }

  return {
    rawDir: stringOption(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    outputDir: stringOption(values, "output-dir") ?? DEFAULT_OUTPUT_DIR,
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    full: values.has("full"),
    limit: positiveInt(stringOption(values, "limit"), 25),
    concurrency: positiveInt(stringOption(values, "concurrency"), 1),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 1_000),
    resume: !values.has("no-resume"),
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 25),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 2),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 2_000),
    sort: sortOption(stringOption(values, "sort")),
    sourceId,
    from,
    to,
    shardIndex,
    shardCount,
    dryRun: values.has("dry-run"),
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

function sourceIdFromRaw(sourceRawJson?: string) {
  if (!sourceRawJson) return undefined;
  try {
    const raw = JSON.parse(sourceRawJson) as { dogId?: unknown };
    return typeof raw.dogId === "string" ? raw.dogId : undefined;
  } catch {
    return undefined;
  }
}

function profilePathFromRaw(sourceRawJson?: string) {
  if (!sourceRawJson) return undefined;
  try {
    const raw = JSON.parse(sourceRawJson) as { dogProfileUrl?: unknown };
    return typeof raw.dogProfileUrl === "string" ? raw.dogProfileUrl : undefined;
  } catch {
    return undefined;
  }
}

function profilePathFor(outputDir: string, sourceId: string) {
  const bucket = sourceId.padStart(2, "0").slice(-2);
  return path.join(outputDir, bucket, `${sourceId}.json`);
}

function sortCandidates(
  candidates: DogCandidate[],
  sort: Options["sort"]
) {
  return [...candidates].sort((a, b) => {
    if (sort === "appearances") {
      return (
        b.raceAppearances - a.raceAppearances ||
        a.firstSeenDate.localeCompare(b.firstSeenDate) ||
        a.sourceId.localeCompare(b.sourceId)
      );
    }
    const dateOrder = a.firstSeenDate.localeCompare(b.firstSeenDate);
    if (dateOrder !== 0) return dateOrder;
    return a.sourceId.localeCompare(b.sourceId);
  });
}

function filterShard(candidates: DogCandidate[], options: Options) {
  if (options.sourceId || options.shardIndex == null || options.shardCount == null) {
    return candidates;
  }
  return candidates.filter(
    (candidate) => shardIndexFor(candidate.sourceId, options.shardCount as number) === options.shardIndex
  );
}

function shardIndexFor(sourceId: string, shardCount: number) {
  return (stableHash(sourceId) % shardCount) + 1;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
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

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalPositiveInt(value: string | undefined) {
  if (value == null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Shard options must be positive integers");
  }
  return parsed;
}

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sortOption(value: string | undefined): Options["sort"] {
  if (value === "appearances" || value === "first-seen") return value;
  if (value) throw new Error("--sort must be either first-seen or appearances");
  return "first-seen";
}

function isTransientProfileError(error: unknown) {
  return /\b(429|502|503|504)\b|ECONNRESET|ETIMEDOUT|fetch failed|timeout/i.test(
    errorMessage(error)
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mostCommon(values: Record<string, number>) {
  return Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

function minDate(a: string, b: string) {
  return a && a <= b ? a : b;
}

function maxDate(a: string, b: string) {
  return a && a >= b ? a : b;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const promise = worker(item).finally(() => executing.delete(promise));
    executing.add(promise);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
}

main().catch((err) => {
  console.error("[backfill:thedogs:dog-profile-raw] failed:", err);
  process.exitCode = 1;
});
