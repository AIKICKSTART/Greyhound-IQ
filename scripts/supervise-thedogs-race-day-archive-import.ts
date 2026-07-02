/**
 * Supervisor for sharded The Dogs race-day raw archive imports.
 *
 * It waits for unsharded race-day archive importers to finish, probes for
 * pending raw archives, then starts any missing shard workers by default.
 *
 * Examples:
 *   npm run supervise:thedogs:race-day-archive
 *   npm run supervise:thedogs:race-day-archive -- --check-once
 *   npm run supervise:thedogs:race-day-archive -- --workers 20 --max-active-shards 20 --max-waves 0
 */
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BACKFILL_DIR = ".backfill";
const LOG_DIR = path.join(BACKFILL_DIR, "logs");
const MANIFEST_FILE = path.join(
  BACKFILL_DIR,
  "thedogs-race-day-archive-import-shards-manifest.json"
);

type Options = {
  workers: number;
  maxActiveShards: number;
  pollMs: number;
  launchSpacingMs: number;
  maxWaves: number;
  full: boolean;
  limitPerShard: number;
  dbMaxRetries: number;
  dbRetryBaseMs: number;
  checkOnce: boolean;
  force: boolean;
  rawDir?: string;
  from?: string;
  to?: string;
};

type ProcessMatch = {
  processId: number;
  name: string;
  commandLine: string;
};

type PendingProbe = {
  discoveredRawDates?: number;
  shardRawDates?: number;
  completedImports?: number;
  pendingDates?: number;
  selectedDates?: number;
};

type ShardRecord = {
  id: number;
  pid: number;
  progressFile: string;
  outLog: string;
  errLog: string;
};

type ShardWaveManifest = {
  shards?: Array<{ id?: number }>;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(LOG_DIR, { recursive: true });
  console.log(
    JSON.stringify(
      {
        supervisor: "thedogs-race-day-archive",
        startedAt: new Date().toISOString(),
        options,
      },
      null,
      2
    )
  );

  if (options.checkOnce) {
    const [active, probe] = await Promise.all([
      findActiveRaceDayArchiveWorkers(),
      probePendingArchives(options),
    ]);
    const activeShardIndexes = uniqueActiveShardIndexes(active);
    const cappedMissing = cappedMissingShardIndexes(options, activeShardIndexes);
    console.log(
      JSON.stringify(
        {
          checkOnce: true,
          activeArchiveImportProcesses: active.length,
          activeShardIndexes,
          missingShardIndexes: missingShardIndexes(options.workers, activeShardIndexes),
          cappedMissingShardIndexes: cappedMissing,
          pendingProbe: probe,
          action: hasUnshardedImporter(active)
            ? "wait"
            : cappedMissing.length > 0
              ? "start_capped_missing_when_supervising"
              : "wait_for_active_shards",
        },
        null,
        2
      )
    );
    return;
  }

  let wavesStarted = 0;
  let nextShardIndex = await nextShardIndexFromManifest(options.workers);
  for (;;) {
    if (options.maxWaves > 0 && wavesStarted >= options.maxWaves) {
      console.log(
        `[supervise:thedogs:race-day-archive] max waves reached: ${options.maxWaves}`
      );
      return;
    }

    const active = await findActiveRaceDayArchiveWorkers();
    if (hasUnshardedImporter(active) && !options.force) {
      console.log(
        `[supervise:thedogs:race-day-archive] waiting: unsharded race-day archive importer active (${active.length} process rows)`
      );
      await sleep(options.pollMs);
      continue;
    }

    const activeShardIndexes = uniqueActiveShardIndexes(active);
    const missingIndexes = cappedMissingShardIndexes(options, activeShardIndexes, nextShardIndex);
    if (missingIndexes.length === 0) {
      console.log(
        `[supervise:thedogs:race-day-archive] waiting: ${activeShardIndexes.length}/${options.maxActiveShards} active shard indexes`
      );
      await sleep(options.pollMs);
      continue;
    }

    const probe = await probePendingArchives(options);
    console.log(
      `[supervise:thedogs:race-day-archive] pending probe: ${JSON.stringify(probe)}`
    );
    if ((probe.pendingDates ?? 0) <= 0 || (probe.selectedDates ?? 0) <= 0) {
      console.log("[supervise:thedogs:race-day-archive] no pending raw archives remain");
      return;
    }

    wavesStarted += 1;
    await startShardWave(options, wavesStarted, missingIndexes);
    nextShardIndex = nextShardAfter(missingIndexes.at(-1) ?? nextShardIndex, options.workers);
    await sleep(options.pollMs);
  }
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  return {
    workers: positiveInt(stringOption(values, "workers"), 20),
    maxActiveShards: positiveInt(stringOption(values, "max-active-shards"), 5),
    pollMs: positiveInt(stringOption(values, "poll-ms"), 60_000),
    launchSpacingMs: nonNegativeInt(stringOption(values, "launch-spacing-ms"), 1_500),
    maxWaves: nonNegativeInt(stringOption(values, "max-waves"), 0),
    full: !values.has("no-full"),
    limitPerShard: positiveInt(stringOption(values, "limit-per-shard"), 250),
    dbMaxRetries: nonNegativeInt(stringOption(values, "db-max-retries"), 6),
    dbRetryBaseMs: positiveInt(stringOption(values, "db-retry-base-ms"), 1_500),
    checkOnce: values.has("check-once"),
    force: values.has("force"),
    rawDir: stringOption(values, "raw-dir"),
    from: stringOption(values, "from"),
    to: stringOption(values, "to"),
  };
}

async function probePendingArchives(options: Options): Promise<PendingProbe> {
  const args = [
    "run",
    "import:thedogs:race-day-archive",
    "--",
    "--dry-run",
    "--no-progress",
    "--limit",
    "1",
  ];
  if (options.rawDir) args.push("--raw-dir", options.rawDir);
  if (options.from) args.push("--from", options.from);
  if (options.to) args.push("--to", options.to);

  const result = await runNpm(args);
  if (result.exitCode !== 0) {
    throw new Error(`pending probe failed with code ${String(result.exitCode)}: ${result.stderr}`);
  }
  return parseFirstJsonObject(result.stdout) as PendingProbe;
}

async function startShardWave(options: Options, waveNumber: number, shardIndexes: number[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shards: ShardRecord[] = [];

  for (const index of shardIndexes) {
    const progressFile = path.join(
      BACKFILL_DIR,
      `thedogs-raw-archive-import-shard-${index}-of-${options.workers}.jsonl`
    );
    const outLog = path.join(
      LOG_DIR,
      `thedogs-race-day-archive-import-shard-${index}-wave-${waveNumber}-${stamp}.out.log`
    );
    const errLog = path.join(
      LOG_DIR,
      `thedogs-race-day-archive-import-shard-${index}-wave-${waveNumber}-${stamp}.err.log`
    );
    const out = openSync(outLog, "a");
    const err = openSync(errLog, "a");
    const launch = launchCommand(archiveImportArgs(options, index, progressFile));
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
    if (options.launchSpacingMs > 0) await sleep(options.launchSpacingMs);
  }

  const manifest = {
    launchedAt: new Date().toISOString(),
    wave: waveNumber,
    workers: options.workers,
    startedShards: shardIndexes.length,
    full: options.full,
    limitPerShard: options.limitPerShard,
    shards,
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[supervise:thedogs:race-day-archive] started wave ${waveNumber} with ${shards.length} missing shard(s): ${shardIndexes.join(",")}`
  );
}

function archiveImportArgs(options: Options, shardIndex: number, progressFile: string) {
  const args = [
    "run",
    "import:thedogs:race-day-archive",
    "--",
    "--shard-index",
    String(shardIndex),
    "--shard-count",
    String(options.workers),
    "--progress-file",
    progressFile,
    "--skip-schema-ensure",
    "--continue-on-error",
    "--max-errors",
    "500",
    "--db-max-retries",
    String(options.dbMaxRetries),
    "--db-retry-base-ms",
    String(options.dbRetryBaseMs),
  ];
  if (options.full) {
    args.push("--full");
  } else {
    args.push("--limit", String(options.limitPerShard));
  }
  if (options.rawDir) args.push("--raw-dir", options.rawDir);
  if (options.from) args.push("--from", options.from);
  if (options.to) args.push("--to", options.to);
  return args;
}

function runNpm(npmArgs: string[]) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const launch = launchCommand(npmArgs);
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      const child = spawn(launch.command, launch.args, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.once("error", reject);
      child.once("exit", (code: number | null) => {
        resolve({
          exitCode: code,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        });
      });
    }
  );
}

async function findActiveRaceDayArchiveWorkers(): Promise<ProcessMatch[]> {
  if (process.platform !== "win32") return [];
  const script = [
    "Get-CimInstance Win32_Process |",
    "Where-Object {",
    "$_.CommandLine -match 'import-thedogs-race-day-archive\\.ts'",
    "-and $_.CommandLine -notmatch 'supervise-thedogs-race-day-archive-import\\.ts'",
    "-and $_.Name -notlike 'powershell*'",
    "-and $_.Name -ne 'pwsh.exe'",
    "} | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Depth 3",
  ].join(" ");
  const result = await runPowerShell(script);
  if (!result.trim()) return [];
  try {
    const parsed = JSON.parse(result) as unknown;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .map((row) => normalizeProcessMatch(row))
      .filter((row): row is ProcessMatch => row != null);
  } catch {
    return [];
  }
}

function runPowerShell(script: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", script], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8"));
        return;
      }
      reject(new Error(Buffer.concat(stderr).toString("utf8")));
    });
  });
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

function hasUnshardedImporter(active: ProcessMatch[]) {
  return active.some((process) => shardIndexFromCommandLine(process.commandLine) == null);
}

function uniqueActiveShardIndexes(active: ProcessMatch[]) {
  return [
    ...new Set(
      active
        .map((process) => shardIndexFromCommandLine(process.commandLine))
        .filter((index): index is number => index != null)
    ),
  ].sort((a, b) => a - b);
}

function missingShardIndexes(workerCount: number, activeShardIndexes: number[]) {
  const active = new Set(activeShardIndexes);
  const missing: number[] = [];
  for (let index = 1; index <= workerCount; index += 1) {
    if (!active.has(index)) missing.push(index);
  }
  return missing;
}

function cappedMissingShardIndexes(
  options: Options,
  activeShardIndexes: number[],
  startAt = 1
) {
  const capacity = Math.max(
    Math.min(options.maxActiveShards, options.workers) - activeShardIndexes.length,
    0
  );
  if (capacity <= 0) return [];
  return rotateShardIndexes(missingShardIndexes(options.workers, activeShardIndexes), startAt).slice(
    0,
    capacity
  );
}

function rotateShardIndexes(indexes: number[], startAt: number) {
  return [
    ...indexes.filter((index) => index >= startAt),
    ...indexes.filter((index) => index < startAt),
  ];
}

async function nextShardIndexFromManifest(workerCount: number) {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8")) as ShardWaveManifest;
    const lastId = manifest.shards?.at(-1)?.id;
    return nextShardAfter(lastId, workerCount);
  } catch {
    return 1;
  }
}

function nextShardAfter(value: number | undefined, workerCount: number) {
  if (!value || !Number.isFinite(value)) return 1;
  return value >= workerCount ? 1 : value + 1;
}

function shardIndexFromCommandLine(commandLine: string) {
  const match = commandLine.match(/--shard-index(?:=|\s+)(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseFirstJsonObject(output: string) {
  const start = output.indexOf("{");
  if (start < 0) throw new Error("No JSON object found in command output");

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < output.length; index += 1) {
    const char = output[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(output.slice(start, index + 1)) as unknown;
    }
  }

  throw new Error("Could not parse complete JSON object from command output");
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

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("[supervise:thedogs:race-day-archive] failed:", error);
  process.exitCode = 1;
});
