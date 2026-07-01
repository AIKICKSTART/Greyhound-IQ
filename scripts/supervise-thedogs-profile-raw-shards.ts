/**
 * Sequential supervisor for sharded raw The Dogs dog-profile archive waves.
 *
 * A wave is a full set of raw profile shards. The supervisor waits for any
 * existing raw profile workers to finish, probes the latest raw race archive for
 * pending dogs, and starts the next sharded wave only if pending profiles remain.
 *
 * Examples:
 *   npm run supervise:thedogs:dog-profile-raw-shards
 *   npm run supervise:thedogs:dog-profile-raw-shards -- --check-once
 *   npm run supervise:thedogs:dog-profile-raw-shards -- --max-waves 4 --workers 20
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(".backfill", "logs");

type Options = {
  maxWaves: number;
  pollMs: number;
  workers: number;
  concurrency: number;
  pauseMs: number;
  maxErrors: number;
  retryAttempts: number;
  retryDelayMs: number;
  sort: "first-seen" | "appearances";
  rawDir?: string;
  outputDir?: string;
  from?: string;
  to?: string;
  checkOnce: boolean;
};

type ProcessMatch = {
  processId: number;
  name: string;
  commandLine: string;
};

type PendingProbe = {
  discoveredDogs?: number;
  shardDogs?: number;
  completedProfiles?: number;
  pendingProfiles?: number;
  selectedProfiles?: number;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(LOG_DIR, { recursive: true });
  console.log(
    JSON.stringify(
      {
        supervisor: "thedogs-profile-raw-shards",
        startedAt: new Date().toISOString(),
        options,
      },
      null,
      2
    )
  );

  if (options.checkOnce) {
    const active = await findActiveProfileWorkers();
    console.log(
      JSON.stringify(
        {
          checkOnce: true,
          activeProfileProcesses: active.length,
          action: active.length > 0 ? "wait" : "probe_then_start_when_supervising",
        },
        null,
        2
      )
    );
    return;
  }

  let wavesStarted = 0;
  for (;;) {
    if (options.maxWaves > 0 && wavesStarted >= options.maxWaves) {
      console.log(
        `[supervise:thedogs:dog-profile-raw-shards] max waves reached: ${options.maxWaves}`
      );
      return;
    }

    const active = await findActiveProfileWorkers();
    if (active.length > 0) {
      console.log(
        `[supervise:thedogs:dog-profile-raw-shards] waiting: ${active.length} raw profile process(es) active`
      );
      await sleep(options.pollMs);
      continue;
    }

    const probe = await probePendingProfiles(options);
    console.log(
      `[supervise:thedogs:dog-profile-raw-shards] pending probe: ${JSON.stringify(probe)}`
    );
    if ((probe.pendingProfiles ?? 0) <= 0 || (probe.selectedProfiles ?? 0) <= 0) {
      console.log("[supervise:thedogs:dog-profile-raw-shards] no pending profiles remain");
      return;
    }

    wavesStarted += 1;
    const result = await startShardWave(options, wavesStarted);
    if (result.exitCode !== 0) {
      throw new Error(
        `dog-profile raw shard wave ${wavesStarted} failed to start with code ${String(result.exitCode)}: ${result.stderr}`
      );
    }
  }
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  const sort = stringOption(values, "sort") === "first-seen" ? "first-seen" : "appearances";
  return {
    maxWaves: nonNegativeInt(stringOption(values, "max-waves"), 3),
    pollMs: positiveInt(stringOption(values, "poll-ms"), 60_000),
    workers: positiveInt(stringOption(values, "workers"), 20),
    concurrency: positiveInt(stringOption(values, "concurrency"), 1),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 1_500),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 500),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 2),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 2_500),
    sort,
    rawDir: stringOption(values, "raw-dir"),
    outputDir: stringOption(values, "output-dir"),
    from: stringOption(values, "from"),
    to: stringOption(values, "to"),
    checkOnce: values.has("check-once"),
  };
}

async function probePendingProfiles(options: Options): Promise<PendingProbe> {
  const result = await runNpm(profileProbeArgs(options), { capture: true });
  if (result.exitCode !== 0) {
    throw new Error(`pending probe failed with code ${String(result.exitCode)}: ${result.stderr}`);
  }
  return parseFirstJsonObject(result.stdout) as PendingProbe;
}

async function startShardWave(options: Options, waveNumber: number) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const outLog = path.join(
    LOG_DIR,
    `thedogs-profile-raw-shards-supervised-${waveNumber}-${stamp}.out.log`
  );
  const errLog = path.join(
    LOG_DIR,
    `thedogs-profile-raw-shards-supervised-${waveNumber}-${stamp}.err.log`
  );
  console.log(
    `[supervise:thedogs:dog-profile-raw-shards] starting wave ${waveNumber}; logs: ${outLog}, ${errLog}`
  );
  const result = await runNpm(profileShardStartArgs(options), { outLog, errLog });
  console.log(
    `[supervise:thedogs:dog-profile-raw-shards] wave ${waveNumber} start exited with code ${String(result.exitCode)}`
  );
  return result;
}

function profileProbeArgs(options: Options) {
  const args = [
    "run",
    "backfill:thedogs:dog-profile-raw",
    "--",
    "--dry-run",
    "--limit",
    "1",
    "--sort",
    options.sort,
  ];
  if (options.rawDir) args.push("--raw-dir", options.rawDir);
  if (options.outputDir) args.push("--output-dir", options.outputDir);
  if (options.from) args.push("--from", options.from);
  if (options.to) args.push("--to", options.to);
  return args;
}

function profileShardStartArgs(options: Options) {
  const args = [
    "run",
    "backfill:thedogs:dog-profile-raw-shards",
    "--",
    "start",
    "--workers",
    String(options.workers),
    "--concurrency",
    String(options.concurrency),
    "--pause-ms",
    String(options.pauseMs),
    "--max-errors",
    String(options.maxErrors),
    "--retry-attempts",
    String(options.retryAttempts),
    "--retry-delay-ms",
    String(options.retryDelayMs),
    "--sort",
    options.sort,
  ];
  if (options.rawDir) args.push("--raw-dir", options.rawDir);
  if (options.outputDir) args.push("--output-dir", options.outputDir);
  if (options.from) args.push("--from", options.from);
  if (options.to) args.push("--to", options.to);
  return args;
}

function runNpm(
  npmArgs: string[],
  options: { capture: true } | { outLog: string; errLog: string }
) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const command = process.platform === "win32" ? "cmd.exe" : "npm";
      const args =
        process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...npmArgs] : npmArgs;
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      if ("capture" in options) {
        const child = spawn(command, args, {
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
        return;
      }

      const out = createWriteStream(options.outLog, { flags: "a" });
      const err = createWriteStream(options.errLog, { flags: "a" });
      const child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: ["ignore", out, err],
        windowsHide: true,
      });
      child.once("error", reject);
      child.once("exit", (code: number | null) => {
        resolve({
          exitCode: code,
          stdout: "",
          stderr: "",
        });
      });
    }
  );
}

async function findActiveProfileWorkers(): Promise<ProcessMatch[]> {
  if (process.platform !== "win32") return [];
  const script = [
    "Get-CimInstance Win32_Process |",
    "Where-Object {",
    "$_.CommandLine -match 'backfill-thedogs-dog-profile-raw\\.ts'",
    "-and $_.CommandLine -notmatch 'backfill-thedogs-dog-profile-raw-shards\\.ts'",
    "-and $_.CommandLine -notmatch 'supervise-thedogs-profile-raw-shards\\.ts'",
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
  console.error("[supervise:thedogs:dog-profile-raw-shards] failed:", error);
  process.exitCode = 1;
});
