/**
 * Supervisor for importing archived The Dogs dog-profile JSON into the DB.
 *
 * The profile import stores parsed dog stats, best times, box/distance history,
 * raw profile HTML/JSON, and form rows including weights and sectional data.
 * By default it waits until race-day archive DB imports are idle so the two
 * write-heavy jobs do not fight the Supabase pool.
 *
 * Examples:
 *   npm run supervise:thedogs:dog-profile-import -- --check-once
 *   npm run supervise:thedogs:dog-profile-import -- --batch-limit 100
 */
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(".backfill", "logs");
const DB_UNAVAILABLE_EXIT_CODE = 75;

type Options = {
  batchLimit: number;
  maxBatches: number;
  maxRaceArchiveImports: number;
  pollMs: number;
  batchTimeoutMs: number;
  pauseMs: number;
  maxErrors: number;
  retryAttempts: number;
  retryDelayMs: number;
  checkOnce: boolean;
};

type ProcessMatch = {
  processId: number;
  name: string;
  commandLine: string;
};

type PendingProbe = {
  discoveredProfiles?: number;
  completedImports?: number;
  pendingProfiles?: number;
  selectedProfiles?: number;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(LOG_DIR, { recursive: true });
  console.log(
    JSON.stringify(
      {
        supervisor: "thedogs-dog-profile-import",
        startedAt: new Date().toISOString(),
        options,
      },
      null,
      2
    )
  );

  if (options.checkOnce) {
    const [raceImports, profileImports, probe] = await Promise.all([
      findActiveRaceArchiveImports(),
      findActiveProfileImports(),
      probePendingProfiles(),
    ]);
    console.log(
      JSON.stringify(
        {
          checkOnce: true,
          activeRaceArchiveImportProcesses: raceImports.length,
          activeProfileImportProcesses: profileImports.length,
          pendingProbe: probe,
          action: actionForState(raceImports, profileImports, probe, options),
        },
        null,
        2
      )
    );
    return;
  }

  let batchesStarted = 0;
  for (;;) {
    if (options.maxBatches > 0 && batchesStarted >= options.maxBatches) {
      console.log(
        `[supervise:thedogs:dog-profile-import] max batches reached: ${options.maxBatches}`
      );
      return;
    }

    const raceImports = await findActiveRaceArchiveImports();
    if (raceImports.length > options.maxRaceArchiveImports) {
      console.log(
        `[supervise:thedogs:dog-profile-import] waiting: ${raceImports.length} race archive import process row(s) active`
      );
      await sleep(options.pollMs);
      continue;
    }

    const profileImports = await findActiveProfileImports();
    if (profileImports.length > 0) {
      console.log(
        `[supervise:thedogs:dog-profile-import] waiting: ${profileImports.length} profile import process row(s) active`
      );
      await sleep(options.pollMs);
      continue;
    }

    const probe = await probePendingProfiles();
    console.log(
      `[supervise:thedogs:dog-profile-import] pending probe: ${JSON.stringify(probe)}`
    );
    if ((probe.pendingProfiles ?? 0) <= 0 || (probe.selectedProfiles ?? 0) <= 0) {
      console.log("[supervise:thedogs:dog-profile-import] no pending profiles remain");
      return;
    }

    const dbCheck = await preflightDatabase();
    if (!dbCheck.ok) {
      console.log(
        `[supervise:thedogs:dog-profile-import] database unavailable; waiting: ${dbCheck.stderr || dbCheck.stdout}`
      );
      await sleep(options.pollMs);
      continue;
    }

    batchesStarted += 1;
    const result = await runImportBatch(options, batchesStarted);
    if (result.exitCode === DB_UNAVAILABLE_EXIT_CODE) {
      console.log(
        "[supervise:thedogs:dog-profile-import] profile import reported DB unavailable; waiting"
      );
      await sleep(options.pollMs);
      continue;
    }
    if (result.exitCode !== 0) {
      throw new Error(
        `profile import batch ${batchesStarted} exited with ${String(result.exitCode)}`
      );
    }
  }
}

function actionForState(
  raceImports: ProcessMatch[],
  profileImports: ProcessMatch[],
  probe: PendingProbe,
  options: Options
) {
  if (raceImports.length > options.maxRaceArchiveImports) return "wait_for_race_archive_imports";
  if (profileImports.length > 0) return "wait_for_profile_import";
  if ((probe.pendingProfiles ?? 0) <= 0 || (probe.selectedProfiles ?? 0) <= 0) {
    return "complete";
  }
  return "start_batch_when_supervising";
}

async function probePendingProfiles(): Promise<PendingProbe> {
  const result = await runNpm(
    [
      "run",
      "import:thedogs:dog-profiles:raw",
      "--",
      "--dry-run",
      "--no-progress",
      "--limit",
      "1",
    ],
    { capture: true }
  );
  if (result.exitCode !== 0) {
    throw new Error(`pending probe failed with code ${String(result.exitCode)}: ${result.stderr}`);
  }
  return parseFirstJsonObject(result.stdout) as PendingProbe;
}

async function preflightDatabase() {
  const result = await runNpm(["exec", "tsx", "scripts/preflight-import-database.ts"], {
    capture: true,
  });
  return {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: result.stdout.trim().slice(-1000),
    stderr: result.stderr.trim().slice(-2000),
  };
}

async function runImportBatch(options: Options, batchNumber: number) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const outLog = path.join(LOG_DIR, `thedogs-dog-profile-import-${batchNumber}-${stamp}.out.log`);
  const errLog = path.join(LOG_DIR, `thedogs-dog-profile-import-${batchNumber}-${stamp}.err.log`);
  console.log(
    `[supervise:thedogs:dog-profile-import] starting batch ${batchNumber}; logs: ${outLog}, ${errLog}`
  );
  const result = await runNpm(profileImportArgs(options), {
    outLog,
    errLog,
    timeoutMs: options.batchTimeoutMs,
  });
  console.log(
    `[supervise:thedogs:dog-profile-import] batch ${batchNumber} exited with code ${String(result.exitCode)}`
  );
  return result;
}

function profileImportArgs(options: Options) {
  return [
    "run",
    "import:thedogs:dog-profiles:raw",
    "--",
    "--limit",
    String(options.batchLimit),
    "--continue-on-error",
    "--stop-on-db-error",
    "--max-errors",
    String(options.maxErrors),
    "--pause-ms",
    String(options.pauseMs),
    "--retry-attempts",
    String(options.retryAttempts),
    "--retry-delay-ms",
    String(options.retryDelayMs),
  ];
}

function runNpm(
  npmArgs: string[],
  options: { capture: true } | { outLog: string; errLog: string; timeoutMs: number }
) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const launch = launchCommand(npmArgs);
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      if ("capture" in options) {
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
        return;
      }

      const out = openSync(options.outLog, "a");
      const err = openSync(options.errLog, "a");
      let timedOut = false;
      const child = spawn(launch.command, launch.args, {
        cwd: process.cwd(),
        stdio: ["ignore", out, err],
        windowsHide: true,
      });
      closeSync(out);
      closeSync(err);
      const timeout =
        options.timeoutMs > 0
          ? setTimeout(() => {
              timedOut = true;
              killProcessTree(child.pid);
            }, options.timeoutMs)
          : undefined;
      child.once("error", reject);
      child.once("exit", (code: number | null) => {
        if (timeout) clearTimeout(timeout);
        resolve({
          exitCode: timedOut ? DB_UNAVAILABLE_EXIT_CODE : code,
          stdout: "",
          stderr: "",
        });
      });
    }
  );
}

async function findActiveRaceArchiveImports() {
  return findProcesses(
    "($_.CommandLine -match 'import-thedogs-race-day-archive\\.ts' -or $_.CommandLine -match 'import:thedogs:race-day-archive')"
  );
}

async function findActiveProfileImports() {
  return findProcesses(
    "($_.CommandLine -match 'import-thedogs-dog-profile-raw\\.ts' -or $_.CommandLine -match 'import:thedogs:dog-profiles:raw')"
  );
}

async function findProcesses(predicate: string): Promise<ProcessMatch[]> {
  if (process.platform !== "win32") return [];
  const script = [
    "Get-CimInstance Win32_Process |",
    "Where-Object {",
    predicate,
    "-and $_.CommandLine -notmatch 'supervise-thedogs-dog-profile-import\\.ts'",
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

function killProcessTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Process may already have exited.
  }
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

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  return {
    batchLimit: positiveInt(stringOption(values, "batch-limit"), 100),
    maxBatches: nonNegativeInt(stringOption(values, "max-batches"), 0),
    maxRaceArchiveImports: nonNegativeInt(stringOption(values, "max-race-archive-imports"), 0),
    pollMs: positiveInt(stringOption(values, "poll-ms"), 60_000),
    batchTimeoutMs: positiveInt(stringOption(values, "batch-timeout-ms"), 900_000),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 250),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 50),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 1),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 1_000),
    checkOnce: values.has("check-once"),
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
  console.error("[supervise:thedogs:dog-profile-import] failed:", error);
  process.exitCode = 1;
});
