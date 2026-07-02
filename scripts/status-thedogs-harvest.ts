/**
 * Compact operational status for The Dogs race and dog-profile harvest.
 *
 * This is read-only except for the optional short database preflight.
 *
 * Examples:
 *   npm run status:thedogs:harvest
 *   npm run status:thedogs:harvest -- --skip-db
 *   npm run status:thedogs:harvest -- --skip-db --write-snapshot
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const BACKFILL_DIR = ".backfill";
const LOG_DIR = path.join(BACKFILL_DIR, "logs");
const REPORT_DIR = path.join(BACKFILL_DIR, "reports");
const RAW_DIR = path.join(BACKFILL_DIR, "thedogs-raw");
const PROFILE_RAW_DIR = path.join(BACKFILL_DIR, "thedogs-dog-profiles-raw");
const SHARD_MANIFEST = path.join(BACKFILL_DIR, "thedogs-shards-manifest.json");
const PROFILE_PROGRESS = path.join(BACKFILL_DIR, "thedogs-dog-profile-raw-progress.jsonl");
const RAW_IMPORT_PROGRESS = path.join(BACKFILL_DIR, "thedogs-raw-import-progress.jsonl");
const RAW_ARCHIVE_IMPORT_PROGRESS = path.join(
  BACKFILL_DIR,
  "thedogs-raw-archive-import-progress.jsonl"
);
const PROFILE_IMPORT_PROGRESS = path.join(
  BACKFILL_DIR,
  "thedogs-dog-profile-import-progress.jsonl"
);
const RACE_VIDEO_PROGRESS = path.join(BACKFILL_DIR, "thedogs-race-video-progress.jsonl");
const DEFAULT_FLOOR = process.env.THEDOGS_BACKFILL_FROM ?? "2006-08-01";
const TARGET_TO = formatSydneyDate(new Date());

type Options = {
  skipDb: boolean;
  dbTimeoutMs: number;
  compact: boolean;
  writeSnapshot: boolean;
};

type ShardManifest = {
  workers?: number;
  logicalShards?: number;
  queuePid?: number;
  queueStatus?: string;
  completedAt?: string;
  shards?: ShardRecord[];
};

type ShardRecord = {
  id: number;
  pid: number;
  state?: "queued" | "running" | "completed" | "failed" | "stopped";
  progressFile: string;
  errLog: string;
  outLog: string;
  from: string;
  to: string;
};

type RaceProgressRecord = {
  date?: string;
  ok?: boolean;
  loggedAt?: string;
  meetings?: number;
  races?: number;
  runners?: number;
  results?: number;
  rawPath?: string;
  rawOnly?: boolean;
  error?: string;
};

type ProfileProgressRecord = {
  sourceId?: string;
  name?: string;
  ok?: boolean;
  archived?: boolean;
  outputPath?: string;
  durationMs?: number;
  attempts?: number;
  formRows?: number;
  raceAppearances?: number;
  loggedAt?: string;
  error?: string;
};

type ImportProgressRecord = {
  date?: string;
  sourceId?: string;
  ok?: boolean;
  imported?: boolean;
  dryRun?: boolean;
  loggedAt?: string;
  error?: string;
};

type RaceVideoProgressRecord = {
  raceId?: string;
  videoSourceId?: string;
  ok?: boolean;
  dryRun?: boolean;
  streamUrl?: string | null;
  status?: number | null;
  code?: string | null;
  loggedAt?: string;
  error?: string;
};

type ProcessMatch = {
  processId: number;
  name: string;
  commandLine: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const manifest = await readManifest();

  const [
    rawArchive,
    raceProgress,
    raceShards,
    profileProgressFiles,
    profileFiles,
    profileProcesses,
    rawImportProgress,
    rawArchiveImportProgress,
    profileImportProgress,
    importProcesses,
  ] =
    await Promise.all([
      scanDateArchive(RAW_DIR),
      summarizeRaceProgress(manifest),
      summarizeRaceShards(manifest),
      findProfileProgressFiles(),
      scanJsonFiles(PROFILE_RAW_DIR),
      findProcesses(["backfill:thedogs:dog-profile-raw", "backfill-thedogs-dog-profile-raw.ts"]),
      summarizeImportProgress(RAW_IMPORT_PROGRESS, "date"),
      findRawArchiveImportProgressFiles().then((files) => summarizeImportProgress(files, "date")),
      summarizeImportProgress(PROFILE_IMPORT_PROGRESS, "sourceId"),
      findProcesses([
        "supervise:thedogs:imports",
        "supervise-thedogs-import-replay.ts",
        "supervise:thedogs:race-day-archive",
        "supervise-thedogs-race-day-archive-import.ts",
        "import-thedogs-raw-history.ts",
        "import-thedogs-race-day-archive.ts",
        "import-thedogs-dog-profile-raw.ts",
      ]),
    ]);
  const profileProgress = await summarizeProfileProgress(profileProgressFiles);
  const profileSupervisors = await findProcesses([
    "supervise:thedogs:dog-profile-raw",
    "supervise-thedogs-profile-raw.ts",
    "supervise:thedogs:dog-profile-import",
    "supervise-thedogs-dog-profile-import.ts",
  ]);
  const raceVideoProgressFiles = await findRaceVideoProgressFiles();
  const raceVideoProgress = await summarizeRaceVideoProgress(raceVideoProgressFiles);
  const raceVideoProcesses = await findProcesses([
    "backfill:thedogs:race-videos",
    "backfill-thedogs-race-videos.ts",
  ]);

  const database = options.skipDb
    ? { checked: false, skipped: true }
    : await runDatabasePreflight(options.dbTimeoutMs);

  const status = {
    generatedAt: new Date().toISOString(),
    raceArchive: {
      ...rawArchive,
      progress: raceProgress,
      shards: raceShards,
    },
    dogProfiles: {
      ...profileProgress,
      archiveFiles: profileFiles.files,
      archiveBytes: profileFiles.bytes,
      currentProcesses: profileProcesses.map((process) => ({
        processId: process.processId,
        name: process.name,
      })),
      supervisors: profileSupervisors.map((process) => ({
        processId: process.processId,
        name: process.name,
      })),
    },
    imports: {
      raw: rawImportProgress,
      raceDayArchive: rawArchiveImportProgress,
      dogProfiles: profileImportProgress,
      currentProcesses: importProcesses.map((process) => ({
        processId: process.processId,
        name: process.name,
      })),
    },
    raceVideos: {
      ...raceVideoProgress,
      currentProcesses: raceVideoProcesses.map((process) => ({
        processId: process.processId,
        name: process.name,
      })),
    },
    logs: {
      raceShardErrors: await summarizeShardErrorLogs(manifest),
      latestDogProfileErrorLogs: await latestLogs("thedogs-dog-profile-raw-*.err.log", 5),
      latestDogProfileSupervisorLogs: await latestLogs("thedogs-profile-supervisor-*.out.log", 3),
      latestDogProfileShardSupervisorLogs: await latestLogs(
        "thedogs-profile-raw-shards-supervisor-*.out.log",
        3
      ),
      latestDogProfileImportSupervisorLogs: await latestLogs(
        "thedogs-dog-profile-import-supervisor-*.out.log",
        3
      ),
      latestDogProfileImportSupervisorErrorLogs: await latestLogs(
        "thedogs-dog-profile-import-supervisor-*.err.log",
        3
      ),
      latestRaceDayArchiveSupervisorLogs: await latestLogs(
        "thedogs-race-day-archive-supervisor-*.out.log",
        3
      ),
      latestRaceDayArchiveShardErrorLogs: await latestLogs(
        "thedogs-race-day-archive-import-shard-*.err.log",
        5
      ),
      latestImportSupervisorLogs: await latestLogs("thedogs-import-supervisor-*.out.log", 3),
      latestImportSupervisorErrorLogs: await latestLogs("thedogs-import-supervisor-*.err.log", 3),
      latestRaceVideoLogs: await latestLogs("thedogs-race-video-*.out.log", 5),
      latestRaceVideoErrorLogs: await latestLogs("thedogs-race-video-*.err.log", 5),
    },
    database,
  };

  const output = options.writeSnapshot
    ? {
        ...status,
        snapshot: await writeStatusSnapshot(status),
      }
    : status;

  console.log(JSON.stringify(output, null, options.compact ? 0 : 2));
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    skipDb: false,
    dbTimeoutMs: 15_000,
    compact: false,
    writeSnapshot: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--skip-db") {
      options.skipDb = true;
    } else if (arg === "--compact") {
      options.compact = true;
    } else if (arg === "--write-snapshot") {
      options.writeSnapshot = true;
    } else if (arg === "--db-timeout-ms") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--db-timeout-ms must be a positive number");
      }
      options.dbTimeoutMs = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function writeStatusSnapshot(status: Record<string, unknown>) {
  await mkdir(REPORT_DIR, { recursive: true });
  const generatedAt =
    typeof status.generatedAt === "string" ? status.generatedAt : new Date().toISOString();
  const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const snapshotPath = path.join(REPORT_DIR, `thedogs-harvest-status-${stamp}.json`);
  const latestPath = path.join(REPORT_DIR, "thedogs-harvest-status-latest.json");
  const snapshot = {
    snapshotPath,
    latestPath,
    writtenAt: new Date().toISOString(),
  };
  const body = `${JSON.stringify({ ...status, snapshot }, null, 2)}\n`;
  await writeFile(snapshotPath, body);
  await writeFile(latestPath, body);
  return snapshot;
}

async function readManifest() {
  if (!existsSync(SHARD_MANIFEST)) return null;
  return JSON.parse(await readFile(SHARD_MANIFEST, "utf8")) as ShardManifest;
}

async function summarizeRaceShards(manifest: ShardManifest | null) {
  if (!manifest) {
    return {
      manifestFound: false,
      activeWorkers: 0,
      logicalShards: 0,
      runningShards: 0,
      failedShards: 0,
      completedShards: 0,
      queuedShards: 0,
      stoppedShards: 0,
    };
  }

  const shards = manifest.shards ?? [];
  const counts = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    stopped: 0,
  };
  for (const shard of shards) {
    const state = shard.state ?? "running";
    counts[state] += 1;
  }

  return {
    manifestFound: true,
    queuePid: manifest.queuePid ?? null,
    queueStatus: manifest.queueStatus ?? null,
    queueRunning: manifest.queuePid ? isProcessRunning(manifest.queuePid) : false,
    activeWorkers: manifest.workers ?? 0,
    logicalShards: manifest.logicalShards ?? shards.length,
    runningShards: counts.running,
    failedShards: counts.failed,
    completedShards: counts.completed,
    queuedShards: counts.queued,
    stoppedShards: counts.stopped,
    completedAt: manifest.completedAt ?? null,
    processRunningShards: shards.filter((shard) => isProcessRunning(shard.pid)).length,
  };
}

async function summarizeRaceProgress(manifest: ShardManifest | null) {
  const progressFiles = await findRaceProgressFiles(manifest);
  const records = await readJsonLines<RaceProgressRecord>(progressFiles);
  const latestByDate = new Map<string, RaceProgressRecord>();
  for (const record of records) {
    if (!record.date) continue;
    latestByDate.set(record.date, record);
  }

  const latestRecords = [...latestByDate.values()];
  const okDates = new Set(latestRecords.filter((record) => record.ok).map((record) => record.date));
  const failedDates = latestRecords.filter((record) => record.ok === false);
  const now = Date.now();
  const loggedDates = [...latestByDate.keys()].sort();

  return {
    progressFileCount: progressFiles.length,
    progressFiles,
    totalProgressRows: records.length,
    uniqueSuccessfulDates: okDates.size,
    unresolvedFailedDates: failedDates.length,
    historicalFailedAttempts: records.filter((record) => record.ok === false).length,
    currentRunFirstDate: loggedDates[0] ?? null,
    currentRunLatestDate: loggedDates.at(-1) ?? null,
    recentOkDates15m: countRecent(records, now, 15 * 60_000),
    recentOkDates60m: countRecent(records, now, 60 * 60_000),
    latestLog: latestByLoggedAt(records),
  };
}

async function findRaceProgressFiles(manifest: ShardManifest | null) {
  const files = new Set<string>();
  if (manifest?.shards && manifest.shards.length > 0) {
    for (const shard of manifest.shards) {
      if (existsSync(shard.progressFile)) files.add(shard.progressFile);
    }
    return [...files].sort();
  }

  const baseProgress = path.join(BACKFILL_DIR, "thedogs-history-progress.jsonl");
  if (existsSync(baseProgress)) files.add(baseProgress);
  if (existsSync(BACKFILL_DIR)) {
    for (const entry of await readdir(BACKFILL_DIR)) {
      if (/^thedogs-history.*\.jsonl$/i.test(entry)) {
        files.add(path.join(BACKFILL_DIR, entry));
      }
    }
  }
  return [...files].sort();
}

async function findProfileProgressFiles() {
  const files = new Set<string>();
  if (existsSync(PROFILE_PROGRESS)) files.add(PROFILE_PROGRESS);
  if (existsSync(BACKFILL_DIR)) {
    for (const entry of await readdir(BACKFILL_DIR)) {
      if (/^thedogs-dog-profile-raw.*\.jsonl$/i.test(entry)) {
        files.add(path.join(BACKFILL_DIR, entry));
      }
    }
  }
  return [...files].sort();
}

async function findRawArchiveImportProgressFiles() {
  const files = new Set<string>();
  if (existsSync(RAW_ARCHIVE_IMPORT_PROGRESS)) files.add(RAW_ARCHIVE_IMPORT_PROGRESS);
  if (existsSync(BACKFILL_DIR)) {
    for (const entry of await readdir(BACKFILL_DIR)) {
      if (/^thedogs-raw-archive-import.*\.jsonl$/i.test(entry)) {
        files.add(path.join(BACKFILL_DIR, entry));
      }
    }
  }
  return [...files].sort();
}

async function findRaceVideoProgressFiles() {
  const files = new Set<string>();
  if (existsSync(RACE_VIDEO_PROGRESS)) files.add(RACE_VIDEO_PROGRESS);
  if (existsSync(BACKFILL_DIR)) {
    for (const entry of await readdir(BACKFILL_DIR)) {
      if (/^thedogs-race-video.*\.jsonl$/i.test(entry)) {
        files.add(path.join(BACKFILL_DIR, entry));
      }
    }
  }
  return [...files].sort();
}

async function summarizeProfileProgress(progressFiles: string[]) {
  const records = await readJsonLines<ProfileProgressRecord>(progressFiles);
  const latestByDog = new Map<string, ProfileProgressRecord>();
  for (const record of records) {
    if (!record.sourceId) continue;
    const existing = latestByDog.get(record.sourceId);
    if (!existing || isNewerProgressRecord(record, existing)) {
      latestByDog.set(record.sourceId, record);
    }
  }

  const latest = [...latestByDog.values()];
  const now = Date.now();
  return {
    progressFile: PROFILE_PROGRESS,
    progressFiles,
    progressFileCount: progressFiles.length,
    progressFileFound: existsSync(PROFILE_PROGRESS),
    uniqueProfilesWithProgress: latest.length,
    latestOk: latest.filter((record) => record.ok).length,
    latestFailed: latest.filter((record) => record.ok === false).length,
    totalProgressRows: records.length,
    historicalFailedAttempts: records.filter((record) => record.ok === false).length,
    recentOkProfiles15m: countRecent(records, now, 15 * 60_000),
    recentOkProfiles60m: countRecent(records, now, 60 * 60_000),
    newestRecord: records.at(-1) ?? null,
  };
}

async function summarizeRaceVideoProgress(progressFiles: string[]) {
  const records = await readJsonLines<RaceVideoProgressRecord>(progressFiles);
  const latestByVideo = new Map<string, RaceVideoProgressRecord>();
  for (const record of records) {
    if (!record.videoSourceId) continue;
    const existing = latestByVideo.get(record.videoSourceId);
    if (!existing || isNewerProgressRecord(record, existing)) {
      latestByVideo.set(record.videoSourceId, record);
    }
  }

  const latest = [...latestByVideo.values()];
  const now = Date.now();
  return {
    progressFile: RACE_VIDEO_PROGRESS,
    progressFiles,
    progressFileCount: progressFiles.length,
    progressFileFound: progressFiles.some((progressFile) => existsSync(progressFile)),
    uniqueVideosWithProgress: latest.length,
    latestOk: latest.filter((record) => record.ok).length,
    latestFailed: latest.filter((record) => record.ok === false).length,
    latestWithStream: latest.filter((record) => record.ok && record.streamUrl).length,
    latestWithoutStream: latest.filter((record) => record.ok && !record.streamUrl).length,
    totalProgressRows: records.length,
    historicalFailedAttempts: records.filter((record) => record.ok === false).length,
    recentOkVideos15m: countRecent(records, now, 15 * 60_000),
    recentOkVideos60m: countRecent(records, now, 60 * 60_000),
    newestRecord: latestByLoggedAt(records),
  };
}

async function summarizeImportProgress(
  progressFileOrFiles: string | string[],
  key: "date" | "sourceId"
) {
  const progressFiles = Array.isArray(progressFileOrFiles)
    ? progressFileOrFiles
    : [progressFileOrFiles];
  const records = await readJsonLines<ImportProgressRecord>(progressFiles);
  const latestByKey = new Map<string, ImportProgressRecord>();
  for (const record of records) {
    const value = key === "date" ? record.date : record.sourceId;
    if (!value) continue;
    latestByKey.set(value, record);
  }

  const latest = [...latestByKey.values()];
  return {
    progressFile: progressFiles[0] ?? null,
    progressFiles,
    progressFileCount: progressFiles.length,
    progressFileFound: progressFiles.some((progressFile) => existsSync(progressFile)),
    uniqueRecordsWithProgress: latest.length,
    latestOk: latest.filter((record) => record.ok).length,
    latestImportedOk: latest.filter((record) => record.ok && record.imported && !record.dryRun)
      .length,
    latestDryRunOk: latest.filter((record) => record.ok && record.dryRun).length,
    latestFailed: latest.filter((record) => record.ok === false).length,
    totalProgressRows: records.length,
    newestRecord: latestByLoggedAt(records),
  };
}

async function scanDateArchive(rootDir: string) {
  const files: Array<{ date: string; bytes: number }> = [];
  if (!existsSync(rootDir)) {
    return emptyDateArchive(rootDir);
  }

  for (const year of await readdir(rootDir, { withFileTypes: true })) {
    if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
    const yearDir = path.join(rootDir, year.name);
    for (const month of await readdir(yearDir, { withFileTypes: true })) {
      if (!month.isDirectory() || !/^\d{2}$/.test(month.name)) continue;
      const monthDir = path.join(yearDir, month.name);
      for (const file of await readdir(monthDir, { withFileTypes: true })) {
        if (!file.isFile() || !/^\d{2}\.json$/i.test(file.name)) continue;
        const filePath = path.join(monthDir, file.name);
        const info = await stat(filePath);
        files.push({
          date: `${year.name}-${month.name}-${file.name.slice(0, 2)}`,
          bytes: info.size,
        });
      }
    }
  }

  files.sort((a, b) => a.date.localeCompare(b.date));
  const dateSet = new Set(files.map((file) => file.date));
  const targetFiles = files.filter((file) => file.date >= DEFAULT_FLOOR && file.date <= TARGET_TO);
  const targetDays = daysBetween(DEFAULT_FLOOR, TARGET_TO) + 1;
  const contiguousDate = contiguousThrough(DEFAULT_FLOOR, dateSet);
  const contiguousDays = contiguousDate ? daysBetween(DEFAULT_FLOOR, contiguousDate) + 1 : 0;

  return {
    rawDir: rootDir,
    targetFrom: DEFAULT_FLOOR,
    targetTo: TARGET_TO,
    targetDays,
    filesTotal: files.length,
    filesInTargetRange: targetFiles.length,
    missingTargetDays: Math.max(targetDays - targetFiles.length, 0),
    bytesTotal: files.reduce((sum, file) => sum + file.bytes, 0),
    observedFrom: files[0]?.date ?? null,
    observedTo: files.at(-1)?.date ?? null,
    contiguousThrough: contiguousDate,
    nextMissingDate: nextMissingAfter(DEFAULT_FLOOR, dateSet),
    coverageRate: ratio(targetFiles.length, targetDays),
    contiguousCoverageRate: ratio(contiguousDays, targetDays),
  };
}

function emptyDateArchive(rootDir: string) {
  const targetDays = daysBetween(DEFAULT_FLOOR, TARGET_TO) + 1;
  return {
    rawDir: rootDir,
    targetFrom: DEFAULT_FLOOR,
    targetTo: TARGET_TO,
    targetDays,
    filesTotal: 0,
    filesInTargetRange: 0,
    missingTargetDays: targetDays,
    bytesTotal: 0,
    observedFrom: null,
    observedTo: null,
    contiguousThrough: null,
    nextMissingDate: DEFAULT_FLOOR,
    coverageRate: 0,
    contiguousCoverageRate: 0,
  };
}

async function scanJsonFiles(rootDir: string) {
  let files = 0;
  let bytes = 0;
  if (!existsSync(rootDir)) return { files, bytes };

  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        files += 1;
        bytes += (await stat(entryPath)).size;
      }
    }
  }

  await walk(rootDir);
  return { files, bytes };
}

async function summarizeShardErrorLogs(manifest: ShardManifest | null) {
  const shards = manifest?.shards ?? [];
  const summaries = await Promise.all(
    shards.map(async (shard) => {
      const size = existsSync(shard.errLog) ? (await stat(shard.errLog)).size : 0;
      return {
        shard: shard.id,
        errLog: shard.errLog,
        bytes: size,
        tail: size > 0 ? await tailLines(shard.errLog, 5) : [],
      };
    })
  );
  return {
    nonEmpty: summaries.filter((summary) => summary.bytes > 0),
    checked: summaries.length,
  };
}

async function latestLogs(pattern: string, limit: number) {
  if (!existsSync(LOG_DIR)) return [];
  const regex = globPatternToRegex(pattern);
  const logs = [];
  for (const entry of await readdir(LOG_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !regex.test(entry.name)) continue;
    const filePath = path.join(LOG_DIR, entry.name);
    const info = await stat(filePath);
    logs.push({
      path: filePath,
      bytes: info.size,
      modifiedAt: info.mtime.toISOString(),
      tail: info.size > 0 ? await tailLines(filePath, 5) : [],
    });
  }
  return logs
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, limit);
}

function globPatternToRegex(pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

async function readJsonLines<T>(files: string[]) {
  const records: T[] = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const contents = await readFile(file, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line) as T);
      } catch {
        // Ignore partial lines from actively written progress files.
      }
    }
  }
  return records;
}

async function tailLines(file: string, count: number) {
  if (!existsSync(file)) return [];
  const contents = await readFile(file, "utf8");
  return contents.split(/\r?\n/).filter(Boolean).slice(-count);
}

function latestByLoggedAt<T extends { loggedAt?: string }>(records: T[]) {
  return records.reduce<T | null>((latest, record) => {
    if (!record.loggedAt) return latest;
    if (!latest?.loggedAt) return record;
    return Date.parse(record.loggedAt) > Date.parse(latest.loggedAt) ? record : latest;
  }, null);
}

function isNewerProgressRecord(
  candidate: { loggedAt?: string },
  existing: { loggedAt?: string }
) {
  const candidateTime = candidate.loggedAt ? Date.parse(candidate.loggedAt) : Number.NaN;
  const existingTime = existing.loggedAt ? Date.parse(existing.loggedAt) : Number.NaN;
  if (!Number.isFinite(candidateTime)) return !Number.isFinite(existingTime);
  if (!Number.isFinite(existingTime)) return true;
  return candidateTime >= existingTime;
}

function countRecent(records: Array<{ ok?: boolean; loggedAt?: string }>, now: number, windowMs: number) {
  return records.filter((record) => {
    if (!record.ok || !record.loggedAt) return false;
    const loggedAt = Date.parse(record.loggedAt);
    return Number.isFinite(loggedAt) && now - loggedAt <= windowMs;
  }).length;
}

function contiguousThrough(from: string, dates: Set<string | undefined>) {
  let cursor = dayValue(from);
  let latest: string | null = null;
  for (;;) {
    const date = formatDate(cursor);
    if (!dates.has(date)) return latest;
    latest = date;
    cursor += 86_400_000;
  }
}

function nextMissingAfter(from: string, dates: Set<string | undefined>) {
  const contiguous = contiguousThrough(from, dates);
  return contiguous == null ? from : formatDate(dayValue(contiguous) + 86_400_000);
}

function formatDate(value: number) {
  return new Date(value).toISOString().slice(0, 10);
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

function dayValue(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function daysBetween(from: string, to: string) {
  return Math.floor((dayValue(to) - dayValue(from)) / 86_400_000);
}

function ratio(value: number, total: number) {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

function isProcessRunning(pid: number | undefined) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function findProcesses(needles: string[]): Promise<ProcessMatch[]> {
  if (process.platform !== "win32") return [];
  const commandLineMatches = needles
    .map((needle) => `$_.CommandLine -like '*${needle.replace(/'/g, "''")}*'`)
    .join(" -or ");
  const script = [
    "Get-CimInstance Win32_Process |",
    `Where-Object { (${commandLineMatches}) -and $_.Name -notlike 'powershell*' -and $_.Name -ne 'pwsh.exe' } |`,
    "Select-Object ProcessId,Name,CommandLine |",
    "ConvertTo-Json -Depth 3",
  ].join(" ");
  const result = await runCommand("powershell.exe", ["-NoProfile", "-Command", script], 5_000);
  if (!result.ok || !result.stdout.trim()) return [];
  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .map((row) => normalizeProcessMatch(row))
      .filter((row): row is ProcessMatch => row != null);
  } catch {
    return [];
  }
}

function normalizeProcessMatch(value: unknown): ProcessMatch | null {
  if (value == null || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const processId = Number(row.ProcessId);
  const name = typeof row.Name === "string" ? row.Name : "";
  const commandLine = typeof row.CommandLine === "string" ? row.CommandLine : "";
  if (!Number.isFinite(processId) || !name || !commandLine) return null;
  return { processId, name, commandLine };
}

async function runDatabasePreflight(timeoutMs: number) {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx.cmd", "tsx", "scripts/preflight-import-database.ts"]
      : ["tsx", "scripts/preflight-import-database.ts"];
  const result = await runCommand(command, args, timeoutMs);
  return {
    checked: true,
    ok: result.ok,
    timedOut: result.timedOut,
    exitCode: result.exitCode,
    stdout: result.stdout.trim().slice(-1000),
    stderr: result.stderr.trim().slice(-2000),
  };
}

function runCommand(command: string, args: string[], timeoutMs: number) {
  return new Promise<{
    ok: boolean;
    timedOut: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        timedOut,
        exitCode: null,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: `${Buffer.concat(stderr).toString("utf8")}${error.message}`,
      });
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve({
        ok: !timedOut && code === 0,
        timedOut,
        exitCode: code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
