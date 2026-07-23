import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  statfs,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, basename, dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import {
  CUTOFF,
  DATABASE_NAME,
  assertSafeContainerInspect,
  calculateDiskProjection,
  redactDiagnostic,
} from "./lib.mjs";
import { verifyInventoryRun } from "./verify.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const INVENTORY_SQL = resolve(SCRIPT_DIR, "inventory.sql");
const TABLES = ["Dog", "Meeting", "Race", "RaceVideo", "Result", "Runner", "Track", "Trainer"];

const PREFLIGHT_SQL = String.raw`COPY (
WITH guard AS (
  SELECT CASE
    WHEN current_database() = 'giq_production_stage11_20260718_r2'
      AND current_setting('transaction_read_only') = 'on'
      AND current_setting('transaction_isolation') = 'repeatable read'
      AND inet_server_addr() IS NULL
      AND session_user = 'postgres'
      AND current_user = 'postgres'
      AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
    THEN true
    ELSE length(current_database()) / 0 = 0
  END AS ok
), table_stats AS (
  SELECT COUNT(*)::integer AS table_count, SUM(pg_table_size(c.oid))::bigint AS source_table_bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY['Dog', 'Meeting', 'Race', 'RaceVideo', 'Result', 'Runner', 'Track', 'Trainer'])
    AND c.relkind IN ('r', 'p')
), row_stats AS (
  SELECT
    (SELECT COUNT(*)::bigint FROM "Race" WHERE "raceTime" >= TIMESTAMP '2006-01-01 00:00:00') AS race_count,
    (SELECT COUNT(*)::bigint FROM "Runner" ru JOIN "Race" r ON r.id = ru."raceId" WHERE r."raceTime" >= TIMESTAMP '2006-01-01 00:00:00') AS runner_count,
    (SELECT COUNT(*)::bigint FROM "RaceVideo" rv JOIN "Race" r ON r.id = rv."raceId" WHERE r."raceTime" >= TIMESTAMP '2006-01-01 00:00:00') AS video_count
)
SELECT json_build_object(
  'database', current_database(),
  'readOnly', current_setting('transaction_read_only') = 'on',
  'isolation', current_setting('transaction_isolation'),
  'unixSocket', inet_server_addr() IS NULL,
  'sessionUser', session_user,
  'pgcrypto', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'),
  'tableCount', ts.table_count,
  'sourceTableBytes', ts.source_table_bytes,
  'raceCount', rs.race_count,
  'runnerCount', rs.runner_count,
  'videoCount', rs.video_count,
  'cutoff', '2006-01-01T00:00:00.000Z'
)
FROM guard g
CROSS JOIN table_stats ts
CROSS JOIN row_stats rs
WHERE g.ok
) TO STDOUT;`;

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value == null || value.startsWith("--")) {
      throw new Error("Usage: node export.mjs --container NAME --output ABSOLUTE_RUN_DIRECTORY");
    }
    values.set(key.slice(2), value);
  }
  if (values.size !== 2 || !values.has("container") || !values.has("output")) {
    throw new Error("Both --container and --output are required; no connection defaults exist");
  }
  return { container: values.get("container"), output: values.get("output") };
}

function assertArguments({ container, output }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(container)) {
    throw new Error("Container must be one explicit Docker name, not an ID, URL, or option");
  }
  if (!isAbsolute(output)) {
    throw new Error("Output must be an absolute run-directory path");
  }
  if (resolve(output) === parse(resolve(output)).root) {
    throw new Error("Output cannot be a filesystem root");
  }
  if (basename(output).endsWith(".partial")) {
    throw new Error("Do not include the reserved .partial suffix in --output");
  }
}

async function capture(command, args, input = null) {
  const child = spawn(command, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => {
    if (stderr.reduce((size, part) => size + part.length, 0) < 65_536) stderr.push(chunk);
  });
  child.stdin.on("error", () => {});
  child.stdin.end(input ?? undefined);
  const code = await new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("close", accept);
  });
  if (code !== 0) {
    throw new Error(`${command} failed (${code}): ${redactDiagnostic(Buffer.concat(stderr).toString("utf8"))}`);
  }
  return Buffer.concat(stdout).toString("utf8");
}

function psqlArgs(container) {
  return [
    "exec",
    "--interactive",
    "--user",
    "postgres",
    "--env",
    "PGOPTIONS=-cdefault_transaction_read_only=on -cdefault_transaction_isolation=repeatable\\ read -cwork_mem=64MB",
    "--env",
    "PGHOST=/var/run/postgresql",
    "--env",
    "PGPORT=5432",
    "--env",
    "PGUSER=postgres",
    "--env",
    "PGPASSFILE=/dev/null",
    container,
    "env",
    "--unset=PGSERVICE",
    "psql",
    "--no-psqlrc",
    "--quiet",
    "--tuples-only",
    "--no-align",
    "--set=ON_ERROR_STOP=on",
    `--dbname=${DATABASE_NAME}`,
    "--file=-",
  ];
}

async function preflight(container) {
  const raw = await capture("docker", psqlArgs(container), PREFLIGHT_SQL);
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) throw new Error("Preflight did not return exactly one JSON record");
  const result = JSON.parse(lines[0]);
  if (
    result.database !== DATABASE_NAME ||
    result.readOnly !== true ||
    result.isolation !== "repeatable read" ||
    result.unixSocket !== true ||
    result.sessionUser !== "postgres" ||
    result.pgcrypto !== true ||
    result.cutoff !== CUTOFF ||
    result.tableCount !== TABLES.length
  ) {
    throw new Error("Database identity, isolation, extension, cutoff, or table preflight failed");
  }
  for (const field of ["sourceTableBytes", "raceCount", "runnerCount", "videoCount"]) {
    if (!Number.isSafeInteger(result[field]) || result[field] < (field === "raceCount" ? 1 : 0)) {
      throw new Error(`Preflight ${field} is missing or unsafe`);
    }
  }
  return result;
}

async function streamInventory(container, sql, destination) {
  const child = spawn("docker", psqlArgs(container), {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    if (stderr.length < 65_536) stderr += chunk.toString("utf8");
  });
  child.stdin.on("error", () => {});
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  const streamed = pipeline(child.stdout, createGzip({ level: 6 }), output);
  child.stdin.end(sql);
  const code = await new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("close", accept);
  });
  await streamed;
  if (code !== 0) {
    throw new Error(`Inventory COPY failed (${code}): ${redactDiagnostic(stderr)}`);
  }
}

export async function runExport(argv) {
  const options = parseArgs(argv);
  assertArguments(options);
  const output = resolve(options.output);
  const partial = `${output}.partial`;
  const parent = dirname(output);
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new Error("Output parent must be an existing real directory");
  }
  try {
    await lstat(output);
    throw new Error("Final inventory directory already exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const inspectText = await capture("docker", [
    "inspect",
    "--type",
    "container",
    "--format={{json .}}",
    options.container,
  ]);
  const safeContainer = assertSafeContainerInspect(JSON.parse(inspectText), options.container);
  const source = await preflight(options.container);
  const projection = calculateDiskProjection({
    sourceTableBytes: source.sourceTableBytes,
    raceCount: source.raceCount,
    runnerCount: source.runnerCount,
    videoCount: source.videoCount,
  });
  const disk = await statfs(parent, { bigint: true });
  const freeBytes = disk.bavail * disk.bsize;
  if (freeBytes < BigInt(projection.requiredFreeBytes)) {
    throw new Error("Insufficient free disk for the conservative inventory projection");
  }

  await mkdir(partial, { mode: 0o700 });
  await chmod(partial, 0o700);
  const sql = await readFile(INVENTORY_SQL, "utf8");
  const context = {
    schema: "greyhoundiq.replay-production-inventory.export-context",
    version: 1,
    createdAt: new Date().toISOString(),
    database: DATABASE_NAME,
    cutoff: CUTOFF,
    container: {
      id: safeContainer.containerId,
      name: safeContainer.containerName,
      image: safeContainer.image,
      networkMode: safeContainer.networkMode,
      publishedPorts: 0,
    },
    preflight: source,
    projection: {
      ...projection,
      freeBytes: freeBytes.toString(),
    },
    querySha256: createHash("sha256").update(sql).digest("hex"),
    rawLedgerContainsRestrictedUrls: true,
    playbackVerified: false,
  };
  const contextPath = resolve(partial, "export-context.json");
  await writeFile(contextPath, `${JSON.stringify(context, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await chmod(contextPath, 0o600);

  const ledger = resolve(partial, "race-replay-inventory.restricted.jsonl.gz");
  await streamInventory(options.container, sql, ledger);
  const verified = await verifyInventoryRun(partial, { finalize: true });
  process.stdout.write(
    `Replay inventory complete: ${verified.manifest.lineCount} races; ` +
    `manifest ${verified.manifestPath}\n`
  );
  return verified;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runExport(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Replay inventory refused: ${redactDiagnostic(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}
