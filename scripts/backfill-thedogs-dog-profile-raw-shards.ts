/**
 * Controlled multi-worker launcher for raw The Dogs dog profile archives.
 *
 * This deliberately uses the raw archive script, not the database-backed dog
 * profile importer, so collection can continue while the local DB pool is busy.
 *
 * Examples:
 *   npm run backfill:thedogs:dog-profile-raw-shards -- status
 *   npm run backfill:thedogs:dog-profile-raw-shards -- start --workers 8 --concurrency 1
 *   npm run backfill:thedogs:dog-profile-raw-shards -- stop
 */
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const BACKFILL_DIR = ".backfill";
const LOG_DIR = path.join(BACKFILL_DIR, "logs");
const RAW_PROFILE_DIR = path.join(BACKFILL_DIR, "thedogs-dog-profiles-raw");
const MANIFEST_FILE = path.join(BACKFILL_DIR, "thedogs-dog-profile-raw-shards-manifest.json");
const BASE_PROGRESS_FILE = path.join(BACKFILL_DIR, "thedogs-dog-profile-raw-progress.jsonl");

type Command = "start" | "status" | "stop";

type Options = {
  command: Command;
  workers: number;
  concurrency: number;
  pauseMs: number;
  maxErrors: number;
  retryAttempts: number;
  retryDelayMs: number;
  sort: "first-seen" | "appearances";
  force: boolean;
  rawDir?: string;
  outputDir?: string;
  from?: string;
  to?: string;
};

type ShardManifest = {
  launchedAt: string;
  workers: number;
  concurrency: number;
  pauseMs: number;
  shards: ShardRecord[];
};

type ShardRecord = {
  id: number;
  pid: number;
  progressFile: string;
  outLog: string;
  errLog: string;
};

type ProgressRecord = {
  sourceId?: string;
  name?: string;
  ok?: boolean;
  archived?: boolean;
  loggedAt?: string;
  formRows?: number;
  raceAppearances?: number;
  error?: string;
};

type ProcessMatch = {
  processId: number;
  name: string;
  commandLine: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.command === "status") {
    await printStatus();
    return;
  }
  if (options.command === "stop") {
    await stopManifestWorkers();
    return;
  }
  await startShards(options);
}

async function startShards(options: Options) {
  await mkdir(LOG_DIR, { recursive: true });
  const existing = await readManifest();
  if (existing && !options.force) {
    const running = existing.shards.filter((shard) => isProcessRunning(shard.pid));
    if (running.length > 0) {
      throw new Error(
        `Refusing to start duplicate raw profile shards. ${running.length} worker(s) are already running.`
      );
    }
  }

  const activeRawWorkers = await findRawProfileWorkers();
  if (activeRawWorkers.length > 0 && !options.force) {
    throw new Error(
      `Refusing to start while ${activeRawWorkers.length} raw profile worker process(es) are active. Stop the current raw worker/supervisor or pass --force deliberately.`
    );
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shards: ShardRecord[] = [];
  for (let index = 1; index <= options.workers; index += 1) {
    const progressFile = path.join(
      BACKFILL_DIR,
      `thedogs-dog-profile-raw-shard-${index}-of-${options.workers}.jsonl`
    );
    const outLog = path.join(LOG_DIR, `thedogs-dog-profile-raw-shard-${index}-${stamp}.out.log`);
    const errLog = path.join(LOG_DIR, `thedogs-dog-profile-raw-shard-${index}-${stamp}.err.log`);
    const out = openSync(outLog, "a");
    const err = openSync(errLog, "a");
    const launch = launchCommand(profileArgs(options, index));
    const child = spawn(launch.command, launch.args, {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", out, err],
      windowsHide: true,
      env: process.env,
    });
    child.unref();
    closeSync(out);
    closeSync(err);
    shards.push({ id: index, pid: child.pid ?? 0, progressFile, outLog, errLog });
  }

  const manifest: ShardManifest = {
    launchedAt: new Date().toISOString(),
    workers: shards.length,
    concurrency: options.concurrency,
    pauseMs: options.pauseMs,
    shards,
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ started: true, manifest }, null, 2));
}

async function printStatus() {
  const manifest = await readManifest();
  const progressFiles = await findProgressFiles(manifest);
  const [progress, archive, activeRawWorkers] = await Promise.all([
    summarizeAllProgress(progressFiles),
    scanProfileArchive(RAW_PROFILE_DIR),
    findRawProfileWorkers(),
  ]);
  const shardStatuses = manifest
    ? await Promise.all(
        manifest.shards.map(async (shard) => ({
          ...shard,
          running: isProcessRunning(shard.pid),
          progress: await summarizeProgress(shard.progressFile),
        }))
      )
    : [];

  console.log(
    JSON.stringify(
      {
        manifestFile: MANIFEST_FILE,
        manifestFound: manifest != null,
        archive,
        progress,
        activeRawWorkers: activeRawWorkers.map((process) => ({
          processId: process.processId,
          name: process.name,
        })),
        shards: shardStatuses,
      },
      null,
      2
    )
  );
}

async function stopManifestWorkers() {
  const manifest = await readManifest();
  if (!manifest) {
    console.log(JSON.stringify({ stopped: false, reason: "manifest_not_found" }, null, 2));
    return;
  }
  const stopped = manifest.shards.map((shard) => ({
    id: shard.id,
    pid: shard.pid,
    wasRunning: isProcessRunning(shard.pid),
    stopped: stopProcessTree(shard.pid),
  }));
  console.log(JSON.stringify({ stopped }, null, 2));
}

function profileArgs(options: Options, shardIndex: number) {
  const args = [
    "run",
    "backfill:thedogs:dog-profile-raw",
    "--",
    "--full",
    "--continue-on-error",
    "--max-errors",
    String(options.maxErrors),
    "--concurrency",
    String(options.concurrency),
    "--pause-ms",
    String(options.pauseMs),
    "--retry-attempts",
    String(options.retryAttempts),
    "--retry-delay-ms",
    String(options.retryDelayMs),
    "--sort",
    options.sort,
    "--shard-index",
    String(shardIndex),
    "--shard-count",
    String(options.workers),
    "--progress-file",
    path.join(BACKFILL_DIR, `thedogs-dog-profile-raw-shard-${shardIndex}-of-${options.workers}.jsonl`),
  ];
  if (options.rawDir) args.push("--raw-dir", options.rawDir);
  if (options.outputDir) args.push("--output-dir", options.outputDir);
  if (options.from) args.push("--from", options.from);
  if (options.to) args.push("--to", options.to);
  return args;
}

async function summarizeAllProgress(progressFiles: string[]) {
  const latestByDog = new Map<string, ProgressRecord>();
  let failedAttempts = 0;
  let formRows = 0;
  let latestLog: ProgressRecord | undefined;
  for (const file of progressFiles) {
    for (const record of await readProgress(file)) {
      if (record.sourceId) latestByDog.set(record.sourceId, record);
      if (record.ok === false) failedAttempts += 1;
      formRows += record.formRows ?? 0;
      if (record.loggedAt && (!latestLog?.loggedAt || record.loggedAt > latestLog.loggedAt)) {
        latestLog = record;
      }
    }
  }
  const latest = [...latestByDog.values()];
  return {
    progressFileCount: progressFiles.length,
    progressFiles,
    uniqueProfilesWithProgress: latest.length,
    latestOk: latest.filter((record) => record.ok).length,
    latestFailed: latest.filter((record) => record.ok === false).length,
    failedAttempts,
    formRowsLogged: formRows,
    latestLog,
  };
}

async function summarizeProgress(progressFile: string) {
  const records = await readProgress(progressFile);
  const okDogs = new Set(
    records.filter((record) => record.ok && record.sourceId).map((record) => record.sourceId as string)
  );
  const failed = records.filter((record) => record.ok === false);
  const latest = records
    .filter((record) => record.loggedAt)
    .sort((a, b) => String(a.loggedAt).localeCompare(String(b.loggedAt)))
    .at(-1);
  return {
    okDogs: okDogs.size,
    failedAttempts: failed.length,
    formRowsLogged: records.reduce((total, record) => total + (record.formRows ?? 0), 0),
    latest,
  };
}

async function findProgressFiles(manifest: ShardManifest | null) {
  const files = new Set<string>();
  if (existsSync(BASE_PROGRESS_FILE)) files.add(BASE_PROGRESS_FILE);
  if (manifest) {
    for (const shard of manifest.shards) {
      if (existsSync(shard.progressFile)) files.add(shard.progressFile);
    }
  }
  if (existsSync(BACKFILL_DIR)) {
    for (const entry of await readdir(BACKFILL_DIR)) {
      if (/^thedogs-dog-profile-raw-shard-.+\.jsonl$/i.test(entry)) {
        files.add(path.join(BACKFILL_DIR, entry));
      }
    }
  }
  return [...files].sort();
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_FILE, "utf8")) as ShardManifest;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
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

async function scanProfileArchive(rootDir: string) {
  let files = 0;
  let bytes = 0;
  if (!existsSync(rootDir)) return { rawProfileDir: rootDir, files, bytes };

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
  return { rawProfileDir: rootDir, files, bytes };
}

function parseOptions(args: string[]): Options {
  const [first, ...rest] = args;
  const command = isCommand(first) ? first : "start";
  const values = parseFlags(isCommand(first) ? rest : args);
  const sort = stringOption(values, "sort") === "first-seen" ? "first-seen" : "appearances";
  return {
    command,
    workers: positiveInt(stringOption(values, "workers"), 8),
    concurrency: positiveInt(stringOption(values, "concurrency"), 1),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 1_000),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 250),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 2),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 2_000),
    sort,
    force: values.has("force"),
    rawDir: stringOption(values, "raw-dir"),
    outputDir: stringOption(values, "output-dir"),
    from: stringOption(values, "from"),
    to: stringOption(values, "to"),
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

function isCommand(value: string | undefined): value is Command {
  return value === "start" || value === "status" || value === "stop";
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isProcessRunning(pid: number) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcessTree(pid: number) {
  if (!pid || !isProcessRunning(pid)) return false;
  const result =
    process.platform === "win32"
      ? spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8" })
      : spawnSync("kill", ["-TERM", String(-pid)], { encoding: "utf8" });
  return result.status === 0;
}

async function findRawProfileWorkers(): Promise<ProcessMatch[]> {
  if (process.platform !== "win32") return [];
  const script = [
    "Get-CimInstance Win32_Process |",
    "Where-Object {",
    "$_.CommandLine -match 'backfill-thedogs-dog-profile-raw\\.ts'",
    "-and $_.CommandLine -notmatch 'backfill-thedogs-dog-profile-raw-shards\\.ts'",
    "-and $_.Name -notlike 'powershell*'",
    "-and $_.Name -ne 'pwsh.exe'",
    "} | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Depth 3",
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0 || !result.stdout.trim()) return [];
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

function launchCommand(args: string[]) {
  if (process.platform !== "win32") return { command: "npm", args };
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", ["npm.cmd", ...args].map(cmdQuote).join(" ")],
  };
}

function cmdQuote(value: string) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

main().catch((err) => {
  console.error("[backfill:thedogs:dog-profile-raw-shards] failed:", err);
  process.exitCode = 1;
});
