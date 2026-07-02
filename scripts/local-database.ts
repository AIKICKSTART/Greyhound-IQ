/**
 * Local Postgres control plane for high-volume The Dogs imports.
 *
 * This keeps bulk replay away from the remote Supabase pooler. It defaults to
 * postgres://postgres:postgres@localhost:55432/greyhoundiq and never edits .env.
 *
 * Examples:
 *   npm run db:local:up
 *   npm run db:local:migrate
 *   npm run db:local:status
 *   npm run db:local:import:race-archive
 *   npm run db:local:import:race-normalized -- --limit 25
 */
import { spawnSync } from "node:child_process";

const COMPOSE_FILE = "docker-compose.local-db.yml";
const LOCAL_DATABASE_URL =
  process.env.LOCAL_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:55432/greyhoundiq?connection_limit=20&pool_timeout=60&connect_timeout=10";
const LOCAL_PROGRESS_DIR = ".backfill";

type Command =
  | "up"
  | "down"
  | "reset"
  | "wait"
  | "migrate"
  | "preflight"
  | "status"
  | "import-race-archive"
  | "import-race-normalized"
  | "import-dog-archive"
  | "import-dog-normalized";

async function main() {
  const [command = "help", ...forwardedArgs] = process.argv.slice(2);
  switch (command as Command | "help") {
    case "up":
      runDockerCompose(["up", "-d"]);
      await waitForDatabase();
      break;
    case "down":
      runDockerCompose(["down"]);
      break;
    case "reset":
      runDockerCompose(["down", "-v"]);
      runDockerCompose(["up", "-d"]);
      await waitForDatabase();
      await ensureDatabaseTimezone();
      runNpx(["prisma", "migrate", "deploy"]);
      break;
    case "wait":
      await waitForDatabase();
      break;
    case "migrate":
      await ensureDatabaseTimezone();
      runNpx(["prisma", "migrate", "deploy"]);
      break;
    case "preflight":
      await ensureDatabaseTimezone();
      runNpm(["run", "check:env", "--", "--ci"]);
      runNpx(["prisma", "validate"]);
      runNpx(["prisma", "migrate", "status"]);
      break;
    case "status":
      await printStatus();
      break;
    case "import-race-archive":
      await ensureDatabaseTimezone();
      runNpm([
        "run",
        "import:thedogs:race-day-archive",
        "--",
        "--full",
        "--skip-schema-ensure",
        "--continue-on-error",
        "--max-errors",
        "1000",
        "--db-max-retries",
        "2",
        "--db-retry-base-ms",
        "250",
        "--progress-file",
        `${LOCAL_PROGRESS_DIR}/thedogs-local-race-day-archive-import-progress.jsonl`,
        ...forwardedArgs,
      ]);
      break;
    case "import-race-normalized":
      await ensureDatabaseTimezone();
      runNpm([
        "run",
        "import:thedogs:raw",
        "--",
        "--full",
        "--continue-on-error",
        "--max-errors",
        "1000",
        "--pause-ms",
        "0",
        "--retry-attempts",
        "2",
        "--retry-delay-ms",
        "500",
        "--candidate-timeout-ms",
        "900000",
        "--progress-file",
        `${LOCAL_PROGRESS_DIR}/thedogs-local-raw-import-progress.jsonl`,
        ...forwardedArgs,
      ]);
      break;
    case "import-dog-archive":
      await ensureDatabaseTimezone();
      runNpm([
        "run",
        "import:thedogs:dog-profiles:raw",
        "--",
        "--archive-only",
        "--full",
        "--skip-db-preflight",
        "--continue-on-error",
        "--max-errors",
        "1000",
        "--pause-ms",
        "0",
        "--retry-attempts",
        "1",
        "--retry-delay-ms",
        "500",
        "--progress-file",
        `${LOCAL_PROGRESS_DIR}/thedogs-local-dog-profile-archive-import-progress.jsonl`,
        ...forwardedArgs,
      ]);
      break;
    case "import-dog-normalized":
      await ensureDatabaseTimezone();
      runNpm([
        "run",
        "import:thedogs:dog-profiles:raw",
        "--",
        "--full",
        "--skip-db-preflight",
        "--continue-on-error",
        "--max-errors",
        "1000",
        "--pause-ms",
        "0",
        "--retry-attempts",
        "1",
        "--retry-delay-ms",
        "500",
        "--progress-file",
        `${LOCAL_PROGRESS_DIR}/thedogs-local-dog-profile-normalized-import-progress.jsonl`,
        ...forwardedArgs,
      ]);
      break;
    default:
      printHelp();
      process.exitCode = command === "help" ? 0 : 1;
  }
}

function localEnv() {
  return {
    ...cleanEnv(process.env),
    DATABASE_URL: LOCAL_DATABASE_URL,
    DIRECT_URL: LOCAL_DATABASE_URL,
    DATABASE_IMPORT_URL: LOCAL_DATABASE_URL,
    DATABASE_IMPORT_CONNECTION_LIMIT: process.env.DATABASE_IMPORT_CONNECTION_LIMIT ?? "20",
    DATABASE_IMPORT_POOL_TIMEOUT: process.env.DATABASE_IMPORT_POOL_TIMEOUT ?? "60",
    DATABASE_IMPORT_CONNECT_TIMEOUT: process.env.DATABASE_IMPORT_CONNECT_TIMEOUT ?? "10",
  };
}

async function ensureDatabaseTimezone() {
  process.env.DATABASE_URL = LOCAL_DATABASE_URL;
  process.env.DIRECT_URL = LOCAL_DATABASE_URL;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const databaseName = databaseNameFromUrl(LOCAL_DATABASE_URL);
    try {
      await prisma.$executeRawUnsafe(
        `ALTER DATABASE ${quoteIdentifier(databaseName)} SET timezone TO 'UTC'`
      );
    } catch (err) {
      if (!isConcurrentDatabaseSettingUpdate(err)) throw err;
    }
  } finally {
    await prisma.$disconnect();
  }
}

function isConcurrentDatabaseSettingUpdate(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return /tuple concurrently updated/i.test(message);
}

function runDockerCompose(args: string[]) {
  run("docker", ["compose", "-f", COMPOSE_FILE, ...args], { env: composeEnv() });
}

function runNpm(args: string[]) {
  run(npmCommand(), args, { env: localEnv() });
}

function runNpx(args: string[]) {
  run(npmCommand(), ["exec", "--", ...args], { env: localEnv() });
}

function run(command: string, args: string[], options: { env: Record<string, string> }) {
  const launch = launchCommand(command, args);
  const result = spawnSync(launch.command, launch.args, {
    cwd: process.cwd(),
    env: options.env as NodeJS.ProcessEnv,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status && result.status !== 0) process.exit(result.status);
}

async function waitForDatabase() {
  const startedAt = Date.now();
  for (;;) {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "-f",
        COMPOSE_FILE,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "greyhoundiq",
      ],
      {
        cwd: process.cwd(),
        env: composeEnv() as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
        windowsHide: true,
      }
    );
    if (result.status === 0) {
      console.log("[db:local] postgres is ready");
      return;
    }
    if (Date.now() - startedAt > 120_000) {
      throw new Error(
        `[db:local] postgres did not become ready within 120s: ${result.stderr || result.stdout}`
      );
    }
    await sleep(2_000);
  }
}

async function printStatus() {
  process.env.DATABASE_URL = LOCAL_DATABASE_URL;
  process.env.DIRECT_URL = LOCAL_DATABASE_URL;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const tables = [
      "RaceDayArchive",
      "DogProfileArchive",
      "Meeting",
      "Race",
      "Runner",
      "Result",
      "Dog",
      "DogProfileForm",
      "Trainer",
      "Track",
    ];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `select count(*)::bigint as count from "${table}"`
      );
      counts[table] = Number(rows[0]?.count ?? 0);
    }
    console.log(
      JSON.stringify(
        {
          databaseUrl: maskDatabaseUrl(LOCAL_DATABASE_URL),
          counts,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

function maskDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "<invalid-url>";
  }
}

function databaseNameFromUrl(value: string) {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/u, ""));
  if (!databaseName) throw new Error("LOCAL_DATABASE_URL is missing a database name");
  return databaseName;
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function composeEnv() {
  return {
    ...cleanEnv(process.env),
    COMPOSE_DISABLE_ENV_FILE: "1",
  };
}

function cleanEnv(env: NodeJS.ProcessEnv) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key || key.startsWith("=") || typeof value !== "string") continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function launchCommand(command: string, args: string[]) {
  if (process.platform !== "win32" || !/\.(cmd|bat)$/i.test(command)) {
    return { command, args };
  }
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(cmdQuote).join(" ")],
  };
}

function cmdQuote(value: string) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp() {
  console.log(`Usage: npm run db:local -- <command>

Commands:
  up                       Start local Postgres and wait until ready
  down                     Stop local Postgres
  reset                    Destroy local volume, restart, and apply migrations
  wait                     Wait until local Postgres is ready
  migrate                  Apply Prisma migrations to local Postgres
  preflight                Validate env, Prisma schema, and migration status
  status                   Print local row counts
  import-race-archive      Load raw day JSON into RaceDayArchive
  import-race-normalized   Replay raw day JSON into Meeting/Race/Runner/Result
  import-dog-archive       Load dog profile JSON into DogProfileArchive only
  import-dog-normalized    Replay dog profiles into Dog/DogProfileForm/etc.

Extra args after the command are forwarded to the underlying importer.
Default local URL: ${maskDatabaseUrl(LOCAL_DATABASE_URL)}
`);
}

main().catch((error) => {
  console.error("[db:local] failed:", error);
  process.exitCode = 1;
});
