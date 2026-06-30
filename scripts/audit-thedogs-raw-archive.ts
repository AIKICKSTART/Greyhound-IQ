/**
 * Summarise raw The Dogs archive coverage and data richness without touching
 * the database.
 *
 * Examples:
 *   npm run audit:thedogs:raw
 *   npm run audit:thedogs:raw -- --from 2006-11-18 --to 2026-07-01
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { LiveMeeting, LiveRace, LiveRunner } from "../src/lib/live/provider";

const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_MISSING_LIMIT = 50;

type Options = {
  rawDir: string;
  from?: string;
  to?: string;
  missingLimit: number;
};

type RawCandidate = {
  date: string;
  rawPath: string;
  bytes: number;
};

type RawArchive = {
  source?: string;
  date?: string;
  fetchedAt?: string;
  meetings?: LiveMeeting[];
};

type CountStats = {
  meetings: number;
  races: number;
  runners: number;
  resultRows: number;
  runnersWithWeight: number;
  runnersWithTrainer: number;
  runnersWithStartingPrice: number;
  runnersWithSourceId: number;
  runnersWithRunningTime: number;
  runnersWithMargin: number;
  runnersWithSplitTime: number;
  runnersWithSectionals: number;
  racesWithPrizeMoney: number;
  racesWithReplay: number;
  racesWithPhotoFinish: number;
  racesPosted: number;
};

type YearStats = CountStats & {
  rawDates: number;
  bytes: number;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const candidates = await scanRawArchives(options.rawDir);
  if (candidates.length === 0) {
    throw new Error(`No raw archive files found under ${options.rawDir}`);
  }

  const observedFrom = candidates[0]?.date;
  const observedTo = candidates.at(-1)?.date;
  const rangeFrom = options.from ?? observedFrom;
  const rangeTo = options.to ?? observedTo;
  if (!rangeFrom || !rangeTo) throw new Error("Could not resolve audit range");
  if (dayValue(rangeFrom) > dayValue(rangeTo)) {
    throw new Error("--from must be before or equal to --to");
  }

  const inRange = candidates.filter(
    (item) => item.date >= rangeFrom && item.date <= rangeTo
  );
  const totals = emptyStats();
  const years = new Map<string, YearStats>();
  const tracks = new Set<string>();
  const states = new Set<string>();
  const dogs = new Set<string>();
  const trainers = new Set<string>();
  const invalidFiles: Array<{ date: string; rawPath: string; error: string }> = [];

  for (const candidate of inRange) {
    try {
      const archive = await readRawArchive(candidate);
      const year = candidate.date.slice(0, 4);
      const yearStats = ensureYearStats(years, year);
      yearStats.rawDates += 1;
      yearStats.bytes += candidate.bytes;

      for (const meeting of archive.meetings ?? []) {
        totals.meetings += 1;
        yearStats.meetings += 1;
        tracks.add(meeting.trackName);
        if (meeting.state) states.add(meeting.state);
        for (const race of meeting.races) {
          addRaceStats(totals, race);
          addRaceStats(yearStats, race);
          for (const runner of race.runners) {
            addRunnerStats(totals, runner);
            addRunnerStats(yearStats, runner);
            const dogKey = runner.dog.earBrand ?? runner.dog.name;
            if (dogKey) dogs.add(dogKey);
            if (runner.trainerName) trainers.add(runner.trainerName);
          }
        }
      }
    } catch (err) {
      invalidFiles.push({
        date: candidate.date,
        rawPath: candidate.rawPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const rawDateSet = new Set(candidates.map((item) => item.date));
  const missingDates = enumerateDates(rangeFrom, rangeTo).filter(
    (date) => !rawDateSet.has(date)
  );
  const contiguousFromRange = contiguousThrough(rangeFrom, rawDateSet);
  const byteTotal = inRange.reduce((sum, item) => sum + item.bytes, 0);
  const coverageDays = daysBetween(rangeFrom, rangeTo) + 1;

  const summary = {
    rawDir: options.rawDir,
    observedRawFrom: observedFrom,
    observedRawTo: observedTo,
    rangeFrom,
    rangeTo,
    coverageDays,
    rawDatesInRange: inRange.length,
    missingRawDatesInRange: missingDates.length,
    contiguousRawThrough: contiguousFromRange,
    nextMissingRawDate:
      contiguousFromRange == null
        ? rangeFrom
        : formatDate(dayValue(contiguousFromRange) + 86_400_000),
    filesTotal: candidates.length,
    filesInRange: inRange.length,
    bytesInRange: byteTotal,
    invalidFiles: invalidFiles.length,
    tracks: tracks.size,
    states: [...states].sort(),
    dogs: dogs.size,
    trainers: trainers.size,
    ...totals,
    richnessRates: {
      runnerWeight: ratio(totals.runnersWithWeight, totals.runners),
      runnerTrainer: ratio(totals.runnersWithTrainer, totals.runners),
      startingPrice: ratio(totals.runnersWithStartingPrice, totals.runners),
      runningTime: ratio(totals.runnersWithRunningTime, totals.runners),
      margin: ratio(totals.runnersWithMargin, totals.runners),
      splitTime: ratio(totals.runnersWithSplitTime, totals.runners),
      sectionals: ratio(totals.runnersWithSectionals, totals.runners),
      prizeMoney: ratio(totals.racesWithPrizeMoney, totals.races),
      replay: ratio(totals.racesWithReplay, totals.races),
    },
  };

  console.log(
    JSON.stringify(
      {
        summary,
        missingRawDateSamples: missingDates.slice(0, options.missingLimit),
        invalidFileSamples: invalidFiles.slice(0, options.missingLimit),
        years: Object.fromEntries(
          [...years.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, stats]) => [
              year,
              {
                ...stats,
                richnessRates: {
                  runnerWeight: ratio(stats.runnersWithWeight, stats.runners),
                  runnerTrainer: ratio(stats.runnersWithTrainer, stats.runners),
                  startingPrice: ratio(stats.runnersWithStartingPrice, stats.runners),
                  runningTime: ratio(stats.runnersWithRunningTime, stats.runners),
                  margin: ratio(stats.runnersWithMargin, stats.runners),
                  splitTime: ratio(stats.runnersWithSplitTime, stats.runners),
                  sectionals: ratio(stats.runnersWithSectionals, stats.runners),
                  prizeMoney: ratio(stats.racesWithPrizeMoney, stats.races),
                  replay: ratio(stats.racesWithReplay, stats.races),
                },
              },
            ])
        ),
      },
      null,
      2
    )
  );

  if (invalidFiles.length > 0) process.exitCode = 1;
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
    if (!date) continue;
    const info = await stat(fullPath);
    files.push({ date, rawPath: fullPath, bytes: info.size });
  }
}

async function readRawArchive(candidate: RawCandidate) {
  const archive = JSON.parse(await readFile(candidate.rawPath, "utf8")) as RawArchive;
  if (archive.source !== "thedogs") {
    throw new Error(`unsupported source=${String(archive.source)}`);
  }
  if (archive.date !== candidate.date) {
    throw new Error(
      `date mismatch: expected ${candidate.date}, got ${String(archive.date)}`
    );
  }
  if (!Array.isArray(archive.meetings)) {
    throw new Error("missing meetings[]");
  }
  return archive;
}

function addRaceStats(stats: CountStats, race: LiveRace) {
  stats.races += 1;
  if (race.prizeMoney != null) stats.racesWithPrizeMoney += 1;
  if (race.replayUrl) stats.racesWithReplay += 1;
  if (race.photoFinishUrl) stats.racesWithPhotoFinish += 1;
  if (race.resultStatus === "posted") stats.racesPosted += 1;
}

function addRunnerStats(stats: CountStats, runner: LiveRunner) {
  stats.runners += 1;
  if (hasResultData(runner)) stats.resultRows += 1;
  if (runner.weight != null) stats.runnersWithWeight += 1;
  if (runner.trainerName) stats.runnersWithTrainer += 1;
  if (runner.startingPrice != null) stats.runnersWithStartingPrice += 1;
  if (runner.sourceId) stats.runnersWithSourceId += 1;
  if (runner.runningTime != null) stats.runnersWithRunningTime += 1;
  if (runner.margin != null) stats.runnersWithMargin += 1;
  if (runner.splitTime != null) stats.runnersWithSplitTime += 1;
  if (runner.sectionals) stats.runnersWithSectionals += 1;
}

function hasResultData(runner: LiveRunner) {
  return (
    runner.finishingPosition != null ||
    runner.runningTime != null ||
    runner.margin != null ||
    runner.splitTime != null
  );
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  const from = stringOption(values, "from");
  const to = stringOption(values, "to");
  if (from) assertDate(from, "--from");
  if (to) assertDate(to, "--to");
  return {
    rawDir: stringOption(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    from,
    to,
    missingLimit: positiveInt(
      stringOption(values, "missing-limit"),
      DEFAULT_MISSING_LIMIT
    ),
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

function ensureYearStats(years: Map<string, YearStats>, year: string) {
  const existing = years.get(year);
  if (existing) return existing;
  const created = { rawDates: 0, bytes: 0, ...emptyStats() };
  years.set(year, created);
  return created;
}

function emptyStats(): CountStats {
  return {
    meetings: 0,
    races: 0,
    runners: 0,
    resultRows: 0,
    runnersWithWeight: 0,
    runnersWithTrainer: 0,
    runnersWithStartingPrice: 0,
    runnersWithSourceId: 0,
    runnersWithRunningTime: 0,
    runnersWithMargin: 0,
    runnersWithSplitTime: 0,
    runnersWithSectionals: 0,
    racesWithPrizeMoney: 0,
    racesWithReplay: 0,
    racesWithPhotoFinish: 0,
    racesPosted: 0,
  };
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
    dates.push(formatDate(cursor));
  }
  return dates;
}

function contiguousThrough(from: string, dates: Set<string>) {
  let cursor = dayValue(from);
  let last: string | null = null;
  while (dates.has(formatDate(cursor))) {
    last = formatDate(cursor);
    cursor += 86_400_000;
  }
  return last;
}

function ratio(value: number, total: number) {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
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

function daysBetween(from: string, to: string) {
  return Math.floor((dayValue(to) - dayValue(from)) / 86_400_000);
}

function formatDate(day: number) {
  return new Date(day).toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error("[audit:thedogs:raw] failed:", err);
  process.exitCode = 1;
});
