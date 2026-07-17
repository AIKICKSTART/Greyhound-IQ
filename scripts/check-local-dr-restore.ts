import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  fingerprintRepositoryFiles,
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
} from "./design-lab-source-fingerprint";
import {
  assertLocalDockerEndpointValue,
  assertNoDockerOverrides,
  DESIGN_LAB_DATABASE_IMAGE_ID,
  DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
} from "./design-lab-database";
import { stableJson } from "./staging-load-evidence";

export const LOCAL_DR_SCOPE = {
  evidenceClass: "local-disposable-backup-restore-simulation",
  managedCloudEligible: false,
  satisfiesManagedDisasterRecoveryGate: false,
  proves: [
    "the exact forward migrations deploy to a fresh PostgreSQL 15 database",
    "a custom-format logical backup restores into a second database",
    "catalog counts, proof rows, foreign keys, RLS metadata and restricted reads survive restore",
    "a row deleted before the backup remains absent after restore",
  ],
  doesNotProve: [
    "managed AlloyDB or Supabase backup and restore",
    "point-in-time recovery or continuous log replay",
    "cross-region replication, regional failover, DNS steering or failback",
    "production RTO, production RPO, provider IAM or immutable backup storage",
  ],
} as const;

export const LOCAL_DR_CONTAINER = "greyhoundiq-local-dr-proof";
export const LOCAL_DR_PORT = 55_736;

type LocalDrContainerProvenance = Readonly<{
  containerId: string;
  imageId: typeof DESIGN_LAB_DATABASE_IMAGE_ID;
  imageReference: typeof DESIGN_LAB_DATABASE_IMAGE_REFERENCE;
  name: typeof LOCAL_DR_CONTAINER;
  running: true;
  hostIp: "127.0.0.1";
  hostPort: typeof LOCAL_DR_PORT;
}>;

export type LocalDrMetrics = Readonly<{
  completedMigrations: number;
  publicTables: number;
  publicIndexes: number;
  publicConstraints: number;
  publicFunctions: number;
  rlsTables: number;
  forcedRlsTables: number;
  policies: number;
  proofRows: number;
  proofChildRows: number;
  deletedFixtureRows: number;
  proofChecksum: string;
}>;

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DATABASE = "greyhoundiq_source";
const RESTORE_DATABASE = "greyhoundiq_restore";
const DUMP_PATH = "/tmp/greyhoundiq-local-dr.dump";
const CONTAINER_LABEL = "com.greyhoundiq.owner=local-dr-proof";
const OUTPUT_DIRECTORY = resolve(
  REPOSITORY_ROOT,
  "output/production-readiness/local-dr",
);
const CONTROL_FILES = [
  "prisma.config.ts",
  "scripts/check-local-dr-restore.test.ts",
  "scripts/check-local-dr-restore.ts",
  "scripts/design-lab-database.ts",
  "scripts/design-lab-source-fingerprint.ts",
] as const;

export function assertLocalDrEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
) {
  assertNoDockerOverrides(environment);
  const configuredPort = environment.LOCAL_DR_PORT?.trim();
  if (configuredPort && configuredPort !== String(LOCAL_DR_PORT)) {
    throw new Error(`LOCAL_DR_PORT is pinned to ${LOCAL_DR_PORT}.`);
  }
}

export function parseLocalDrContainerInspect(
  value: string,
): LocalDrContainerProvenance {
  let records: unknown;
  try {
    records = JSON.parse(value);
  } catch {
    throw new Error("Local DR container inspection was not valid JSON.");
  }
  if (!Array.isArray(records) || records.length !== 1) {
    throw new Error("Local DR container inspection must contain exactly one record.");
  }
  const record = records[0] as {
    Id?: unknown;
    Image?: unknown;
    Name?: unknown;
    State?: { Running?: unknown };
    Config?: { Image?: unknown; Labels?: Record<string, unknown> };
    HostConfig?: {
      PortBindings?: Record<string, Array<{ HostIp?: unknown; HostPort?: unknown }>>;
    };
    NetworkSettings?: {
      Ports?: Record<string, Array<{ HostIp?: unknown; HostPort?: unknown }>>;
    };
  };
  const containerId = String(record.Id ?? "").toLowerCase();
  const configuredBinding = record.HostConfig?.PortBindings?.["5432/tcp"];
  const activeBinding = record.NetworkSettings?.Ports?.["5432/tcp"];
  const configured = configuredBinding?.[0];
  const active = activeBinding?.[0];
  if (!/^[0-9a-f]{64}$/u.test(containerId)) {
    throw new Error("Local DR container has an invalid ID.");
  }
  if (record.Image !== DESIGN_LAB_DATABASE_IMAGE_ID) {
    throw new Error("Local DR container does not use the pinned PostgreSQL image ID.");
  }
  if (record.Config?.Image !== DESIGN_LAB_DATABASE_IMAGE_REFERENCE) {
    throw new Error(
      "Local DR container does not use the pinned PostgreSQL image reference.",
    );
  }
  if (record.Name !== `/${LOCAL_DR_CONTAINER}` || record.State?.Running !== true) {
    throw new Error("Local DR container identity or running state is invalid.");
  }
  if (record.Config?.Labels?.["com.greyhoundiq.owner"] !== "local-dr-proof") {
    throw new Error("Local DR container is missing its fixed ownership label.");
  }
  for (const binding of [configured, active]) {
    if (
      binding?.HostIp !== "127.0.0.1" ||
      binding.HostPort !== String(LOCAL_DR_PORT)
    ) {
      throw new Error("Local DR container is not pinned to its loopback-only port.");
    }
  }
  return {
    containerId,
    imageId: DESIGN_LAB_DATABASE_IMAGE_ID,
    imageReference: DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
    name: LOCAL_DR_CONTAINER,
    running: true,
    hostIp: "127.0.0.1",
    hostPort: LOCAL_DR_PORT,
  };
}

export function evaluateLocalDrValidation(input: {
  source: LocalDrMetrics;
  restored: LocalDrMetrics;
  sourceRestrictedRows: number;
  restoredRestrictedRows: number;
}) {
  const findings: string[] = [];
  if (JSON.stringify(input.source) !== JSON.stringify(input.restored)) {
    findings.push("restored database metrics do not exactly match the source snapshot");
  }
  if (input.source.completedMigrations < 1) {
    findings.push("no completed Prisma migrations were restored");
  }
  if (input.source.rlsTables < 1 || input.source.policies < 1) {
    findings.push("RLS tables or policies were not present in the source snapshot");
  }
  if (input.source.proofRows !== 2 || input.source.proofChildRows !== 2) {
    findings.push("proof parent or child row counts are incorrect");
  }
  if (
    input.source.deletedFixtureRows !== 0 ||
    input.restored.deletedFixtureRows !== 0
  ) {
    findings.push("the fixture deleted before backup was revived");
  }
  if (
    input.sourceRestrictedRows !== 1 ||
    input.restoredRestrictedRows !== 1
  ) {
    findings.push("the restricted role did not see exactly one RLS-allowed row");
  }
  return findings;
}

export async function runLocalDrRestore(root = REPOSITORY_ROOT) {
  assertLocalDrEnvironment(process.env);
  assertLocalDockerContext(root);
  assertContainerNameAvailable(root);

  const sourceBefore = getDesignLabSourceFingerprint(root);
  const testedCommitSha = getRepositoryHeadSha(root);
  const controls = fingerprintRepositoryFiles(root, CONTROL_FILES);
  const preExistingContainers = listRunningContainerIds(root);
  let ownedContainerId: string | null = null;
  let cleanupVerified = false;

  try {
    ownedContainerId = startContainer(root);
    const provenance = inspectOwnedContainer(root, ownedContainerId);
    await waitForPostgres(root, ownedContainerId);

    const migrationStartedAt = Date.now();
    deployMigrations(root);
    const migrationDurationMilliseconds = Date.now() - migrationStartedAt;
    createProofFixtures(root, ownedContainerId);

    const source = collectMetrics(root, ownedContainerId, SOURCE_DATABASE);
    const sourceRestrictedRows = collectRestrictedRows(
      root,
      ownedContainerId,
      SOURCE_DATABASE,
    );
    const backupStartedAt = Date.now();
    runDocker(
      root,
      [
        "exec",
        ownedContainerId,
        "pg_dump",
        "--username",
        "postgres",
        "--dbname",
        SOURCE_DATABASE,
        "--format",
        "custom",
        "--no-owner",
        "--file",
        DUMP_PATH,
      ],
      "create the local logical backup",
    );
    const backupDurationMilliseconds = Date.now() - backupStartedAt;

    const restoreStartedAt = Date.now();
    runDocker(
      root,
      ["exec", ownedContainerId, "createdb", "--username", "postgres", RESTORE_DATABASE],
      "create the restore target database",
    );
    runDocker(
      root,
      [
        "exec",
        ownedContainerId,
        "pg_restore",
        "--username",
        "postgres",
        "--dbname",
        RESTORE_DATABASE,
        "--no-owner",
        "--exit-on-error",
        DUMP_PATH,
      ],
      "restore the local logical backup",
    );
    const restored = collectMetrics(root, ownedContainerId, RESTORE_DATABASE);
    const restoredRestrictedRows = collectRestrictedRows(
      root,
      ownedContainerId,
      RESTORE_DATABASE,
    );
    const restoreAndValidationDurationMilliseconds = Date.now() - restoreStartedAt;
    const findings = evaluateLocalDrValidation({
      source,
      restored,
      sourceRestrictedRows,
      restoredRestrictedRows,
    });

    cleanupOwnedContainer(root, ownedContainerId);
    ownedContainerId = null;
    cleanupVerified = true;
    const postRunContainers = listRunningContainerIds(root);
    const missingPreExistingContainers = [...preExistingContainers].filter(
      (id) => !postRunContainers.has(id),
    );
    if (missingPreExistingContainers.length > 0) {
      findings.push(
        `${missingPreExistingContainers.length} pre-existing running container(s) were no longer running after the drill`,
      );
    }
    const sourceAfter = getDesignLabSourceFingerprint(root);
    if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) {
      findings.push("repository source changed during the local DR drill");
    }

    const generatedAt = new Date().toISOString();
    const evidence = {
      schemaVersion: 1,
      auditKind: "local-disposable-postgres-backup-restore",
      status: findings.length === 0 ? "passed" : "failed",
      generatedAt,
      scope: LOCAL_DR_SCOPE,
      sourceBinding: {
        testedCommitSha,
        workingTreeSource: sourceBefore,
        controlSha256: controls.sha256,
        controlFileCount: controls.fileCount,
      },
      safety: {
        dockerEndpoint: "verified-local-npipe-or-unix",
        container: provenance,
        storage: "anonymous disposable Docker volume removed with the owned container",
        cleanupVerified,
        preExistingRunningContainerCount: preExistingContainers.size,
        preExistingRunningContainersPreserved:
          missingPreExistingContainers.length === 0,
        providerAccess: "none",
      },
      measurements: {
        migrationDurationMilliseconds,
        backupDurationMilliseconds,
        restoreAndValidationDurationMilliseconds,
        simulatedRtoMilliseconds: restoreAndValidationDurationMilliseconds,
        simulatedRpo:
          "logical snapshot only; no point-in-time or continuous-replay claim",
        source,
        restored,
        sourceRestrictedRows,
        restoredRestrictedRows,
      },
      findings,
    } as const;
    const paths = writeEvidence(evidence, generatedAt);
    return { evidence, paths };
  } finally {
    if (ownedContainerId) {
      cleanupOwnedContainer(root, ownedContainerId);
    }
  }
}

function assertLocalDockerContext(root: string) {
  const result = spawnSync(
    "docker",
    ["context", "inspect", "--format", '{{(index .Endpoints "docker").Host}}'],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error("Unable to verify that Docker uses a local endpoint.");
  }
  assertLocalDockerEndpointValue(result.stdout.trim());
}

function assertContainerNameAvailable(root: string) {
  const result = spawnSync(
    "docker",
    ["container", "inspect", LOCAL_DR_CONTAINER],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000 },
  );
  if (result.status === 0) {
    throw new Error(
      `Container ${LOCAL_DR_CONTAINER} already exists; it was not changed or stopped.`,
    );
  }
}

function startContainer(root: string) {
  const output = runDocker(
    root,
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      LOCAL_DR_CONTAINER,
      "--label",
      CONTAINER_LABEL,
      "--publish",
      `127.0.0.1:${LOCAL_DR_PORT}:5432`,
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "--env",
      "POSTGRES_USER=postgres",
      "--env",
      `POSTGRES_DB=${SOURCE_DATABASE}`,
      DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
    ],
    "start the owned disposable PostgreSQL container",
  ).trim();
  if (!/^[0-9a-f]{64}$/iu.test(output)) {
    throw new Error("Docker did not return the owned disposable container ID.");
  }
  return output.toLowerCase();
}

function inspectOwnedContainer(root: string, expectedId: string) {
  const output = runDocker(
    root,
    ["container", "inspect", LOCAL_DR_CONTAINER],
    "inspect the owned disposable PostgreSQL container",
  );
  const provenance = parseLocalDrContainerInspect(output);
  if (provenance.containerId !== expectedId) {
    throw new Error("Owned local DR container ID changed unexpectedly.");
  }
  return provenance;
}

async function waitForPostgres(root: string, containerId: string) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const result = spawnSync(
      "docker",
      [
        "exec",
        containerId,
        "pg_isready",
        "--username",
        "postgres",
        "--dbname",
        SOURCE_DATABASE,
      ],
      { cwd: root, encoding: "utf8", windowsHide: true, timeout: 10_000 },
    );
    if (result.status === 0) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Owned disposable PostgreSQL did not become ready in 90 seconds.");
}

function deployMigrations(root: string) {
  const databaseUrl =
    `postgresql://postgres@127.0.0.1:${LOCAL_DR_PORT}/${SOURCE_DATABASE}`;
  const result = spawnSync(
    process.execPath,
    [resolve(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10 * 60_000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `Prisma migration deployment failed. ${summarizeOutput(
        `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
      )}`,
    );
  }
}

function createProofFixtures(root: string, containerId: string) {
  runPsql(
    root,
    containerId,
    SOURCE_DATABASE,
    `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'giq_dr_reader') THEN
    CREATE ROLE giq_dr_reader NOLOGIN;
  END IF;
END
$$;

CREATE TABLE public.giq_dr_parent (
  id text PRIMARY KEY,
  visible boolean NOT NULL,
  secret text NOT NULL
);
CREATE TABLE public.giq_dr_child (
  id text PRIMARY KEY,
  parent_id text NOT NULL REFERENCES public.giq_dr_parent(id) ON DELETE CASCADE,
  payload text NOT NULL
);
ALTER TABLE public.giq_dr_parent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giq_dr_parent FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_dr_visible_select
  ON public.giq_dr_parent
  FOR SELECT
  TO giq_dr_reader
  USING (visible);
GRANT USAGE ON SCHEMA public TO giq_dr_reader;
GRANT SELECT ON public.giq_dr_parent TO giq_dr_reader;

INSERT INTO public.giq_dr_parent (id, visible, secret) VALUES
  ('keep', true, 'alpha'),
  ('hidden', false, 'bravo'),
  ('deleted-before-backup', true, 'charlie');
INSERT INTO public.giq_dr_child (id, parent_id, payload) VALUES
  ('child-keep', 'keep', 'one'),
  ('child-hidden', 'hidden', 'two'),
  ('child-delete', 'deleted-before-backup', 'three');
DELETE FROM public.giq_dr_parent WHERE id = 'deleted-before-backup';
`,
  );
}

function collectMetrics(root: string, containerId: string, database: string) {
  const output = runPsql(
    root,
    containerId,
    database,
    `
SELECT json_build_object(
  'completedMigrations', (SELECT count(*)::int FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  'publicTables', (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'),
  'publicIndexes', (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public'),
  'publicConstraints', (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'),
  'publicFunctions', (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'),
  'rlsTables', (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity),
  'forcedRlsTables', (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity),
  'policies', (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public'),
  'proofRows', (SELECT count(*)::int FROM public.giq_dr_parent),
  'proofChildRows', (SELECT count(*)::int FROM public.giq_dr_child),
  'deletedFixtureRows', (SELECT count(*)::int FROM public.giq_dr_parent WHERE id = 'deleted-before-backup'),
  'proofChecksum', (SELECT md5(string_agg(id || ':' || visible::text || ':' || secret, ',' ORDER BY id)) FROM public.giq_dr_parent)
)::text;
`,
  ).trim();
  try {
    return JSON.parse(output) as LocalDrMetrics;
  } catch {
    throw new Error(`Could not parse ${database} validation metrics.`);
  }
}

function collectRestrictedRows(root: string, containerId: string, database: string) {
  const output = runPsql(
    root,
    containerId,
    database,
    `
BEGIN;
SET LOCAL ROLE giq_dr_reader;
SELECT count(*)::int FROM public.giq_dr_parent;
COMMIT;
`,
  );
  const count = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^\d+$/u.test(line));
  if (!count) throw new Error(`Could not parse ${database} restricted-row proof.`);
  return Number(count);
}

function runPsql(
  root: string,
  containerId: string,
  database: string,
  sql: string,
) {
  return runDocker(
    root,
    [
      "exec",
      "--interactive",
      containerId,
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set",
      "ON_ERROR_STOP=1",
      "--username",
      "postgres",
      "--dbname",
      database,
    ],
    `execute the fixed validation SQL in ${database}`,
    sql,
  );
}

function cleanupOwnedContainer(root: string, expectedId: string) {
  const result = spawnSync(
    "docker",
    ["container", "inspect", LOCAL_DR_CONTAINER],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000 },
  );
  if (result.status !== 0) return;
  const provenance = parseLocalDrContainerInspect(result.stdout);
  if (provenance.containerId !== expectedId) {
    throw new Error(
      "Refusing to stop a local DR container whose ID is not the owned ID.",
    );
  }
  runDocker(
    root,
    ["stop", "--time", "20", expectedId],
    "stop only the owned disposable PostgreSQL container",
  );
  const after = spawnSync(
    "docker",
    ["container", "inspect", LOCAL_DR_CONTAINER],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000 },
  );
  if (after.status === 0) {
    throw new Error("Owned local DR container was not removed after stop.");
  }
}

function listRunningContainerIds(root: string) {
  const output = runDocker(
    root,
    ["ps", "--no-trunc", "--format", "{{.ID}}"],
    "list running containers for the preservation proof",
  );
  return new Set(
    output
      .split(/\r?\n/u)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => /^[0-9a-f]{64}$/u.test(line)),
  );
}

function runDocker(
  root: string,
  arguments_: readonly string[],
  action: string,
  input?: string,
) {
  const result = spawnSync("docker", [...arguments_], {
    cwd: root,
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10 * 60_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Docker could not ${action}. ${summarizeOutput(
        `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
      )}`,
    );
  }
  return result.stdout ?? "";
}

function writeEvidence(evidence: unknown, generatedAt: string) {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const timestamp = generatedAt.replaceAll(":", "-");
  const versioned = resolve(OUTPUT_DIRECTORY, `${timestamp}.json`);
  const latest = resolve(OUTPUT_DIRECTORY, "latest.json");
  const contents = stableJson(evidence);
  writeFileSync(versioned, contents, "utf8");
  writeFileSync(latest, contents, "utf8");
  return {
    versioned: relative(REPOSITORY_ROOT, versioned).replaceAll("\\", "/"),
    latest: relative(REPOSITORY_ROOT, latest).replaceAll("\\", "/"),
  };
}

function summarizeOutput(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, "<redacted-database-connection>")
    .replace(
      /\b(password|secret|token|api[-_]?key)\s*[=:]\s*[^\s,;]+/giu,
      "$1=<redacted>",
    )
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-30)
    .join(" | ");
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
      pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  runLocalDrRestore()
    .then(({ evidence, paths }) => {
      console.log(`[local-dr] ${evidence.status}; evidence=${paths.latest}`);
      if (evidence.status !== "passed") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[local-dr] failed: ${String(error)}`);
      process.exitCode = 1;
    });
}
