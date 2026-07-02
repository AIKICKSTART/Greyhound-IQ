/**
 * Compile the latest The Dogs archive evidence into one handoff report.
 *
 * Reads the latest harvest status, raw richness, and dog-profile richness
 * reports without touching active harvesters or the database.
 *
 * Examples:
 *   npm run report:thedogs:archive
 *   npm run report:thedogs:archive -- --output-dir .backfill/reports
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_REPORT_DIR = path.join(".backfill", "reports");

type Options = {
  outputDir: string;
  statusFile: string;
  rawRichnessFile: string;
  profileRichnessFile: string;
  archiveRangeFile: string;
};

type ReportSource<T> = {
  path: string;
  found: boolean;
  data: T | null;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const [status, rawRichness, profileRichness, archiveRange] = await Promise.all([
    readJsonReport<Record<string, unknown>>(options.statusFile),
    readJsonReport<Record<string, unknown>>(options.rawRichnessFile),
    readJsonReport<Record<string, unknown>>(options.profileRichnessFile),
    readJsonReport<Record<string, unknown>>(options.archiveRangeFile),
  ]);

  const compiled = compileReport({
    generatedAt: new Date().toISOString(),
    sources: {
      status: sourceSummary(status),
      rawRichness: sourceSummary(rawRichness),
      profileRichness: sourceSummary(profileRichness),
      archiveRange: sourceSummary(archiveRange),
    },
    status: status.data,
    rawRichness: rawRichness.data,
    profileRichness: profileRichness.data,
    archiveRange: archiveRange.data,
  });

  await mkdir(options.outputDir, { recursive: true });
  const jsonPath = path.join(options.outputDir, "thedogs-archive-summary-latest.json");
  const markdownPath = path.join(options.outputDir, "thedogs-archive-summary-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(compiled, null, 2)}\n`);
  await writeFile(markdownPath, renderMarkdown(compiled));

  console.log(
    JSON.stringify(
      {
        written: true,
        jsonPath,
        markdownPath,
        generatedAt: compiled.generatedAt,
        coverageRate: compiled.raceArchive.coverageRate,
        rawRaceFiles: compiled.raceArchive.filesInTargetRange,
        dogProfileFiles: compiled.dogProfiles.filesTotal,
      },
      null,
      2
    )
  );
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

  const outputDir = stringOption(values, "output-dir") ?? DEFAULT_REPORT_DIR;
  return {
    outputDir,
    statusFile: stringOption(values, "status-file") ?? path.join(outputDir, "thedogs-harvest-status-latest.json"),
    rawRichnessFile:
      stringOption(values, "raw-richness-file") ?? path.join(outputDir, "thedogs-raw-richness-latest.json"),
    profileRichnessFile:
      stringOption(values, "profile-richness-file") ??
      path.join(outputDir, "thedogs-dog-profile-richness-latest.json"),
    archiveRangeFile:
      stringOption(values, "archive-range-file") ??
      path.join(outputDir, "thedogs-archive-range-latest.json"),
  };
}

async function readJsonReport<T>(filePath: string): Promise<ReportSource<T>> {
  if (!existsSync(filePath)) {
    return { path: filePath, found: false, data: null };
  }
  const data = JSON.parse(await readFile(filePath, "utf8")) as T;
  return { path: filePath, found: true, data };
}

function sourceSummary(source: ReportSource<unknown>) {
  return {
    path: source.path,
    found: source.found,
  };
}

function compileReport(input: {
  generatedAt: string;
  sources: Record<string, { path: string; found: boolean }>;
  status: Record<string, unknown> | null;
  rawRichness: Record<string, unknown> | null;
  profileRichness: Record<string, unknown> | null;
  archiveRange: Record<string, unknown> | null;
}) {
  const statusRaceArchive = getRecord(input.status, "raceArchive");
  const statusDogProfiles = getRecord(input.status, "dogProfiles");
  const statusLogs = getRecord(input.status, "logs");
  const statusDatabase = getRecord(input.status, "database");
  const rawSummary = getRecord(input.rawRichness, "summary");
  const profileSummary = getRecord(input.profileRichness, "summary");
  const rawRates = getRecord(rawSummary, "richnessRates");
  const profileRates = getRecord(profileSummary, "richnessRates");

  const archiveRange = {
    rangeFrom: stringValue(input.archiveRange, "rangeFrom"),
    rangeTo: stringValue(input.archiveRange, "rangeTo"),
    datesScanned: numberValue(input.archiveRange, "datesScanned"),
    successfulFetches: numberValue(input.archiveRange, "successfulFetches"),
    failedFetches: numberValue(input.archiveRange, "failedFetches"),
    datesWithMeetings: numberValue(input.archiveRange, "datesWithMeetings"),
    firstDateWithMeetings: stringValue(input.archiveRange, "firstDateWithMeetings"),
    lastDateWithMeetings: stringValue(input.archiveRange, "lastDateWithMeetings"),
    leadingEmptyDates: numberValue(input.archiveRange, "leadingEmptyDates"),
  };

  const raceArchive = {
    targetFrom: stringValue(statusRaceArchive, "targetFrom"),
    targetTo: stringValue(statusRaceArchive, "targetTo"),
    targetDays: numberValue(statusRaceArchive, "targetDays"),
    filesInTargetRange: numberValue(statusRaceArchive, "filesInTargetRange"),
    missingTargetDays: numberValue(statusRaceArchive, "missingTargetDays"),
    coverageRate: numberValue(statusRaceArchive, "coverageRate"),
    contiguousThrough: stringValue(statusRaceArchive, "contiguousThrough"),
    nextMissingDate: stringValue(statusRaceArchive, "nextMissingDate"),
    bytesTotal: numberValue(statusRaceArchive, "bytesTotal"),
    invalidFiles: numberValue(rawSummary, "invalidFiles"),
    tracks: numberValue(rawSummary, "tracks"),
    states: arrayValue(rawSummary, "states"),
    dogs: numberValue(rawSummary, "dogs"),
    trainers: numberValue(rawSummary, "trainers"),
    meetings: numberValue(rawSummary, "meetings"),
    races: numberValue(rawSummary, "races"),
    runners: numberValue(rawSummary, "runners"),
    resultRows: numberValue(rawSummary, "resultRows"),
    runnersWithWeight: numberValue(rawSummary, "runnersWithWeight"),
    runnersWithStartingPrice: numberValue(rawSummary, "runnersWithStartingPrice"),
    runnersWithRunningTime: numberValue(rawSummary, "runnersWithRunningTime"),
    runnersWithMargin: numberValue(rawSummary, "runnersWithMargin"),
    runnersWithSectionals: numberValue(rawSummary, "runnersWithSectionals"),
    racesWithPrizeMoney: numberValue(rawSummary, "racesWithPrizeMoney"),
    racesWithReplay: numberValue(rawSummary, "racesWithReplay"),
    richnessRates: {
      runnerWeight: numberValue(rawRates, "runnerWeight"),
      startingPrice: numberValue(rawRates, "startingPrice"),
      runningTime: numberValue(rawRates, "runningTime"),
      margin: numberValue(rawRates, "margin"),
      sectionals: numberValue(rawRates, "sectionals"),
      prizeMoney: numberValue(rawRates, "prizeMoney"),
      replay: numberValue(rawRates, "replay"),
    },
  };

  const dogProfiles = {
    filesTotal: numberValue(profileSummary, "filesTotal"),
    filesInvalid: numberValue(profileSummary, "filesInvalid"),
    sourceIdMismatches: numberValue(profileSummary, "sourceIdMismatches"),
    bytes: numberValue(profileSummary, "bytes"),
    progressUniqueDogs: numberValue(profileSummary, "progressUniqueDogs"),
    progressLatestOk: numberValue(profileSummary, "progressLatestOk"),
    progressLatestFailed: numberValue(profileSummary, "progressLatestFailed"),
    tracks: numberValue(profileSummary, "tracks"),
    trainers: numberValue(profileSummary, "trainers"),
    owners: numberValue(profileSummary, "owners"),
    sires: numberValue(profileSummary, "sires"),
    dams: numberValue(profileSummary, "dams"),
    parsedProfiles: numberValue(profileSummary, "parsedProfiles"),
    formRows: numberValue(profileSummary, "formRows"),
    uniqueFormRaceUrls: numberValue(profileSummary, "uniqueFormRaceUrls"),
    rowsWithWeight: numberValue(profileSummary, "rowsWithWeight"),
    rowsWithRunningTime: numberValue(profileSummary, "rowsWithRunningTime"),
    rowsWithMargin: numberValue(profileSummary, "rowsWithMargin"),
    rowsWithStartingPrice: numberValue(profileSummary, "rowsWithStartingPrice"),
    rowsWithVideo: numberValue(profileSummary, "rowsWithVideo"),
    activeProcesses: arrayValue(statusDogProfiles, "currentProcesses").length,
    supervisorProcesses: arrayValue(statusDogProfiles, "supervisors").length,
    richnessRates: {
      profileHtml: numberValue(profileRates, "profileHtml"),
      fullFormHtml: numberValue(profileRates, "fullFormHtml"),
      rowWeight: numberValue(profileRates, "rowWeight"),
      rowRunningTime: numberValue(profileRates, "rowRunningTime"),
      rowMargin: numberValue(profileRates, "rowMargin"),
      rowStartingPrice: numberValue(profileRates, "rowStartingPrice"),
      rowVideo: numberValue(profileRates, "rowVideo"),
    },
  };

  const raceShardErrors = arrayValue(getRecord(statusLogs, "raceShardErrors"), "nonEmpty");
  const blockers = [];
  if (numberValue(statusRaceArchive, "missingTargetDays") > 0) {
    blockers.push("raw_archive_incomplete");
  }
  if (numberValue(profileSummary, "filesInvalid") > 0) {
    blockers.push("invalid_profile_files");
  }
  if (numberValue(rawSummary, "invalidFiles") > 0) {
    blockers.push("invalid_raw_files");
  }
  const databaseChecked = booleanValue(statusDatabase, "checked");
  const databaseOk = booleanValue(statusDatabase, "ok");
  if (databaseChecked && !databaseOk) {
    blockers.push("database_import_unavailable");
  }

  return {
    generatedAt: input.generatedAt,
    sources: input.sources,
    archiveRange,
    raceArchive,
    dogProfiles,
    health: {
      raceShardErrors: raceShardErrors.length,
      raceWorkersRunning: numberValue(getRecord(statusRaceArchive, "shards"), "processRunningShards"),
      raceWorkersExpected: numberValue(getRecord(statusRaceArchive, "shards"), "logicalShards"),
      profileWorkersRunning: dogProfiles.activeProcesses,
      profileSupervisorsRunning: dogProfiles.supervisorProcesses,
      databaseChecked,
      databaseOk: databaseChecked ? databaseOk : null,
    },
    blockers,
  };
}

function renderMarkdown(report: ReturnType<typeof compileReport>) {
  return [
    "# The Dogs Archive Summary",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Race Archive",
    "",
    `- Coverage: ${percent(report.raceArchive.coverageRate)} (${formatNumber(report.raceArchive.filesInTargetRange)} of ${formatNumber(report.raceArchive.targetDays)} target days)`,
    `- Missing target days: ${formatNumber(report.raceArchive.missingTargetDays)}`,
    `- Contiguous through: ${report.raceArchive.contiguousThrough ?? "n/a"}`,
    `- Raw size: ${formatBytes(report.raceArchive.bytesTotal)}`,
    `- Meetings: ${formatNumber(report.raceArchive.meetings)}`,
    `- Races: ${formatNumber(report.raceArchive.races)}`,
    `- Runners: ${formatNumber(report.raceArchive.runners)}`,
    `- Dogs observed: ${formatNumber(report.raceArchive.dogs)}`,
    `- Trainers observed: ${formatNumber(report.raceArchive.trainers)}`,
    `- Invalid raw files: ${formatNumber(report.raceArchive.invalidFiles)}`,
    "",
    "## Archive Range Evidence",
    "",
    `- Scanned range: ${report.archiveRange.rangeFrom ?? "n/a"} to ${report.archiveRange.rangeTo ?? "n/a"}`,
    `- First date with meetings: ${report.archiveRange.firstDateWithMeetings ?? "n/a"}`,
    `- Last scanned date with meetings: ${report.archiveRange.lastDateWithMeetings ?? "n/a"}`,
    `- Dates scanned: ${formatNumber(report.archiveRange.datesScanned)}`,
    `- Empty dates before first meeting: ${formatNumber(report.archiveRange.leadingEmptyDates)}`,
    `- Failed fetches: ${formatNumber(report.archiveRange.failedFetches)}`,
    "",
    "## Race Richness",
    "",
    `- Runner weight: ${percent(report.raceArchive.richnessRates.runnerWeight)}`,
    `- Starting price: ${percent(report.raceArchive.richnessRates.startingPrice)}`,
    `- Running time: ${percent(report.raceArchive.richnessRates.runningTime)}`,
    `- Margin: ${percent(report.raceArchive.richnessRates.margin)}`,
    `- Sectionals: ${percent(report.raceArchive.richnessRates.sectionals)}`,
    `- Prize money: ${percent(report.raceArchive.richnessRates.prizeMoney)}`,
    `- Replay: ${percent(report.raceArchive.richnessRates.replay)}`,
    "",
    "## Dog Profiles",
    "",
    `- Profile files: ${formatNumber(report.dogProfiles.filesTotal)}`,
    `- Invalid profile files: ${formatNumber(report.dogProfiles.filesInvalid)}`,
    `- Source ID mismatches: ${formatNumber(report.dogProfiles.sourceIdMismatches)}`,
    `- Profile archive size: ${formatBytes(report.dogProfiles.bytes)}`,
    `- Parsed profiles: ${formatNumber(report.dogProfiles.parsedProfiles)}`,
    `- Form rows: ${formatNumber(report.dogProfiles.formRows)}`,
    `- Unique form race URLs: ${formatNumber(report.dogProfiles.uniqueFormRaceUrls)}`,
    `- Rows with weight: ${formatNumber(report.dogProfiles.rowsWithWeight)}`,
    `- Rows with running time: ${formatNumber(report.dogProfiles.rowsWithRunningTime)}`,
    `- Rows with margin: ${formatNumber(report.dogProfiles.rowsWithMargin)}`,
    `- Rows with starting price: ${formatNumber(report.dogProfiles.rowsWithStartingPrice)}`,
    `- Rows with video: ${formatNumber(report.dogProfiles.rowsWithVideo)}`,
    "",
    "## Health",
    "",
    `- Race workers: ${formatNumber(report.health.raceWorkersRunning)} / ${formatNumber(report.health.raceWorkersExpected)}`,
    `- Race shard errors: ${formatNumber(report.health.raceShardErrors)}`,
    `- Profile worker processes: ${formatNumber(report.health.profileWorkersRunning)}`,
    `- Profile supervisor processes: ${formatNumber(report.health.profileSupervisorsRunning)}`,
    `- Blockers: ${report.blockers.length > 0 ? report.blockers.join(", ") : "none"}`,
    "",
    "## Sources",
    "",
    ...Object.entries(report.sources).map(
      ([name, source]) => `- ${name}: ${source.found ? source.path : "missing"}`
    ),
    "",
  ].join("\n");
}

function getRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const nested = value[key];
  return isRecord(nested) ? nested : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function stringValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function numberValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function booleanValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : false;
}

function arrayValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatBytes(value: number) {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

main().catch((error) => {
  console.error("[report:thedogs:archive] failed:", error);
  process.exitCode = 1;
});
