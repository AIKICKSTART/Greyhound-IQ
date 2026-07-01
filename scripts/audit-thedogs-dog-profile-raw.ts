/**
 * Summarise archived The Dogs dog profile pages and parsed form richness
 * without touching the database.
 *
 * Examples:
 *   npm run audit:thedogs:dog-profiles
 *   npm run audit:thedogs:dog-profiles -- --skip-raw-scan
 *   npm run audit:thedogs:dog-profiles -- --skip-raw-scan --output-file .backfill/reports/thedogs-dog-profile-richness-latest.json
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LiveMeeting, LiveRunner } from "../src/lib/live/provider";

const DEFAULT_PROFILE_DIR = ".backfill/thedogs-dog-profiles-raw";
const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_PROGRESS = ".backfill/thedogs-dog-profile-raw-progress.jsonl";
const DEFAULT_SAMPLE_LIMIT = 25;

type Options = {
  profileDir: string;
  rawDir: string;
  progressFile: string;
  sampleLimit: number;
  rawScan: boolean;
  outputFile?: string;
  compact: boolean;
};

type ProfileCandidate = {
  sourceId: string;
  profilePath: string;
  bytes: number;
};

type RawCandidate = {
  date: string;
  rawPath: string;
};

type RawArchive = {
  meetings?: LiveMeeting[];
};

type DogCandidate = {
  sourceId: string;
  name: string;
  firstSeenDate: string;
  lastSeenDate: string;
  raceAppearances: number;
};

type ProgressRecord = {
  sourceId?: string;
  ok?: boolean;
  archived?: boolean;
};

type ProfileArchive = {
  source?: string;
  sourceId?: string;
  fetchedAt?: string;
  candidate?: {
    sourceId?: string;
    name?: string;
    firstSeenDate?: string;
    lastSeenDate?: string;
    raceAppearances?: number;
  };
  showMorePath?: string | null;
  profileHtml?: string;
  fullFormHtml?: string;
  parsed?: ParsedProfile;
};

type ParsedProfile = {
  sourceProvider?: string;
  sourceId?: string;
  profileUrl?: string;
  name?: string;
  trainerName?: string;
  ownerName?: string;
  sire?: { sourceId?: string; name?: string };
  dam?: { sourceId?: string; name?: string };
  colour?: string;
  sex?: string;
  whelpDate?: string;
  careerStarts?: number;
  careerWins?: number;
  careerSeconds?: number;
  careerThirds?: number;
  prizeMoney?: number;
  winPercentage?: number;
  placePercentage?: number;
  bestTimesJson?: string;
  boxHistoryJson?: string;
  distanceHistoryJson?: string;
  formRows?: ParsedFormRow[];
};

type ParsedFormRow = {
  sourceId?: string;
  raceUrl?: string;
  date?: string;
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
  startingPrice?: number;
  hasVideo?: boolean;
};

type ProfileStats = {
  files: number;
  bytes: number;
  parsedProfiles: number;
  profilesWithProfileHtml: number;
  profilesWithFullFormHtml: number;
  profilesWithShowMorePath: number;
  profilesWithName: number;
  profilesWithTrainer: number;
  profilesWithOwner: number;
  profilesWithSire: number;
  profilesWithDam: number;
  profilesWithColour: number;
  profilesWithSex: number;
  profilesWithWhelpDate: number;
  profilesWithCareerStarts: number;
  profilesWithPrizeMoney: number;
  profilesWithWinPlace: number;
  profilesWithBestTimes: number;
  profilesWithBoxHistory: number;
  profilesWithDistanceHistory: number;
  candidateRaceAppearances: number;
  parsedCareerStarts: number;
  formRows: number;
  uniqueFormRaceUrls: number;
  rowsWithDate: number;
  rowsWithTrack: number;
  rowsWithFinish: number;
  rowsWithBox: number;
  rowsWithWeight: number;
  rowsWithDistance: number;
  rowsWithGrade: number;
  rowsWithRunningTime: number;
  rowsWithWinnerTime: number;
  rowsWithBestOfNightTime: number;
  rowsWithFirstSectional: number;
  rowsWithMargin: number;
  rowsWithWinnerDog: number;
  rowsWithInRunningPositions: number;
  rowsWithStartingPrice: number;
  rowsWithVideo: number;
};

type YearStats = {
  profileFiles: number;
  formRows: number;
  rowsWithWeight: number;
  rowsWithRunningTime: number;
  rowsWithMargin: number;
  rowsWithStartingPrice: number;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const [profiles, progressRecords, rawDogs] = await Promise.all([
    scanProfileArchives(options.profileDir),
    readProgress(options.progressFile),
    options.rawScan ? discoverDogs(options.rawDir) : Promise.resolve(null),
  ]);
  const archivedSourceIds = new Set<string>();
  const formRaceUrls = new Set<string>();
  const tracks = new Set<string>();
  const trainers = new Set<string>();
  const owners = new Set<string>();
  const sires = new Set<string>();
  const dams = new Set<string>();
  const years = new Map<string, YearStats>();
  const stats = emptyProfileStats();
  const invalidFiles: Array<{ sourceId: string; profilePath: string; error: string }> = [];
  const sourceIdMismatches: Array<{
    fileSourceId: string;
    archiveSourceId?: string;
    parsedSourceId?: string;
    candidateSourceId?: string;
  }> = [];

  for (const candidate of profiles) {
    try {
      const archive = await readProfileArchive(candidate);
      const parsed = archive.parsed;
      const sourceIds = {
        archiveSourceId: archive.sourceId,
        parsedSourceId: parsed?.sourceId,
        candidateSourceId: archive.candidate?.sourceId,
      };
      if (
        Object.values(sourceIds).some((value) => value && value !== candidate.sourceId)
      ) {
        sourceIdMismatches.push({ fileSourceId: candidate.sourceId, ...sourceIds });
      }

      archivedSourceIds.add(candidate.sourceId);
      addProfileStats(stats, candidate, archive);
      const profileYear = archive.candidate?.firstSeenDate?.slice(0, 4);
      if (profileYear) ensureYearStats(years, profileYear).profileFiles += 1;
      if (parsed?.trainerName) trainers.add(parsed.trainerName);
      if (parsed?.ownerName) owners.add(parsed.ownerName);
      if (parsed?.sire?.sourceId ?? parsed?.sire?.name) {
        sires.add(parsed.sire?.sourceId ?? parsed.sire?.name ?? "");
      }
      if (parsed?.dam?.sourceId ?? parsed?.dam?.name) {
        dams.add(parsed.dam?.sourceId ?? parsed.dam?.name ?? "");
      }

      for (const row of parsed?.formRows ?? []) {
        if (row.raceUrl) formRaceUrls.add(row.raceUrl);
        if (row.trackCode) tracks.add(row.trackCode);
        const year = yearFromRowDate(row.date);
        if (year) addYearStats(ensureYearStats(years, year), row);
      }
    } catch (err) {
      invalidFiles.push({
        sourceId: candidate.sourceId,
        profilePath: candidate.profilePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  stats.uniqueFormRaceUrls = formRaceUrls.size;
  const latestProgressByDog = latestProgress(progressRecords);
  const latestProgressValues = [...latestProgressByDog.values()];
  const rawDogValues = rawDogs ? [...rawDogs.values()] : [];
  const pendingRawDogs = rawDogs
    ? rawDogValues
        .filter((dog) => !archivedSourceIds.has(dog.sourceId))
        .sort((a, b) => b.raceAppearances - a.raceAppearances)
    : [];

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      profileDir: options.profileDir,
      rawDir: options.rawScan ? options.rawDir : null,
      progressFile: options.progressFile,
      rawScan: options.rawScan,
      filesTotal: profiles.length,
      filesInvalid: invalidFiles.length,
      sourceIdMismatches: sourceIdMismatches.length,
      progressRows: progressRecords.length,
      progressUniqueDogs: latestProgressByDog.size,
      progressLatestOk: latestProgressValues.filter((record) => record.ok).length,
      progressLatestFailed: latestProgressValues.filter(
        (record) => record.ok === false
      ).length,
      discoveredDogsFromRaw: rawDogs?.size ?? null,
      archivedRawDogs: rawDogs
        ? rawDogValues.filter((dog) => archivedSourceIds.has(dog.sourceId)).length
        : null,
      pendingRawDogs: rawDogs ? pendingRawDogs.length : null,
      tracks: tracks.size,
      trainers: trainers.size,
      owners: owners.size,
      sires: sires.size,
      dams: dams.size,
      ...stats,
      richnessRates: {
        profileHtml: ratio(stats.profilesWithProfileHtml, stats.files),
        fullFormHtml: ratio(stats.profilesWithFullFormHtml, stats.files),
        trainer: ratio(stats.profilesWithTrainer, stats.parsedProfiles),
        owner: ratio(stats.profilesWithOwner, stats.parsedProfiles),
        sire: ratio(stats.profilesWithSire, stats.parsedProfiles),
        dam: ratio(stats.profilesWithDam, stats.parsedProfiles),
        careerStarts: ratio(stats.profilesWithCareerStarts, stats.parsedProfiles),
        prizeMoney: ratio(stats.profilesWithPrizeMoney, stats.parsedProfiles),
        formRowsVsCareerStarts: ratio(stats.formRows, stats.parsedCareerStarts),
        rowWeight: ratio(stats.rowsWithWeight, stats.formRows),
        rowRunningTime: ratio(stats.rowsWithRunningTime, stats.formRows),
        rowMargin: ratio(stats.rowsWithMargin, stats.formRows),
        rowStartingPrice: ratio(stats.rowsWithStartingPrice, stats.formRows),
        rowBox: ratio(stats.rowsWithBox, stats.formRows),
        rowVideo: ratio(stats.rowsWithVideo, stats.formRows),
      },
    },
    invalidFileSamples: invalidFiles.slice(0, options.sampleLimit),
    sourceIdMismatchSamples: sourceIdMismatches.slice(0, options.sampleLimit),
    pendingRawDogSamples: pendingRawDogs.slice(0, options.sampleLimit),
    years: Object.fromEntries(
      [...years.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, yearStats]) => [
          year,
          {
            ...yearStats,
            richnessRates: {
              rowWeight: ratio(yearStats.rowsWithWeight, yearStats.formRows),
              rowRunningTime: ratio(
                yearStats.rowsWithRunningTime,
                yearStats.formRows
              ),
              rowMargin: ratio(yearStats.rowsWithMargin, yearStats.formRows),
              rowStartingPrice: ratio(
                yearStats.rowsWithStartingPrice,
                yearStats.formRows
              ),
            },
          },
        ])
    ),
  };

  if (options.outputFile) {
    await mkdir(path.dirname(options.outputFile), { recursive: true });
    await writeFile(options.outputFile, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify(report, null, options.compact ? 0 : 2));

  if (invalidFiles.length > 0 || sourceIdMismatches.length > 0) process.exitCode = 1;
}

async function scanProfileArchives(profileDir: string) {
  const files: ProfileCandidate[] = [];
  await collectProfileArchives(profileDir, files);
  return files.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

async function collectProfileArchives(currentDir: string, files: ProfileCandidate[]) {
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
      await collectProfileArchives(fullPath, files);
      continue;
    }
    if (!entry.isFile() || !/^\d+\.json$/i.test(entry.name)) continue;
    const info = await stat(fullPath);
    files.push({
      sourceId: entry.name.replace(/\.json$/i, ""),
      profilePath: fullPath,
      bytes: info.size,
    });
  }
}

async function readProfileArchive(candidate: ProfileCandidate) {
  const archive = JSON.parse(
    await readFile(candidate.profilePath, "utf8")
  ) as ProfileArchive;
  if (archive.source !== "thedogs") {
    throw new Error(`unsupported source=${String(archive.source)}`);
  }
  if (!archive.parsed) throw new Error("missing parsed profile");
  if (!Array.isArray(archive.parsed.formRows)) {
    throw new Error("missing parsed.formRows[]");
  }
  return archive;
}

async function discoverDogs(rawDir: string) {
  const files = await scanRawArchives(rawDir);
  const dogs = new Map<string, DogCandidate>();
  for (const rawFile of files) {
    const archive = await readRawArchive(rawFile);
    for (const meeting of archive.meetings ?? []) {
      for (const race of meeting.races) {
        for (const runner of race.runners) addRunnerDog(dogs, rawFile.date, runner);
      }
    }
  }
  return dogs;
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

function addRunnerDog(
  dogs: Map<string, DogCandidate>,
  date: string,
  runner: LiveRunner
) {
  const sourceId =
    runner.dog.earBrand?.match(/^thedogs:(\d+)$/i)?.[1] ??
    sourceIdFromRaw(runner.sourceRawJson);
  if (!sourceId) return;

  const existing = dogs.get(sourceId);
  if (!existing) {
    dogs.set(sourceId, {
      sourceId,
      name: runner.dog.name?.trim() || sourceId,
      firstSeenDate: date,
      lastSeenDate: date,
      raceAppearances: 1,
    });
    return;
  }

  existing.raceAppearances += 1;
  if (date < existing.firstSeenDate) existing.firstSeenDate = date;
  if (date > existing.lastSeenDate) existing.lastSeenDate = date;
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

function latestProgress(records: ProgressRecord[]) {
  const latest = new Map<string, ProgressRecord>();
  for (const record of records) {
    if (record.sourceId) latest.set(record.sourceId, record);
  }
  return latest;
}

function addProfileStats(
  stats: ProfileStats,
  candidate: ProfileCandidate,
  archive: ProfileArchive
) {
  const parsed = archive.parsed;
  stats.files += 1;
  stats.bytes += candidate.bytes;
  if (archive.profileHtml) stats.profilesWithProfileHtml += 1;
  if (archive.fullFormHtml) stats.profilesWithFullFormHtml += 1;
  if (archive.showMorePath) stats.profilesWithShowMorePath += 1;
  if (!parsed) return;

  stats.parsedProfiles += 1;
  if (parsed.name) stats.profilesWithName += 1;
  if (parsed.trainerName) stats.profilesWithTrainer += 1;
  if (parsed.ownerName) stats.profilesWithOwner += 1;
  if (parsed.sire?.sourceId ?? parsed.sire?.name) stats.profilesWithSire += 1;
  if (parsed.dam?.sourceId ?? parsed.dam?.name) stats.profilesWithDam += 1;
  if (parsed.colour) stats.profilesWithColour += 1;
  if (parsed.sex) stats.profilesWithSex += 1;
  if (parsed.whelpDate) stats.profilesWithWhelpDate += 1;
  if (parsed.careerStarts != null) {
    stats.profilesWithCareerStarts += 1;
    stats.parsedCareerStarts += parsed.careerStarts;
  }
  if (archive.candidate?.raceAppearances != null) {
    stats.candidateRaceAppearances += archive.candidate.raceAppearances;
  }
  if (parsed.prizeMoney != null) stats.profilesWithPrizeMoney += 1;
  if (parsed.winPercentage != null && parsed.placePercentage != null) {
    stats.profilesWithWinPlace += 1;
  }
  if (hasJsonRows(parsed.bestTimesJson)) stats.profilesWithBestTimes += 1;
  if (hasJsonRows(parsed.boxHistoryJson)) stats.profilesWithBoxHistory += 1;
  if (hasJsonRows(parsed.distanceHistoryJson)) {
    stats.profilesWithDistanceHistory += 1;
  }

  for (const row of parsed.formRows ?? []) addFormStats(stats, row);
}

function addFormStats(stats: ProfileStats, row: ParsedFormRow) {
  stats.formRows += 1;
  if (row.date) stats.rowsWithDate += 1;
  if (row.trackCode) stats.rowsWithTrack += 1;
  if (row.finishText || row.finishingPosition != null) stats.rowsWithFinish += 1;
  if (row.boxNumber != null) stats.rowsWithBox += 1;
  if (row.weight != null) stats.rowsWithWeight += 1;
  if (row.distance != null) stats.rowsWithDistance += 1;
  if (row.grade) stats.rowsWithGrade += 1;
  if (row.runningTime != null) stats.rowsWithRunningTime += 1;
  if (row.winnerTime != null) stats.rowsWithWinnerTime += 1;
  if (row.bestOfNightTime != null) stats.rowsWithBestOfNightTime += 1;
  if (row.firstSectional != null) stats.rowsWithFirstSectional += 1;
  if (row.margin != null) stats.rowsWithMargin += 1;
  if (row.winnerDogName || row.winnerDogSourceId) stats.rowsWithWinnerDog += 1;
  if (row.inRunningPositions) stats.rowsWithInRunningPositions += 1;
  if (row.startingPrice != null) stats.rowsWithStartingPrice += 1;
  if (row.hasVideo) stats.rowsWithVideo += 1;
}

function addYearStats(stats: YearStats, row: ParsedFormRow) {
  stats.formRows += 1;
  if (row.weight != null) stats.rowsWithWeight += 1;
  if (row.runningTime != null) stats.rowsWithRunningTime += 1;
  if (row.margin != null) stats.rowsWithMargin += 1;
  if (row.startingPrice != null) stats.rowsWithStartingPrice += 1;
}

function ensureYearStats(years: Map<string, YearStats>, year: string) {
  const existing = years.get(year);
  if (existing) return existing;
  const created: YearStats = {
    profileFiles: 0,
    formRows: 0,
    rowsWithWeight: 0,
    rowsWithRunningTime: 0,
    rowsWithMargin: 0,
    rowsWithStartingPrice: 0,
  };
  years.set(year, created);
  return created;
}

function emptyProfileStats(): ProfileStats {
  return {
    files: 0,
    bytes: 0,
    parsedProfiles: 0,
    profilesWithProfileHtml: 0,
    profilesWithFullFormHtml: 0,
    profilesWithShowMorePath: 0,
    profilesWithName: 0,
    profilesWithTrainer: 0,
    profilesWithOwner: 0,
    profilesWithSire: 0,
    profilesWithDam: 0,
    profilesWithColour: 0,
    profilesWithSex: 0,
    profilesWithWhelpDate: 0,
    profilesWithCareerStarts: 0,
    profilesWithPrizeMoney: 0,
    profilesWithWinPlace: 0,
    profilesWithBestTimes: 0,
    profilesWithBoxHistory: 0,
    profilesWithDistanceHistory: 0,
    candidateRaceAppearances: 0,
    parsedCareerStarts: 0,
    formRows: 0,
    uniqueFormRaceUrls: 0,
    rowsWithDate: 0,
    rowsWithTrack: 0,
    rowsWithFinish: 0,
    rowsWithBox: 0,
    rowsWithWeight: 0,
    rowsWithDistance: 0,
    rowsWithGrade: 0,
    rowsWithRunningTime: 0,
    rowsWithWinnerTime: 0,
    rowsWithBestOfNightTime: 0,
    rowsWithFirstSectional: 0,
    rowsWithMargin: 0,
    rowsWithWinnerDog: 0,
    rowsWithInRunningPositions: 0,
    rowsWithStartingPrice: 0,
    rowsWithVideo: 0,
  };
}

function hasJsonRows(value?: string) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.some((row) => Array.isArray(row) && row.length > 0);
  } catch {
    return false;
  }
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

function dateFromRawPath(rootDir: string, rawPath: string) {
  const relative = path.relative(rootDir, rawPath);
  const parts = relative.split(path.sep);
  if (parts.length !== 3) return null;
  const [year, month, fileName] = parts;
  const day = fileName.replace(/\.json$/i, "");
  const date = `${year}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function yearFromRowDate(value?: string) {
  return value && /^\d{4}/.test(value) ? value.slice(0, 4) : null;
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  return {
    profileDir: stringOption(values, "profile-dir") ?? DEFAULT_PROFILE_DIR,
    rawDir: stringOption(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    sampleLimit: positiveInt(stringOption(values, "sample-limit"), DEFAULT_SAMPLE_LIMIT),
    rawScan: !values.has("skip-raw-scan"),
    outputFile: stringOption(values, "output-file"),
    compact: values.has("compact"),
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

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ratio(value: number, total: number) {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

main().catch((err) => {
  console.error("[audit:thedogs:dog-profiles] failed:", err);
  process.exitCode = 1;
});
