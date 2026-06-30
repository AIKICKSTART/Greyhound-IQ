/**
 * Controlled multi-worker launcher for The Dogs dog profile enrichment.
 *
 * Examples:
 *   npm run backfill:thedogs:dog-profile-shards -- status
 *   npm run backfill:thedogs:dog-profile-shards -- start --workers 4 --concurrency 1
 *   npm run backfill:thedogs:dog-profile-shards -- stop
 */
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../src/lib/db";

loadEnvConfig(process.cwd());

const BACKFILL_DIR = ".backfill";
const LOG_DIR = path.join(BACKFILL_DIR, "logs");
const MANIFEST_FILE = path.join(BACKFILL_DIR, "thedogs-dog-profile-shards-manifest.json");
const BASE_PROGRESS_FILE = path.join(BACKFILL_DIR, "thedogs-dog-profile-progress.jsonl");
const DEFAULT_DB_CONNECTION_BUDGET = 4;

type Command = "start" | "status" | "stop";

type Options = {
  command: Command;
  workers: number;
  concurrency: number;
  pauseMs: number;
  maxErrors: number;
  dbConnectionBudget: number;
  force: boolean;
};

type ShardManifest = {
  launchedAt: string;
  workers: number;
  concurrency: number;
  pauseMs: number;
  dbConnectionBudget: number;
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
  dogId?: string;
  sourceId?: string;
  name?: string;
  ok?: boolean;
  loggedAt?: string;
  formRows?: number;
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
        `Refusing to start duplicate dog-profile workers. ${running.length} worker(s) are already running.`
      );
    }
  }
  if (options.workers * options.concurrency > options.dbConnectionBudget && !options.force) {
    throw new Error(
      `Refusing to start workers=${options.workers} concurrency=${options.concurrency} with dbConnectionBudget=${options.dbConnectionBudget}. Lower workers/concurrency or pass --force deliberately.`
    );
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shards: ShardRecord[] = [];
  for (let index = 1; index <= options.workers; index += 1) {
    const progressFile = path.join(
      BACKFILL_DIR,
      `thedogs-dog-profile-shard-${index}-of-${options.workers}.jsonl`
    );
    const outLog = path.join(LOG_DIR, `thedogs-dog-profile-shard-${index}-${stamp}.out.log`);
    const errLog = path.join(LOG_DIR, `thedogs-dog-profile-shard-${index}-${stamp}.err.log`);
    const out = openSync(outLog, "a");
    const err = openSync(errLog, "a");
    const launch = launchCommand([
      "run",
      "backfill:thedogs:dog-profiles",
      "--",
      "--full",
      "--continue-on-error",
      "--max-errors",
      String(options.maxErrors),
      "--concurrency",
      String(options.concurrency),
      "--pause-ms",
      String(options.pauseMs),
      "--shard-index",
      String(index),
      "--shard-count",
      String(options.workers),
      "--progress-file",
      progressFile,
    ]);
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
    dbConnectionBudget: options.dbConnectionBudget,
    shards,
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ started: true, manifest }, null, 2));
}

async function printStatus() {
  const manifest = await readManifest();
  const progressFiles = await findProgressFiles(manifest);
  const progress = await summarizeAllProgress(progressFiles);
  const [dogsWithProfiles, dogProfileFormRows, totalTheDogsDogs] = await Promise.all([
    prisma.dog.count({ where: { lastProfileSyncedAt: { not: null } } }),
    prisma.dogProfileForm.count(),
    prisma.dog.count({ where: { earBrand: { startsWith: "thedogs:" } } }),
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
        db: {
          totalTheDogsDogs,
          dogsWithProfiles,
          dogProfileFormRows,
          pendingProfileDogs: Math.max(totalTheDogsDogs - dogsWithProfiles, 0),
        },
        progress,
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

async function summarizeAllProgress(progressFiles: string[]) {
  const okDogs = new Set<string>();
  let failedAttempts = 0;
  let formRows = 0;
  let latestLog: ProgressRecord | undefined;
  for (const file of progressFiles) {
    for (const record of await readProgress(file)) {
      if (record.ok && record.dogId) okDogs.add(record.dogId);
      if (record.ok === false) failedAttempts += 1;
      formRows += record.formRows ?? 0;
      if (record.loggedAt && (!latestLog?.loggedAt || record.loggedAt > latestLog.loggedAt)) {
        latestLog = record;
      }
    }
  }
  return {
    successfulDogsInProgressFiles: okDogs.size,
    failedAttempts,
    formRowsLogged: formRows,
    latestLog,
  };
}

async function summarizeProgress(progressFile: string) {
  const records = await readProgress(progressFile);
  const okDogs = new Set(records.filter((record) => record.ok && record.dogId).map((record) => record.dogId as string));
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
  try {
    const entries = await readdir(BACKFILL_DIR);
    for (const entry of entries) {
      if (/^thedogs-dog-profile-shard-.+\.jsonl$/.test(entry)) {
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

function parseOptions(args: string[]): Options {
  const [first, ...rest] = args;
  const command = isCommand(first) ? first : "start";
  const values = parseFlags(isCommand(first) ? rest : args);
  return {
    command,
    workers: positiveInt(stringOption(values, "workers"), 4),
    concurrency: positiveInt(stringOption(values, "concurrency"), 1),
    pauseMs: positiveInt(stringOption(values, "pause-ms"), 1000),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 250),
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

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

main()
  .catch((err) => {
    console.error("[backfill:thedogs:dog-profile-shards] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
