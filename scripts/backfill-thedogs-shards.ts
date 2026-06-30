/**
 * Controlled multi-worker launcher for The Dogs historical archive backfills.
 *
 * Examples:
 *   npm run backfill:thedogs:shards -- start --from auto --to 2026-06-30 --workers 3
 *   npm run backfill:thedogs:shards -- start --from auto --to 2026-06-30 --workers 12 --provider-concurrency 1
 *   npm run backfill:thedogs:shards -- status
 *   npm run backfill:thedogs:shards -- stop
 */
import { spawn, spawnSync } from "node:child_process";
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

type Command = "start" | "status" | "stop";

type Options = {
  command: Command;
  from: string;
  to: string;
  workers: number;
  pauseMs: number;
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
  providerConcurrency: number;
  pauseMs: number;
  dbConnectionBudget: number;
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
  await startShards(options);
}

async function startShards(options: Options) {
  await mkdir(LOG_DIR, { recursive: true });
  const existing = await readManifest();
  if (existing && !options.force) {
    const running = existing.shards.filter((shard) => isProcessRunning(shard.pid));
    if (running.length > 0) {
      throw new Error(
        `Refusing to start duplicate shard workers. ${running.length} worker(s) are already running. Pass --force only after confirming this is intentional.`
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

  const ranges = splitRange(from, options.to, options.workers);
  const providerConcurrency = providerConcurrencyFor(options);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shards: ShardRecord[] = [];

  for (const [index, range] of ranges.entries()) {
    const id = index + 1;
    const progressFile = path.join(
      BACKFILL_DIR,
      `thedogs-history-shard-${id}-${range.from}-${range.to}.jsonl`
    );
    const outLog = path.join(LOG_DIR, `thedogs-shard-${id}-${stamp}.out.log`);
    const errLog = path.join(LOG_DIR, `thedogs-shard-${id}-${stamp}.err.log`);
    const out = openSync(outLog, "a");
    const err = openSync(errLog, "a");
    const npmArgs = [
      "run",
      "backfill:thedogs",
      "--",
      "--from",
      range.from,
      "--to",
      range.to,
      "--full",
      "--continue-on-error",
      "--max-errors",
      String(options.maxErrors),
      "--pause-ms",
      String(options.pauseMs),
        "--progress-file",
        progressFile,
      ];
    const launch = launchCommand(npmArgs);
    const child = spawn(
      launch.command,
      launch.args,
      {
        cwd: process.cwd(),
        detached: true,
        stdio: ["ignore", out, err],
        windowsHide: true,
        env: {
          ...process.env,
          THEDOGS_CONCURRENCY: String(providerConcurrency),
        },
      }
    );
    child.unref();
    closeSync(out);
    closeSync(err);
    shards.push({
      id,
      from: range.from,
      to: range.to,
      pid: child.pid ?? 0,
      progressFile,
      outLog,
      errLog,
    });
  }

  const manifest: ShardManifest = {
    launchedAt: new Date().toISOString(),
    from,
    to: options.to,
    workers: shards.length,
    providerConcurrency,
    pauseMs: options.pauseMs,
    dbConnectionBudget: options.dbConnectionBudget,
    shards,
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ started: true, manifest }, null, 2));
}

async function printStatus() {
  const manifest = await readManifest();
  const progressFiles = await findProgressFiles(manifest);
  const coverage = await coverageFrom(DEFAULT_FLOOR, progressFiles);
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
        coverage,
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
  return {
    command,
    from: stringOption(values, "from") ?? "auto",
    to: stringOption(values, "to") ?? DEFAULT_TO,
    workers: positiveInt(stringOption(values, "workers"), 3),
    pauseMs: positiveInt(stringOption(values, "pause-ms"), 750),
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
  return value === "start" || value === "status" || value === "stop";
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

main().catch((err) => {
  console.error("[backfill:thedogs:shards] failed:", err);
  process.exitCode = 1;
});
