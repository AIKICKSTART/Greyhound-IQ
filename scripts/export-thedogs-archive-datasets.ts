/**
 * Export harvested The Dogs archives into flat JSONL datasets.
 *
 * This does not touch the database. It turns the local raw archive into files
 * that can be analysed immediately and replayed into Postgres later.
 *
 * Examples:
 *   npm run export:thedogs:datasets
 *   npm run export:thedogs:datasets -- --profiles-only
 *   npm run export:thedogs:datasets -- --races-only --from 2024-01-01
 */
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import type { LiveMeeting } from "../src/lib/live/provider";

const DEFAULT_PROFILE_DIR = ".backfill/thedogs-dog-profiles-raw";
const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_OUT_DIR = ".backfill/exports";

type Options = {
  profileDir: string;
  rawDir: string;
  outDir: string;
  profiles: boolean;
  races: boolean;
  from?: string;
  to?: string;
  limitProfiles: number;
  limitRaceDays: number;
  includeRawJson: boolean;
};

type ProfileCandidate = {
  sourceId: string;
  profilePath: string;
  bytes: number;
};

type RawCandidate = {
  date: string;
  rawPath: string;
  bytes: number;
};

type ArchivedProfileFile = {
  source?: string;
  sourceId?: string;
  fetchedAt?: string;
  showMorePath?: string | null;
  candidate?: {
    sourceId?: string;
    name?: string;
    profilePath?: string;
    firstSeenDate?: string;
    lastSeenDate?: string;
    raceAppearances?: number;
  };
  parsed?: ArchivedProfile;
};

type ArchivedProfile = {
  sourceProvider?: string;
  sourceId?: string;
  profileUrl?: string;
  name?: string;
  trainerName?: string;
  ownerName?: string;
  sire?: ArchivedDogLink;
  dam?: ArchivedDogLink;
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
  profileStatsJson?: string;
  bestTimesJson?: string;
  boxHistoryJson?: string;
  distanceHistoryJson?: string;
  profileSourceRawJson?: string;
  formRows?: ArchivedProfileForm[];
};

type ArchivedDogLink = {
  sourceId?: string;
  name?: string;
  url?: string;
};

type ArchivedProfileForm = {
  sourceId?: string;
  raceUrl?: string;
  date?: string;
  trackCode?: string;
  trackName?: string;
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
  sourceRawJson?: string;
};

type RawArchive = {
  source?: string;
  date?: string;
  fetchedAt?: string;
  meetings?: LiveMeeting[];
};

type ExportCounts = {
  profileFiles: number;
  profileRows: number;
  profileFormRows: number;
  invalidProfiles: number;
  raceRawFiles: number;
  meetingRows: number;
  raceRows: number;
  raceRunnerRows: number;
  invalidRaceFiles: number;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(options.outDir, { recursive: true });

  const paths = exportPaths(options.outDir);
  const counts: ExportCounts = {
    profileFiles: 0,
    profileRows: 0,
    profileFormRows: 0,
    invalidProfiles: 0,
    raceRawFiles: 0,
    meetingRows: 0,
    raceRows: 0,
    raceRunnerRows: 0,
    invalidRaceFiles: 0,
  };

  const profileWriter = options.profiles ? writer(paths.profileRowsTmp) : null;
  const formWriter = options.profiles ? writer(paths.profileFormRowsTmp) : null;
  const meetingWriter = options.races ? writer(paths.meetingsTmp) : null;
  const raceWriter = options.races ? writer(paths.racesTmp) : null;
  const runnerWriter = options.races ? writer(paths.raceRunnersTmp) : null;
  const invalidWriter = writer(paths.invalidTmp);

  try {
    if (options.profiles && profileWriter && formWriter) {
      await exportProfiles(options, profileWriter, formWriter, invalidWriter, counts);
    }
    if (options.races && meetingWriter && raceWriter && runnerWriter) {
      await exportRaces(options, meetingWriter, raceWriter, runnerWriter, invalidWriter, counts);
    }
  } finally {
    await Promise.all(
      [profileWriter, formWriter, meetingWriter, raceWriter, runnerWriter, invalidWriter]
        .filter((item): item is JsonlWriter => item != null)
        .map((item) => item.close())
    );
  }

  await promoteOutputs(paths, options);
  const manifest = {
    generatedAt: new Date().toISOString(),
    options,
    counts,
    outputs: {
      profiles: options.profiles ? paths.profileRows : null,
      profileFormRows: options.profiles ? paths.profileFormRows : null,
      meetings: options.races ? paths.meetings : null,
      races: options.races ? paths.races : null,
      raceRunners: options.races ? paths.raceRunners : null,
      invalid: paths.invalid,
    },
  };
  await writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(JSON.stringify(manifest, null, 2));
}

async function exportProfiles(
  options: Options,
  profileWriter: JsonlWriter,
  formWriter: JsonlWriter,
  invalidWriter: JsonlWriter,
  counts: ExportCounts
) {
  const candidates = await scanProfileArchives(options.profileDir);
  const selected = options.limitProfiles > 0 ? candidates.slice(0, options.limitProfiles) : candidates;

  for (const candidate of selected) {
    counts.profileFiles += 1;
    try {
      const archive = JSON.parse(await readFile(candidate.profilePath, "utf8")) as ArchivedProfileFile;
      if (archive.source !== "thedogs") throw new Error(`unsupported source=${String(archive.source)}`);
      if (!archive.parsed) throw new Error("missing parsed profile");
      const profile = archive.parsed;
      const sourceId = profile.sourceId ?? archive.sourceId ?? candidate.sourceId;

      await profileWriter.write({
        sourceProvider: profile.sourceProvider ?? "thedogs",
        sourceId,
        profileUrl: profile.profileUrl,
        fetchedAt: archive.fetchedAt,
        showMorePath: archive.showMorePath ?? null,
        archivePath: candidate.profilePath,
        archiveBytes: candidate.bytes,
        name: profile.name ?? archive.candidate?.name ?? sourceId,
        trainerName: profile.trainerName,
        ownerName: profile.ownerName,
        sireSourceId: profile.sire?.sourceId,
        sireName: profile.sire?.name,
        damSourceId: profile.dam?.sourceId,
        damName: profile.dam?.name,
        colour: profile.colour,
        sex: profile.sex,
        whelpDate: isoDate(profile.whelpDate),
        careerStarts: profile.careerStarts,
        careerWins: profile.careerWins,
        careerSeconds: profile.careerSeconds,
        careerThirds: profile.careerThirds,
        prizeMoney: profile.prizeMoney,
        winPercentage: profile.winPercentage,
        placePercentage: profile.placePercentage,
        candidateFirstSeenDate: archive.candidate?.firstSeenDate,
        candidateLastSeenDate: archive.candidate?.lastSeenDate,
        candidateRaceAppearances: archive.candidate?.raceAppearances,
        bestTimesJson: profile.bestTimesJson,
        boxHistoryJson: profile.boxHistoryJson,
        distanceHistoryJson: profile.distanceHistoryJson,
        profileStatsJson: profile.profileStatsJson,
        profileSourceRawJson: options.includeRawJson ? profile.profileSourceRawJson : undefined,
        formRows: profile.formRows?.length ?? 0,
      });
      counts.profileRows += 1;

      for (const row of profile.formRows ?? []) {
        await formWriter.write({
          dogSourceProvider: profile.sourceProvider ?? "thedogs",
          dogSourceId: sourceId,
          dogName: profile.name ?? archive.candidate?.name ?? sourceId,
          raceSourceId: row.sourceId,
          raceUrl: row.raceUrl,
          date: isoDate(row.date),
          trackCode: row.trackCode,
          trackName: row.trackName,
          raceName: row.raceName,
          finishText: row.finishText,
          finishingPosition: row.finishingPosition,
          starters: row.starters,
          boxNumber: row.boxNumber,
          weight: row.weight,
          distance: row.distance,
          grade: row.grade,
          runningTime: row.runningTime,
          winnerTime: row.winnerTime,
          bestOfNightTime: row.bestOfNightTime,
          firstSectional: row.firstSectional,
          margin: row.margin,
          winnerDogName: row.winnerDogName,
          winnerDogSourceId: row.winnerDogSourceId,
          inRunningPositions: row.inRunningPositions,
          startingPrice: row.startingPrice,
          hasVideo: row.hasVideo ?? false,
          sourceRawJson: options.includeRawJson ? row.sourceRawJson : undefined,
        });
        counts.profileFormRows += 1;
      }
    } catch (error) {
      counts.invalidProfiles += 1;
      await invalidWriter.write({
        kind: "dog-profile",
        sourceId: candidate.sourceId,
        path: candidate.profilePath,
        error: errorMessage(error),
      });
    }
  }
}

async function exportRaces(
  options: Options,
  meetingWriter: JsonlWriter,
  raceWriter: JsonlWriter,
  runnerWriter: JsonlWriter,
  invalidWriter: JsonlWriter,
  counts: ExportCounts
) {
  const candidates = (await scanRawArchives(options.rawDir)).filter(
    (item) => (!options.from || item.date >= options.from) && (!options.to || item.date <= options.to)
  );
  const selected = options.limitRaceDays > 0 ? candidates.slice(0, options.limitRaceDays) : candidates;

  for (const candidate of selected) {
    counts.raceRawFiles += 1;
    try {
      const archive = JSON.parse(await readFile(candidate.rawPath, "utf8")) as RawArchive;
      if (archive.source && archive.source !== "thedogs") {
        throw new Error(`unsupported source=${String(archive.source)}`);
      }
      for (const meeting of archive.meetings ?? []) {
        const meetingSourceId = meeting.sourceId ?? `${candidate.date}:${meeting.trackName}`;
        await meetingWriter.write({
          date: candidate.date,
          sourceProvider: meeting.sourceProvider ?? "thedogs",
          sourceId: meetingSourceId,
          trackName: meeting.trackName,
          state: meeting.state,
          meetingDate: isoDate(meeting.meetingDate),
          meetingType: meeting.meetingType,
          races: meeting.races.length,
          rawPath: candidate.rawPath,
          rawBytes: candidate.bytes,
          sourceRawJson: options.includeRawJson ? meeting.sourceRawJson : undefined,
        });
        counts.meetingRows += 1;

        for (const race of meeting.races) {
          const raceSourceId = race.sourceId ?? `${meetingSourceId}:race:${race.raceNumber}`;
          await raceWriter.write({
            date: candidate.date,
            meetingSourceId,
            trackName: meeting.trackName,
            state: meeting.state,
            sourceProvider: race.sourceProvider ?? meeting.sourceProvider ?? "thedogs",
            sourceId: raceSourceId,
            raceNumber: race.raceNumber,
            name: race.name,
            raceTime: isoDate(race.raceTime),
            distance: race.distance,
            grade: race.grade,
            prizeMoney: race.prizeMoney,
            resultStatus: race.resultStatus,
            replayUrl: race.replayUrl,
            photoFinishUrl: race.photoFinishUrl,
            runners: race.runners.length,
            sourceRawJson: options.includeRawJson ? race.sourceRawJson : undefined,
          });
          counts.raceRows += 1;

          for (const runner of race.runners) {
            await runnerWriter.write({
              date: candidate.date,
              meetingSourceId,
              raceSourceId,
              trackName: meeting.trackName,
              state: meeting.state,
              raceNumber: race.raceNumber,
              raceTime: isoDate(race.raceTime),
              raceName: race.name,
              distance: race.distance,
              grade: race.grade,
              boxNumber: runner.boxNumber,
              dogName: runner.dog.name,
              dogEarBrand: runner.dog.earBrand,
              dogSex: runner.dog.sex,
              dogColour: runner.dog.colour,
              trainerName: runner.trainerName,
              weight: runner.weight,
              startingPrice: runner.startingPrice,
              scratched: runner.scratched ?? false,
              finishingPosition: runner.finishingPosition,
              runningTime: runner.runningTime,
              margin: runner.margin,
              splitTime: runner.splitTime,
              sectionals: runner.sectionals,
              sourceProvider: runner.sourceProvider ?? race.sourceProvider ?? meeting.sourceProvider ?? "thedogs",
              sourceId: runner.sourceId,
              sourceRawJson: options.includeRawJson ? runner.sourceRawJson : undefined,
            });
            counts.raceRunnerRows += 1;
          }
        }
      }
    } catch (error) {
      counts.invalidRaceFiles += 1;
      await invalidWriter.write({
        kind: "race-day",
        date: candidate.date,
        path: candidate.rawPath,
        error: errorMessage(error),
      });
    }
  }
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
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
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

async function scanRawArchives(rawDir: string) {
  const files: RawCandidate[] = [];
  await collectRawArchives(rawDir, rawDir, files);
  return files.sort((a, b) => a.date.localeCompare(b.date));
}

async function collectRawArchives(rootDir: string, currentDir: string, files: RawCandidate[]) {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
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

function dateFromRawPath(rootDir: string, rawPath: string) {
  const relative = path.relative(rootDir, rawPath);
  const parts = relative.split(path.sep);
  if (parts.length !== 3) return null;
  const [year, month, fileName] = parts;
  const day = fileName.replace(/\.json$/i, "");
  const date = `${year}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function exportPaths(outDir: string) {
  return {
    profileRows: path.join(outDir, "thedogs-dog-profiles-latest.jsonl"),
    profileRowsTmp: path.join(outDir, "thedogs-dog-profiles-latest.jsonl.tmp"),
    profileFormRows: path.join(outDir, "thedogs-dog-form-rows-latest.jsonl"),
    profileFormRowsTmp: path.join(outDir, "thedogs-dog-form-rows-latest.jsonl.tmp"),
    meetings: path.join(outDir, "thedogs-meetings-latest.jsonl"),
    meetingsTmp: path.join(outDir, "thedogs-meetings-latest.jsonl.tmp"),
    races: path.join(outDir, "thedogs-races-latest.jsonl"),
    racesTmp: path.join(outDir, "thedogs-races-latest.jsonl.tmp"),
    raceRunners: path.join(outDir, "thedogs-race-runners-latest.jsonl"),
    raceRunnersTmp: path.join(outDir, "thedogs-race-runners-latest.jsonl.tmp"),
    invalid: path.join(outDir, "thedogs-export-invalid-latest.jsonl"),
    invalidTmp: path.join(outDir, "thedogs-export-invalid-latest.jsonl.tmp"),
    manifest: path.join(outDir, "thedogs-export-manifest-latest.json"),
  };
}

async function promoteOutputs(paths: ReturnType<typeof exportPaths>, options: Options) {
  const moves: Array<[string, string]> = [[paths.invalidTmp, paths.invalid]];
  if (options.profiles) {
    moves.push([paths.profileRowsTmp, paths.profileRows], [paths.profileFormRowsTmp, paths.profileFormRows]);
  }
  if (options.races) {
    moves.push(
      [paths.meetingsTmp, paths.meetings],
      [paths.racesTmp, paths.races],
      [paths.raceRunnersTmp, paths.raceRunners]
    );
  }
  for (const [from, to] of moves) await rename(from, to);
}

type JsonlWriter = {
  write(record: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
};

function writer(filePath: string): JsonlWriter {
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  return {
    async write(record) {
      const line = `${JSON.stringify(dropUndefined(record))}\n`;
      if (!stream.write(line)) await once(stream, "drain");
    },
    async close() {
      await closeStream(stream);
    },
  };
}

function closeStream(stream: WriteStream) {
  return new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}

function dropUndefined(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function isoDate(value: unknown) {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : date.toISOString();
  }
  return undefined;
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  const profilesOnly = values.has("profiles-only");
  const racesOnly = values.has("races-only");
  const from = stringOption(values, "from");
  const to = stringOption(values, "to");
  if (from) assertDate(from, "--from");
  if (to) assertDate(to, "--to");
  if (profilesOnly && racesOnly) throw new Error("Use only one of --profiles-only or --races-only");

  return {
    profileDir: stringOption(values, "profile-dir") ?? DEFAULT_PROFILE_DIR,
    rawDir: stringOption(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    outDir: stringOption(values, "out-dir") ?? DEFAULT_OUT_DIR,
    profiles: !racesOnly,
    races: !profilesOnly,
    from,
    to,
    limitProfiles: nonNegativeInt(stringOption(values, "limit-profiles"), 0),
    limitRaceDays: nonNegativeInt(stringOption(values, "limit-race-days"), 0),
    includeRawJson: values.has("include-raw-json"),
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

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error("[export:thedogs:datasets] failed:", error);
  process.exitCode = 1;
});
