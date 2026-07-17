import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectDatabaseCompatibilityInventory } from "./check-database-compatibility-inventory";
import {
  fingerprintRepositoryFiles,
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
} from "./design-lab-source-fingerprint";
import { assertLocalDatabaseUrl } from "./local-database-policy";

export const DATABASE_MIGRATION_REPLAY_PATH =
  "output/database-audit/migration-replay.json";
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REPLAY_PORT = 55_734;
const REPLAY_TARGET_DATABASE = "greyhoundiq";
const REPLAY_SHADOW_DATABASE = "greyhoundiq_shadow";
const REPLAY_RUNTIME_ROLE = "greyhoundiq_runtime";
const ENDPOINT_OVERRIDE_PARAMETERS = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "port",
  "socket",
]);
const REPLAY_CONTROL_FILES = [
  "package-lock.json",
  "prisma.config.ts",
  "scripts/check-database-compatibility-inventory.ts",
  "scripts/check-database-migration-replay.ts",
  "scripts/design-lab-source-fingerprint.ts",
  "scripts/local-database-policy.ts",
] as const;
const MAX_OUTPUT_LINES = 80;

export type SafeDatabaseTarget = {
  protocol: "postgresql";
  host: "127.0.0.1" | "[::1]";
  port: number;
  database: string;
};

export function assertMigrationReplayUrls(
  targetValue: string,
  shadowValue: string,
) {
  const target = safeDatabaseTarget(targetValue, "LOCAL_DATABASE_URL");
  const shadow = safeDatabaseTarget(
    shadowValue,
    "LOCAL_SHADOW_DATABASE_URL",
  );
  if (
    target.port === shadow.port &&
    target.database === shadow.database
  ) {
    throw new Error(
      "LOCAL_SHADOW_DATABASE_URL must name a database separate from the target; Prisma may reset the shadow database.",
    );
  }
  if (target.host !== shadow.host || target.port !== shadow.port) {
    throw new Error(
      "LOCAL_DATABASE_URL and LOCAL_SHADOW_DATABASE_URL must use the same disposable loopback server.",
    );
  }
  if (target.database !== REPLAY_TARGET_DATABASE) {
    throw new Error(
      `LOCAL_DATABASE_URL must name the disposable ${REPLAY_TARGET_DATABASE} database.`,
    );
  }
  if (shadow.database !== REPLAY_SHADOW_DATABASE) {
    throw new Error(
      `LOCAL_SHADOW_DATABASE_URL must name the disposable ${REPLAY_SHADOW_DATABASE} database.`,
    );
  }
  return { target, shadow };
}

export type MigrationReplaySourceState = {
  headSha: string;
  sourceSha256: string;
  sourceFileCount: number;
  schemaSha256: string;
  migrationsSha256: string;
  migrationCount: number;
  replayControlSha256: string;
};

export function assertMigrationReplaySourceUnchanged(
  before: MigrationReplaySourceState,
  after: MigrationReplaySourceState,
) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(
      "Repository source changed during migration replay; discard the run.",
    );
  }
}

export function evaluateMigrationReplayResult(
  exitCode: number,
  stdout: string,
  stderr: string,
) {
  const output = sanitizeMigrationReplayOutput(`${stdout}\n${stderr}`);
  return {
    status:
      exitCode === 0
        ? ("verified" as const)
        : exitCode === 2
          ? ("drift-detected" as const)
          : ("error" as const),
    exitCode,
    outputSha256: sha256(output),
    summary: output ? output.split("\n") : [],
  };
}

export function sanitizeMigrationReplayOutput(value: string) {
  return value
    .replace(
      /postgres(?:ql)?:\/\/[^\s"'`]+/giu,
      "<redacted-database-connection>",
    )
    .replace(
      /\b(authorization|proxy-authorization)\s*[=:]\s*(?:bearer\s+)?[^\s,;]+/giu,
      "$1=<redacted>",
    )
    .replace(/\bbearer\s+[^\s,;]+/giu, "Bearer <redacted>")
    .replace(
      /\b(password|secret|token|api[-_]?key)\s*[=:]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`|[^\s,;]+)/giu,
      "$1=<redacted>",
    )
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_OUTPUT_LINES)
    .join("\n");
}

export async function runDatabaseMigrationReplay(root = REPOSITORY_ROOT) {
  const targetUrl = requiredEnvironment("LOCAL_DATABASE_URL");
  const shadowUrl = requiredEnvironment("LOCAL_SHADOW_DATABASE_URL");
  const targets = assertMigrationReplayUrls(targetUrl, shadowUrl);
  const sourceBefore = getMigrationReplaySourceState(root);
  const cli = join(root, "node_modules", "prisma", "build", "index.js");

  const result = spawnSync(
    process.execPath,
    [
      cli,
      "migrate",
      "diff",
      "--exit-code",
      "--from-migrations",
      "prisma/migrations",
      "--to-url",
      targetUrl,
      "--shadow-database-url",
      shadowUrl,
    ],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: targetUrl, DIRECT_URL: targetUrl },
      encoding: "utf8",
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.error) {
    throw new Error("Prisma migration replay comparison could not be started.");
  }
  const exitCode = result.status ?? -1;
  const replay = evaluateMigrationReplayResult(
    exitCode,
    result.stdout ?? "",
    result.stderr ?? "",
  );
  const referenceSystemIdentifier = await collectReferenceSystemIdentifier(targetUrl);
  const sourceAfter = getMigrationReplaySourceState(root);
  assertMigrationReplaySourceUnchanged(sourceBefore, sourceAfter);

  const report = {
    schemaVersion: 2,
    auditKind: "isolated-postgres-migration-replay",
    generatedAt: new Date().toISOString(),
    safety: {
      scope: "literal-loopback-local-only",
      target: targets.target,
      shadow: targets.shadow,
      targetMutation: "none; Prisma migrate diff is read-only for the target",
      shadowMutation:
        "Prisma may reset the explicitly separate disposable shadow database",
      referenceSystemIdentifier,
    },
    sourceBinding: {
      testedCommitSha: sourceBefore.headSha,
      sourceSha256: sourceBefore.sourceSha256,
      sourceFileCount: sourceBefore.sourceFileCount,
      prismaSchemaSha256: sourceBefore.schemaSha256,
      migrationsSha256: sourceBefore.migrationsSha256,
      migrationCount: sourceBefore.migrationCount,
      replayControlSha256: sourceBefore.replayControlSha256,
    },
    replay,
    verdict: replay.status === "verified" ? "verified" : "blocked",
  } as const;
  const outputPath = resolve(root, DATABASE_MIGRATION_REPLAY_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, outputPath };
}

function safeDatabaseTarget(value: string, label: string): SafeDatabaseTarget {
  assertLocalDatabaseUrl(value);
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1") {
    throw new Error(`${label} must use literal 127.0.0.1.`);
  }
  for (const parameter of url.searchParams.keys()) {
    if (ENDPOINT_OVERRIDE_PARAMETERS.has(parameter.toLowerCase())) {
      throw new Error(`${label} must not override its endpoint in URL parameters.`);
    }
  }
  const username = decodeURIComponent(url.username);
  if (label === "LOCAL_DATABASE_URL" && username !== REPLAY_RUNTIME_ROLE) {
    throw new Error(
      `LOCAL_DATABASE_URL must use the isolated ${REPLAY_RUNTIME_ROLE} role.`,
    );
  }
  if (
    label === "LOCAL_SHADOW_DATABASE_URL" &&
    username !== "postgres"
  ) {
    throw new Error(
      "LOCAL_SHADOW_DATABASE_URL must use the local postgres administrative role.",
    );
  }
  if (url.password || [...url.searchParams].length > 0) {
    throw new Error(`${label} must be passwordless and contain no query parameters.`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!/^[A-Za-z_][A-Za-z0-9_$.-]*$/u.test(database)) {
    throw new Error(`${label} must name one simple local database.`);
  }
  const port = Number(url.port || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${label} has an invalid port.`);
  }
  if (port !== REPLAY_PORT) {
    throw new Error(`${label} must use the disposable replay port ${REPLAY_PORT}.`);
  }
  return {
    protocol: "postgresql",
    host: url.hostname as SafeDatabaseTarget["host"],
    port,
    database,
  };
}

export function getMigrationReplaySourceState(
  root: string,
): MigrationReplaySourceState {
  const source = getDesignLabSourceFingerprint(root);
  const compatibility = collectDatabaseCompatibilityInventory(root);
  const controls = fingerprintRepositoryFiles(root, REPLAY_CONTROL_FILES);
  return {
    headSha: getRepositoryHeadSha(root),
    sourceSha256: source.sha256,
    sourceFileCount: source.fileCount,
    schemaSha256: compatibility.schemaSha256,
    migrationsSha256: compatibility.migrationsSha256,
    migrationCount: compatibility.counts.migrations,
    replayControlSha256: controls.sha256,
  };
}

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required explicitly.`);
  return value;
}

async function collectReferenceSystemIdentifier(databaseUrl: string) {
  const { PrismaClient } = await import("@prisma/client");
  const url = new URL(databaseUrl);
  url.searchParams.set(
    "options",
    "-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=1000",
  );
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "5");
  url.searchParams.set("connect_timeout", "5");
  const client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    const rows = await client.$queryRawUnsafe<Array<{ systemIdentifier: string }>>(
      'SELECT system_identifier::text AS "systemIdentifier" FROM pg_control_system()',
    );
    const systemIdentifier = rows[0]?.systemIdentifier;
    if (!systemIdentifier || !/^\d{10,30}$/u.test(systemIdentifier)) {
      throw new Error("Migration replay target did not return a valid PostgreSQL system identifier.");
    }
    return systemIdentifier;
  } finally {
    await client.$disconnect();
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry) && resolve(entry) === fileURLToPath(import.meta.url);
}

async function main() {
  try {
    if (process.argv.length > 2) {
      throw new Error("Database migration replay does not accept CLI arguments; its evidence path is fixed.");
    }
    const { report, outputPath } = await runDatabaseMigrationReplay();
    console.log(
      `Database migration replay ${report.replay.status}; ${report.sourceBinding.migrationCount} migrations; evidence ${report.replay.outputSha256}.`,
    );
    console.log(`Report: ${outputPath}`);
    if (report.verdict !== "verified") process.exitCode = 1;
  } catch (error) {
    console.error(
      `Database migration replay failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (isMainModule()) void main();
