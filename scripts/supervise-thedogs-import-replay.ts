/**
 * Supervisor for replaying harvested The Dogs raw archives into the database.
 *
 * This waits for the import database preflight to pass before starting any
 * import batch. It is safe to leave running while raw race/profile harvesting
 * continues because each batch resumes from its own import progress file.
 *
 * Examples:
 *   npm run supervise:thedogs:imports -- --check-once
 *   npm run supervise:thedogs:imports -- --max-batches 20 --poll-ms 300000
 */
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(".backfill", "logs");
const DB_UNAVAILABLE_EXIT_CODE = 75;

type Options = {
  maxBatches: number;
  pollMs: number;
  rawLimit: number;
  profileLimit: number;
  batchTimeoutMs: number;
  candidateTimeoutMs: number;
  debugSync: boolean;
  pauseMs: number;
  maxErrors: number;
  retryAttempts: number;
  retryDelayMs: number;
  checkOnce: boolean;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(LOG_DIR, { recursive: true });
  console.log(
    JSON.stringify(
      {
        supervisor: "thedogs-import-replay",
        startedAt: new Date().toISOString(),
        options,
      },
      null,
      2
    )
  );

  const firstCheck = await preflightDatabase();
  console.log(
    `[supervise:thedogs:imports] database preflight: ${JSON.stringify(firstCheck)}`
  );
  if (options.checkOnce) return;

  let batchesStarted = 0;
  for (;;) {
    if (options.maxBatches > 0 && batchesStarted >= options.maxBatches) {
      console.log(`[supervise:thedogs:imports] max batches reached: ${options.maxBatches}`);
      return;
    }

    const check = await preflightDatabase();
    if (!check.ok) {
      console.log(
        `[supervise:thedogs:imports] database unavailable; waiting ${options.pollMs}ms: ${check.stderr || check.stdout}`
      );
      await sleep(options.pollMs);
      continue;
    }

    batchesStarted += 1;
    const rawResult = await runImportBatch("raw", options, batchesStarted);
    if (rawResult.exitCode === DB_UNAVAILABLE_EXIT_CODE) {
      console.log("[supervise:thedogs:imports] raw import reported DB unavailable; waiting");
      await sleep(options.pollMs);
      continue;
    }
    if (rawResult.exitCode !== 0) {
      throw new Error(`raw import batch ${batchesStarted} exited with ${String(rawResult.exitCode)}`);
    }

    const profileResult = await runImportBatch("profiles", options, batchesStarted);
    if (profileResult.exitCode === DB_UNAVAILABLE_EXIT_CODE) {
      console.log("[supervise:thedogs:imports] profile import reported DB unavailable; waiting");
      await sleep(options.pollMs);
      continue;
    }
    if (profileResult.exitCode !== 0) {
      throw new Error(
        `profile import batch ${batchesStarted} exited with ${String(profileResult.exitCode)}`
      );
    }
  }
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

async function runImportBatch(
  kind: "raw" | "profiles",
  options: Options,
  batchNumber: number
) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const outLog = path.join(LOG_DIR, `thedogs-import-${kind}-${batchNumber}-${stamp}.out.log`);
  const errLog = path.join(LOG_DIR, `thedogs-import-${kind}-${batchNumber}-${stamp}.err.log`);
  console.log(`[supervise:thedogs:imports] starting ${kind} batch ${batchNumber}`);
  const result = await runNpm(importArgs(kind, options), {
    outLog,
    errLog,
    timeoutMs: options.batchTimeoutMs,
  });
  console.log(
    `[supervise:thedogs:imports] ${kind} batch ${batchNumber} exited with code ${String(result.exitCode)}`
  );
  return result;
}

function importArgs(kind: "raw" | "profiles", options: Options) {
  const script =
    kind === "raw" ? "import:thedogs:raw" : "import:thedogs:dog-profiles:raw";
  const limit = kind === "raw" ? options.rawLimit : options.profileLimit;
  return [
    "run",
    script,
    "--",
    "--limit",
    String(limit),
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
    "--candidate-timeout-ms",
    String(options.candidateTimeoutMs),
    ...(kind === "raw" && options.debugSync ? ["--debug-sync"] : []),
  ];
}

function runNpm(
  npmArgs: string[],
  options: { capture: true } | { outLog: string; errLog: string; timeoutMs: number }
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

      const out = openSync(options.outLog, "a");
      const err = openSync(options.errLog, "a");
      let timedOut = false;
      const child = spawn(command, args, {
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
              console.log(
                `[supervise:thedogs:imports] child exceeded ${options.timeoutMs}ms; killing process tree`
              );
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

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  return {
    maxBatches: nonNegativeInt(stringOption(values, "max-batches"), 100),
    pollMs: positiveInt(stringOption(values, "poll-ms"), 300_000),
    rawLimit: positiveInt(stringOption(values, "raw-limit"), 25),
    profileLimit: positiveInt(stringOption(values, "profile-limit"), 100),
    batchTimeoutMs: positiveInt(stringOption(values, "batch-timeout-ms"), 900_000),
    candidateTimeoutMs: positiveInt(stringOption(values, "candidate-timeout-ms"), 600_000),
    debugSync: values.has("debug-sync"),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 500),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 25),
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
  console.error("[supervise:thedogs:imports] failed:", error);
  process.exitCode = 1;
});
