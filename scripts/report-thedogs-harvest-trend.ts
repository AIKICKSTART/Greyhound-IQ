/**
 * Trend report for the long-running The Dogs raw archive harvest.
 *
 * It reads status snapshots produced by:
 *   npm run status:thedogs:harvest -- --skip-db --write-snapshot
 *
 * Examples:
 *   npm run report:thedogs:trend
 *   npm run report:thedogs:trend -- --window-minutes 15,60,180 --write-report
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const REPORT_DIR = path.join(".backfill", "reports");
const DEFAULT_WINDOWS = [15, 60, 180];

type Options = {
  windowMinutes: number[];
  writeReport: boolean;
  compact: boolean;
};

type StatusSnapshot = {
  generatedAt: string;
  raceArchive?: {
    targetDays?: number;
    filesTotal?: number;
    filesInTargetRange?: number;
    missingTargetDays?: number;
    coverageRate?: number;
    observedFrom?: string | null;
    observedTo?: string | null;
    contiguousThrough?: string | null;
    shards?: {
      runningShards?: number;
      processRunningShards?: number;
      failedShards?: number;
    };
  };
  dogProfiles?: {
    archiveFiles?: number;
    uniqueProfilesWithProgress?: number;
    latestOk?: number;
    latestFailed?: number;
    progressFileCount?: number;
  };
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const snapshots = await readSnapshots();
  if (snapshots.length < 2) {
    throw new Error("Need at least two status snapshots to calculate trend");
  }

  const latest = snapshots.at(-1) as StatusSnapshot;
  const windows = options.windowMinutes.map((minutes) =>
    summarizeWindow(snapshots, latest, minutes)
  );
  const report = {
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    oldestSnapshotAt: snapshots[0]?.generatedAt ?? null,
    latestSnapshotAt: latest.generatedAt,
    current: {
      raceFiles: raceFileCount(latest) ?? 0,
      raceMissingDays: latest.raceArchive?.missingTargetDays ?? null,
      raceCoverageRate: latest.raceArchive?.coverageRate ?? null,
      raceObservedFrom: latest.raceArchive?.observedFrom ?? null,
      raceObservedTo: latest.raceArchive?.observedTo ?? null,
      raceContiguousThrough: latest.raceArchive?.contiguousThrough ?? null,
      raceRunningShards:
        latest.raceArchive?.shards?.processRunningShards ??
        latest.raceArchive?.shards?.runningShards ??
        null,
      raceFailedShards: latest.raceArchive?.shards?.failedShards ?? null,
      dogProfileArchiveFiles: latest.dogProfiles?.archiveFiles ?? 0,
      dogProfileProgressOk: latest.dogProfiles?.latestOk ?? null,
      dogProfileLatestFailed: latest.dogProfiles?.latestFailed ?? null,
      dogProfileProgressFiles: latest.dogProfiles?.progressFileCount ?? null,
    },
    windows,
  };

  if (options.writeReport) {
    await writeReports(report);
  }

  console.log(JSON.stringify(report, null, options.compact ? 0 : 2));
}

function summarizeWindow(
  snapshots: StatusSnapshot[],
  latest: StatusSnapshot,
  minutes: number
) {
  const latestMs = Date.parse(latest.generatedAt);
  const floorMs = latestMs - minutes * 60_000;
  const baseline =
    snapshots.find(
      (snapshot) =>
        Date.parse(snapshot.generatedAt) >= floorMs &&
        raceFileCount(snapshot) != null &&
        dogProfileFileCount(snapshot) != null
    ) ?? snapshots.find((snapshot) => raceFileCount(snapshot) != null && dogProfileFileCount(snapshot) != null) ?? snapshots[0];
  const elapsedMinutes = Math.max(
    (latestMs - Date.parse(baseline.generatedAt)) / 60_000,
    0
  );
  const elapsedHours = elapsedMinutes / 60;
  const raceDelta = (raceFileCount(latest) ?? 0) - (raceFileCount(baseline) ?? 0);
  const profileDelta =
    (dogProfileFileCount(latest) ?? 0) - (dogProfileFileCount(baseline) ?? 0);
  const racePerHour = ratePerHour(raceDelta, elapsedHours);
  const profilePerHour = ratePerHour(profileDelta, elapsedHours);
  const raceRemaining = latest.raceArchive?.missingTargetDays ?? null;

  return {
    requestedWindowMinutes: minutes,
    baselineSnapshotAt: baseline.generatedAt,
    elapsedMinutes: round(elapsedMinutes, 2),
    raceFilesDelta: raceDelta,
    raceFilesPerHour: racePerHour,
    raceEtaHours: raceRemaining != null ? etaHours(raceRemaining, racePerHour) : null,
    dogProfileFilesDelta: profileDelta,
    dogProfileFilesPerHour: profilePerHour,
  };
}

function raceFileCount(snapshot: StatusSnapshot) {
  return snapshot.raceArchive?.filesInTargetRange ?? snapshot.raceArchive?.filesTotal ?? null;
}

function dogProfileFileCount(snapshot: StatusSnapshot) {
  return (
    snapshot.dogProfiles?.archiveFiles ??
    snapshot.dogProfiles?.uniqueProfilesWithProgress ??
    snapshot.dogProfiles?.latestOk ??
    null
  );
}

async function readSnapshots() {
  if (!existsSync(REPORT_DIR)) return [];
  const snapshots = new Map<string, StatusSnapshot>();
  for (const entry of await readdir(REPORT_DIR, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !/^thedogs-harvest-status-\d{8}T\d{6}Z\.json$/i.test(entry.name)
    ) {
      continue;
    }
    const filePath = path.join(REPORT_DIR, entry.name);
    const snapshot = JSON.parse(await readFile(filePath, "utf8")) as StatusSnapshot;
    if (snapshot.generatedAt) snapshots.set(snapshot.generatedAt, snapshot);
  }
  return [...snapshots.values()].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
}

async function writeReports(report: Record<string, unknown>) {
  await mkdir(REPORT_DIR, { recursive: true });
  const jsonPath = path.join(REPORT_DIR, "thedogs-harvest-trend-latest.json");
  const mdPath = path.join(REPORT_DIR, "thedogs-harvest-trend-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(report));
}

function renderMarkdown(report: Record<string, unknown>) {
  const current = report.current as Record<string, unknown>;
  const windows = report.windows as Array<Record<string, unknown>>;
  const lines = [
    "# The Dogs Harvest Trend",
    "",
    `Generated: ${String(report.generatedAt)}`,
    `Snapshots: ${String(report.snapshotCount)} (${String(report.oldestSnapshotAt)} to ${String(report.latestSnapshotAt)})`,
    "",
    "## Current",
    "",
    `- Race raw days: ${String(current.raceFiles)} archived, ${String(current.raceMissingDays)} missing`,
    `- Race coverage: ${percent(current.raceCoverageRate)}`,
    `- Race observed range: ${String(current.raceObservedFrom)} to ${String(current.raceObservedTo)}`,
    `- Race contiguous through: ${String(current.raceContiguousThrough)}`,
    `- Race shards: ${String(current.raceRunningShards)} running, ${String(current.raceFailedShards)} failed`,
    `- Dog profile files: ${String(current.dogProfileArchiveFiles)}`,
    `- Dog profile progress: ${String(current.dogProfileProgressOk)} ok, ${String(current.dogProfileLatestFailed)} failed, ${String(current.dogProfileProgressFiles)} progress files`,
    "",
    "## Velocity",
    "",
    "| Window | Race days | Race days/hour | Race ETA | Dog profiles | Dog profiles/hour |",
    "|---:|---:|---:|---:|---:|---:|",
  ];

  for (const window of windows) {
    lines.push(
      `| ${String(window.elapsedMinutes)} min | ${String(window.raceFilesDelta)} | ${String(window.raceFilesPerHour)} | ${formatEta(window.raceEtaHours)} | ${String(window.dogProfileFilesDelta)} | ${String(window.dogProfileFilesPerHour)} |`
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  return {
    windowMinutes: parseWindowMinutes(stringOption(values, "window-minutes")),
    writeReport: values.has("write-report"),
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

function parseWindowMinutes(value: string | undefined) {
  if (!value) return DEFAULT_WINDOWS;
  const windows = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part > 0);
  if (windows.length === 0) throw new Error("--window-minutes must include positive integers");
  return [...new Set(windows)].sort((a, b) => a - b);
}

function ratePerHour(delta: number, elapsedHours: number) {
  if (elapsedHours <= 0) return null;
  return round(delta / elapsedHours, 2);
}

function etaHours(remaining: number, perHour: number | null) {
  if (!perHour || perHour <= 0) return null;
  return round(remaining / perHour, 2);
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function percent(value: unknown) {
  return typeof value === "number" ? `${round(value * 100, 2)}%` : "n/a";
}

function formatEta(value: unknown) {
  if (typeof value !== "number") return "n/a";
  if (value < 24) return `${value}h`;
  return `${round(value / 24, 2)}d`;
}

main().catch((error) => {
  console.error("[report:thedogs:trend] failed:", error);
  process.exitCode = 1;
});
