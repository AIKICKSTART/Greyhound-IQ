/**
 * Controlled multi-worker launcher for The Dogs historical archive backfills.
 *
 * Examples:
 *   npm run backfill:thedogs:shards -- start --from auto --to 2026-06-30 --workers 3
 *   npm run backfill:thedogs:shards -- start --from auto --to 2026-06-30 --workers 12 --provider-concurrency 1
 *   npm run backfill:thedogs:shards -- start --from auto --to 2026-06-30 --workers 10 --logical-shards 20 --provider-concurrency 1
 *   npm run backfill:thedogs:shards -- status
 *   npm run backfill:thedogs:shards -- stop
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { closeSync, existsSync, openSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_FLOOR = process.env.THEDOGS_BACKFILL_FROM ?? "2006-08-01";
const DEFAULT_TO = formatSydneyDate(new Date());
const BACKFILL_DIR = ".backfill";
const LOG_DIR = path.join(BACKFILL_DIR, "logs");
const MANIFEST_FILE = path.join(BACKFILL_DIR, "thedogs-shards-manifest.json");
const BASE_PROGRESS_FILE = path.join(BACKFILL_DIR, "thedogs-history-progress.jsonl");
const DEFAULT_DB_CONNECTION_BUDGET = 12;
const DB_UNAVAILABLE_EXIT_CODE = 75;

type Command = "start" | "status" | "stop" | "run-queue";
type QueueStatus = "running" | "completed" | "failed" | "stopped";
type ShardState = "queued" | "running" | "completed" | "failed" | "stopped";

type Options = {
  command: Command;
  from: string;
  to: string;
  workers: number;
  logicalShards: number;
  pauseMs: number;
  pollMs: number;
  maxErrors: number;
  providerConcurrency: number;
  dbConnectionBudget: number;
  force: boolean;
};

type ShardManifest = {
  launchedAt: string;
  from: string;
  to: string;
  workers: number;
  logicalShards?: number;
  providerConcurrency: number;
  pauseMs: number;
  pollMs?: number;
  maxErrors?: number;
  dbConnectionBudget: number;
  queuePid?: number;
  queueStatus?: QueueStatus;
  queueOrder?: number[];
  completedAt?: string;
  shards: ShardRecord[];
};

type ShardRecord = {
  id: number;
  from: string;
  to: string;
  pid: number;
  progressFile: string;
  outLog: string;
  errLog: string;
  state?: ShardState;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
};

type ProgressRecord = {
  date?: string;
  ok?: boolean;
  loggedAt?: string;
  meetings?: number;
  races?: number;
  runners?: number;
  results?: number;
  error?: string;
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
  if (options.command === "run-queue") {
    await runQueue();
    return;
  }
  await startShards(options);
}

async function startShards(options: Options) {
  await mkdir(LOG_DIR, { recursive: true });
  const existing = await readManifest();
  if (existing && !options.force) {
    const running = existing.shards.filter((shard) => isProcessRunning(shard.pid));
    const queueRunning = existing.queuePid ? isProcessRunning(existing.queuePid) : false;
    if (running.length > 0 || queueRunning) {
      throw new Error(
        `Refusing to start duplicate shard workers. ${running.length} worker(s) and queueRunning=${queueRunning} are already active. Pass --force only after confirming this is intentional.`
      );
    }
  }
  if (options.workers > options.dbConnectionBudget && !options.force) {
    throw new Error(
      `Refusing to start ${options.workers} workers with dbConnectionBudget=${options.dbConnectionBudget}. Current Supabase session-pool evidence showed 20 workers can hit EMAXCONNSESSION. Lower --workers, raise --db-connection-budget only after changing the DB pool, or pass --force deliberately.`
    );
  }

  const from =
    options.from === "auto"
      ? await nextMissingDate(DEFAULT_FLOOR)
      : options.from;
  assertDate(from, "--from");
  assertDate(options.to, "--to");
  if (dayValue(from) > dayValue(options.to)) {
    console.log(
      JSON.stringify(
        {
          started: false,
          reason: "archive_already_covered",
          from,
          to: options.to,
        },
        null,
        2
      )
    );
    return;
  }

  const logicalShards = Math.max(options.logicalShards, options.workers);
  const ranges = splitRange(from, options.to, logicalShards);
  const providerConcurrency = providerConcurrencyFor(options);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const queuedMode = ranges.length > options.workers;
  const shards: ShardRecord[] = ranges.map((range, index) =>
    createShardRecord(index + 1, range, stamp, queuedMode ? "queued" : undefined)
  );

  const manifest: ShardManifest = {
    launchedAt: new Date().toISOString(),
    from,
    to: options.to,
    workers: queuedMode ? options.workers : shards.length,
    logicalShards: shards.length,
    providerConcurrency,
    pauseMs: options.pauseMs,
    pollMs: options.pollMs,
    maxErrors: options.maxErrors,
    dbConnectionBudget: options.dbConnectionBudget,
    queueOrder: queuedMode ? spreadShardOrder(shards.length, options.workers) : undefined,
    shards,
  };

  if (queuedMode) {
    await writeManifest(manifest);
    const queue = launchQueueCoordinator();
    manifest.queuePid = queue.pid ?? 0;
    manifest.queueStatus = "running";
    await writeManifest(manifest);
    console.log(JSON.stringify({ started: true, mode: "queued", manifest }, null, 2));
    return;
  }

  for (const shard of manifest.shards) {
    const child = launchShardProcess(shard, manifest, true);
    shard.pid = child.pid ?? 0;
    shard.state = "running";
    shard.startedAt = new Date().toISOString();
  }

  await writeManifest(manifest);
  console.log(JSON.stringify({ started: true, mode: "direct", manifest }, null, 2));
}

function createShardRecord(
  id: number,
  range: { from: string; to: string },
  stamp: string,
  state?: ShardState
): ShardRecord {
  return {
    id,
    from: range.from,
    to: range.to,
    pid: 0,
    progressFile: path.join(
      BACKFILL_DIR,
      `thedogs-history-shard-${id}-${range.from}-${range.to}.jsonl`
    ),
    outLog: path.join(LOG_DIR, `thedogs-shard-${id}-${stamp}.out.log`),
    errLog: path.join(LOG_DIR, `thedogs-shard-${id}-${stamp}.err.log`),
    state,
  };
}

function launchShardProcess(
  shard: ShardRecord,
  manifest: ShardManifest,
  detached: boolean
): ChildProcess {
  const out = openSync(shard.outLog, "a");
  const err = openSync(shard.errLog, "a");
  const npmArgs = [
    "run",
    "backfill:thedogs",
    "--",
    "--from",
    shard.from,
    "--to",
    shard.to,
    "--full",
    "--continue-on-error",
    "--max-errors",
    String(manifest.maxErrors ?? 250),
    "--pause-ms",
    String(manifest.pauseMs),
    "--progress-file",
    shard.progressFile,
    "--stop-on-db-error",
  ];
  const launch = launchCommand(npmArgs);
  const child = spawn(launch.command, launch.args, {
    cwd: process.cwd(),
    detached,
    stdio: ["ignore", out, err],
    windowsHide: true,
    env: {
      ...process.env,
      THEDOGS_CONCURRENCY: String(manifest.providerConcurrency),
    },
  });
  if (detached) child.unref();
  closeSync(out);
  closeSync(err);
  return child;
}

function launchQueueCoordinator(): ChildProcess {
  const outLog = path.join(LOG_DIR, "thedogs-shard-queue.out.log");
  const errLog = path.join(LOG_DIR, "thedogs-shard-queue.err.log");
  const out = openSync(outLog, "a");
  const err = openSync(errLog, "a");
  const launch = launchCommand(["run", "backfill:thedogs:shards", "--", "run-queue"]);
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
  return child;
}

async function runQueue() {
  await mkdir(LOG_DIR, { recursive: true });
  const manifest = await readManifest();
  if (!manifest) throw new Error("Cannot run queued shards without a manifest.");

  const active = new Map<number, ChildProcess>();
  const finished: Array<{
    id: number;
    code: number | null;
    signal: NodeJS.Signals | null;
  }> = [];
  const pollMs = manifest.pollMs && manifest.pollMs > 0 ? manifest.pollMs : 5000;

  manifest.queuePid = process.pid;
  manifest.queueStatus = "running";
  await writeManifest(manifest);

  for (;;) {
    const finishedResult = applyFinishedChildren(manifest, active, finished);
    let changed = finishedResult.changed;
    if (finishedResult.dbUnavailable) {
      stopActiveAndQueuedShards(manifest, active);
      await writeManifest(manifest);
      return;
    }

    while (active.size < manifest.workers) {
      const shard = nextQueuedShard(manifest);
      if (!shard) break;
      const child = launchShardProcess(shard, manifest, false);
      shard.pid = child.pid ?? 0;
      shard.state = "running";
      shard.startedAt = new Date().toISOString();
      active.set(shard.id, child);
      child.once("exit", (code, signal) => {
        finished.push({ id: shard.id, code, signal });
      });
      child.once("error", () => {
        finished.push({ id: shard.id, code: 1, signal: null });
      });
      changed = true;
    }

    if (changed) await writeManifest(manifest);

    const queued = manifest.shards.some((shard) => shard.state === "queued");
    if (!queued && active.size === 0) {
      manifest.queueStatus = manifest.shards.some((shard) => shard.state === "failed")
        ? "failed"
        : "completed";
      manifest.completedAt = new Date().toISOString();
      await writeManifest(manifest);
      return;
    }

    await sleep(pollMs);
  }
}

function applyFinishedChildren(
  manifest: ShardManifest,
  active: Map<number, ChildProcess>,
  finished: Array<{ id: number; code: number | null; signal: NodeJS.Signals | null }>
) {
  let changed = false;
  let dbUnavailable = false;
  for (;;) {
    const item = finished.shift();
    if (!item) break;
    const shard = manifest.shards.find((candidate) => candidate.id === item.id);
    if (!shard) continue;
    active.delete(item.id);
    shard.state = item.code === 0 ? "completed" : "failed";
    shard.exitCode = item.code;
    shard.signal = item.signal;
    shard.finishedAt = new Date().toISOString();
    if (item.code === DB_UNAVAILABLE_EXIT_CODE) dbUnavailable = true;
    changed = true;
  }
  return { changed, dbUnavailable };
}

function stopActiveAndQueuedShards(
  manifest: ShardManifest,
  active: Map<number, ChildProcess>
) {
  const now = new Date().toISOString();
  for (const [id, child] of active) {
    if (child.pid) stopProcessTree(child.pid);
    const shard = manifest.shards.find((candidate) => candidate.id === id);
    if (!shard || shard.state !== "running") continue;
    shard.state = "stopped";
    shard.finishedAt = now;
  }
  active.clear();
  for (const shard of manifest.shards) {
    if (shard.state !== "queued") continue;
    shard.state = "stopped";
    shard.finishedAt = now;
  }
  manifest.queueStatus = "failed";
  manifest.completedAt = now;
}

function nextQueuedShard(manifest: ShardManifest) {
  const order =
    manifest.queueOrder && manifest.queueOrder.length > 0
      ? manifest.queueOrder
      : spreadShardOrder(manifest.shards.length, manifest.workers);
  for (const id of order) {
    const shard = manifest.shards.find((item) => item.id === id);
    if (shard?.state === "queued") return shard;
  }
  return manifest.shards.find((item) => item.state === "queued");
}

function spreadShardOrder(totalShards: number, activeWorkers: number) {
  const total = Math.max(totalShards, 1);
  const active = Math.max(Math.min(activeWorkers, total), 1);
  const firstWave: number[] = [];
  const used = new Set<number>();
  for (let slot = 0; slot < active; slot += 1) {
    const id = Math.floor((slot * total) / active) + 1;
    if (!used.has(id)) {
      firstWave.push(id);
      used.add(id);
    }
  }
  const rest: number[] = [];
  for (let id = 1; id <= total; id += 1) {
    if (!used.has(id)) rest.push(id);
  }
  return [...firstWave, ...rest];
}

async function printStatus() {
  const manifest = await readManifest();
  const progressFiles = await findProgressFiles(manifest);
  const coverage = await coverageFrom(DEFAULT_FLOOR, progressFiles);
  const queueCounts = manifest
    ? countShardStates(manifest.shards)
    : undefined;
  const shardStatuses = manifest
    ? await Promise.all(
        manifest.shards.map(async (shard) => ({
          ...shard,
          running: isProcessRunning(shard.pid),
          progress: await summarizeProgress(shard.progressFile, shard.from, shard.to),
        }))
      )
    : [];

  console.log(
    JSON.stringify(
      {
        manifestFile: MANIFEST_FILE,
        manifestFound: manifest != null,
        queue: manifest
          ? {
              pid: manifest.queuePid ?? null,
              status: manifest.queueStatus ?? null,
              running: manifest.queuePid ? isProcessRunning(manifest.queuePid) : false,
              activeWorkers: manifest.workers,
              logicalShards: manifest.logicalShards ?? manifest.shards.length,
              queuedShards: queueCounts?.queued ?? 0,
              runningShards: queueCounts?.running ?? 0,
              completedShards: queueCounts?.completed ?? 0,
              failedShards: queueCounts?.failed ?? 0,
              queueOrder: manifest.queueOrder ?? null,
              completedAt: manifest.completedAt ?? null,
            }
          : null,
        coverage,
        shards: shardStatuses,
      },
      null,
      2
    )
  );
}

function countShardStates(shards: ShardRecord[]) {
  return shards.reduce(
    (counts, shard) => {
      const state = shard.state ?? "running";
      counts[state] += 1;
      return counts;
    },
    {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      stopped: 0,
    } satisfies Record<ShardState, number>
  );
}

async function stopManifestWorkers() {
  const manifest = await readManifest();
  if (!manifest) {
    console.log(JSON.stringify({ stopped: false, reason: "manifest_not_found" }, null, 2));
    return;
  }
  const queueStopped = manifest.queuePid
    ? {
        pid: manifest.queuePid,
        wasRunning: isProcessRunning(manifest.queuePid),
        stopped: stopProcessTree(manifest.queuePid),
      }
    : null;
  const stopped = manifest.shards.map((shard) => ({
    id: shard.id,
    pid: shard.pid,
    wasRunning: isProcessRunning(shard.pid),
    stopped: stopProcessTree(shard.pid),
  }));
  for (const item of stopped) {
    if (!item.wasRunning && !item.stopped) continue;
    const shard = manifest.shards.find((candidate) => candidate.id === item.id);
    if (!shard) continue;
    shard.state = "stopped";
    shard.finishedAt = new Date().toISOString();
  }
  if (manifest.queuePid) {
    manifest.queueStatus = "stopped";
    for (const shard of manifest.shards) {
      if (shard.state !== "queued" && shard.state !== "running") continue;
      shard.state = "stopped";
      shard.finishedAt = new Date().toISOString();
    }
  }
  if (manifest.queuePid || stopped.some((item) => item.wasRunning || item.stopped)) {
    manifest.completedAt = new Date().toISOString();
    await writeManifest(manifest);
  }
  console.log(JSON.stringify({ queueStopped, stopped }, null, 2));
}

async function coverageFrom(from: string, progressFiles: string[]) {
  const okDates = new Set<string>();
  const failedDates = new Set<string>();
  let failedAttempts = 0;
  let latestLog: ProgressRecord | undefined;

  for (const file of progressFiles) {
    for (const record of await readProgress(file)) {
      if (record.ok && record.date) okDates.add(record.date);
      if (record.ok === false) {
        failedAttempts += 1;
        if (record.date) failedDates.add(record.date);
      }
      if (
        record.loggedAt &&
        (!latestLog?.loggedAt || record.loggedAt > latestLog.loggedAt)
      ) {
        latestLog = record;
      }
    }
  }

  let cursor = dayValue(from);
  let contiguousThrough: string | null = null;
  while (okDates.has(formatDate(cursor))) {
    contiguousThrough = formatDate(cursor);
    cursor += 86_400_000;
  }

  const unresolvedFailedDates = [...failedDates]
    .filter((date) => !okDates.has(date))
    .sort();

  return {
    contiguousFrom: from,
    contiguousThrough,
    nextMissingDate: formatDate(cursor),
    uniqueSuccessfulDates: okDates.size,
    failedAttempts,
    uniqueFailedDates: failedDates.size,
    unresolvedFailedDates: unresolvedFailedDates.length,
    unresolvedFailedDateSamples: unresolvedFailedDates.slice(0, 20),
    latestLog,
  };
}

async function summarizeProgress(progressFile: string, from: string, to: string) {
  const records = await readProgress(progressFile);
  const okDates = new Set(records.filter((record) => record.ok && record.date).map((record) => record.date as string));
  const failed = records.filter((record) => record.ok === false);
  const latest = records
    .filter((record) => record.loggedAt)
    .sort((a, b) => String(a.loggedAt).localeCompare(String(b.loggedAt)))
    .at(-1);
  const totalDays = daysBetween(from, to) + 1;
  return {
    okDates: okDates.size,
    failedAttempts: failed.length,
    totalDays,
    pendingDays: Math.max(totalDays - okDates.size, 0),
    latest,
  };
}

async function nextMissingDate(from: string) {
  const files = await findProgressFiles(await readManifest());
  return (await coverageFrom(from, files)).nextMissingDate;
}

async function findProgressFiles(manifest: ShardManifest | null) {
  const files = new Set<string>();
  if (existsSync(BASE_PROGRESS_FILE)) files.add(BASE_PROGRESS_FILE);
  if (manifest) {
    for (const shard of manifest.shards) {
      if (existsSync(shard.progressFile)) files.add(shard.progressFile);
    }
  }
  try {
    const entries = await readdir(BACKFILL_DIR);
    for (const entry of entries) {
      if (/^thedogs-history.*\.jsonl$/i.test(entry)) {
        files.add(path.join(BACKFILL_DIR, entry));
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return [...files];
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_FILE, "utf8")) as ShardManifest;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeManifest(manifest: ShardManifest) {
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
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

function splitRange(from: string, to: string, workers: number) {
  const total = daysBetween(from, to) + 1;
  const count = Math.min(Math.max(workers, 1), total);
  const base = Math.floor(total / count);
  const remainder = total % count;
  const ranges: Array<{ from: string; to: string }> = [];
  let cursor = dayValue(from);
  for (let index = 0; index < count; index += 1) {
    const length = base + (index < remainder ? 1 : 0);
    const start = cursor;
    const end = cursor + (length - 1) * 86_400_000;
    ranges.push({ from: formatDate(start), to: formatDate(end) });
    cursor = end + 86_400_000;
  }
  return ranges;
}

function parseOptions(args: string[]): Options {
  const [first, ...rest] = args;
  const command = isCommand(first) ? first : "start";
  const values = parseFlags(isCommand(first) ? rest : args);
  const workers = positiveInt(stringOption(values, "workers"), 3);
  return {
    command,
    from: stringOption(values, "from") ?? "auto",
    to: stringOption(values, "to") ?? DEFAULT_TO,
    workers,
    logicalShards: positiveInt(stringOption(values, "logical-shards"), workers),
    pauseMs: positiveInt(stringOption(values, "pause-ms"), 750),
    pollMs: positiveInt(stringOption(values, "poll-ms"), 5000),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 250),
    providerConcurrency: positiveInt(stringOption(values, "provider-concurrency"), 0),
    dbConnectionBudget: positiveInt(
      stringOption(values, "db-connection-budget"),
      DEFAULT_DB_CONNECTION_BUDGET
    ),
    force: values.has("force"),
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
  return value === "start" || value === "status" || value === "stop" || value === "run-queue";
}

function providerConcurrencyFor(options: Options) {
  if (options.providerConcurrency > 0) return options.providerConcurrency;
  if (options.workers >= 12) return 1;
  if (options.workers >= 6) return 2;
  return positiveInt(process.env.THEDOGS_CONCURRENCY, 5);
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
      ? spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
          encoding: "utf8",
        })
      : spawnSync("kill", ["-TERM", String(-pid)], { encoding: "utf8" });
  return result.status === 0;
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

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD or auto`);
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("[backfill:thedogs:shards] failed:", err);
  process.exitCode = 1;
});
