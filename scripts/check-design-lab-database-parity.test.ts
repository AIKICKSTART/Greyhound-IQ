import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DATABASE_CATALOG_COMPONENTS,
  DESIGN_LAB_APPLICATION_NAME,
  DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES,
  DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST,
  DESIGN_LAB_RUNTIME_ROLE,
  assertParityInputs,
  assertStableClusterIdentities,
  bindCurrentParityStateToAuditedCommit,
  collectCatalog,
  collectRuntimeRole,
  compareCatalogComponents,
  findDesignLabDatabaseParityIssues,
  findMigrationReplayIssues,
  parseDesignLabDatabaseParityArguments,
  writeDesignLabDatabaseParityReportAtomic,
  type DesignLabDatabaseParityBinding,
  type DesignLabDatabaseParityReport,
} from "./check-design-lab-database-parity";
import {
  collectApplicationBinding,
  collectClusterIdentity,
} from "./design-lab-database-parity-runtime";
import { findRepositoryCommitBindingIssues } from "./design-lab-database-parity-support";

const routineMigration = readFileSync(
  "prisma/migrations/20260714021500_pin_runtime_routine_allowlist/migration.sql",
  "utf8",
);
const routineArray = routineMigration.match(
  /allowed_routines text\[\] := ARRAY\[([\s\S]*?)\n  \];/u,
);
assert.ok(routineArray?.[1]);
assert.deepEqual(
  [...routineArray[1].matchAll(/^\s+'(giq_[^']+)'[,]?$/gmu)].map(
    (match) => match[1],
  ),
  [...DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST],
  "The forward migration and runtime privilege proof must share one exact routine allowlist",
);

const binding: DesignLabDatabaseParityBinding = {
  testedCommitSha: "a".repeat(40),
  sourceSha256: "b".repeat(64),
  sourceFileCount: 10,
  prismaSchemaSha256: "c".repeat(64),
  migrationsSha256: "d".repeat(64),
  migrationCount: 90,
  migrationReplaySha256: "e".repeat(64),
  migrationReplayControlSha256: "f".repeat(64),
  migrationReplayReferenceSystemIdentifier: "2234567890123456789",
  migrationReplayTestedCommitSha: "2".repeat(40),
  migrationReplayValid: true,
  parityControlSha256: "1".repeat(64),
  parityControlFileCount: DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES.length,
  sourceCommitBound: true,
  migrationReplayCommitBound: true,
  now: Date.parse("2026-07-14T00:01:00.000Z"),
};

const components = DATABASE_CATALOG_COMPONENTS.map((name, index) => ({
  name,
  rowCount: index + 1,
  sha256: String(index).padStart(64, "0"),
}));
const catalogSha256 = createHash("sha256")
  .update(JSON.stringify(components))
  .digest("hex");

assert.equal(compareCatalogComponents(components, components).length, components.length);
assert.throws(() => compareCatalogComponents(components.slice(1), components));

assert.equal(parseDesignLabDatabaseParityArguments([]), false);
assert.equal(
  parseDesignLabDatabaseParityArguments(["--validate-existing"]),
  true,
);
for (const args of [
  ["--unknown"],
  ["--validate-existing", "--validate-existing"],
  ["--validate-existing", "evidence.json"],
]) {
  assert.throws(
    () => parseDesignLabDatabaseParityArguments(args),
    /Unsupported database parity argument/u,
  );
}

assert.doesNotThrow(() =>
  assertParityInputs(
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ),
);
for (const values of [
  [
    "postgresql://postgres@db.example.test:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "https://example.test",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://localhost:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}&application_name=evil`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres:secret@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq?schema=public",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgres://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq#ignored",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}#ignored`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq#ignored",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://post%67res@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://greyhoundiq%5Fruntime@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000",
  ],
  [
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq",
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`,
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    "http://127.0.0.1:3000/",
  ],
]) {
  assert.throws(() => assertParityInputs(...(values as [string, string, string, string])));
}

const collectorGuardChecks = Promise.all([
  () => collectCatalog("https://127.0.0.1:55735/greyhoundiq"),
  () => collectRuntimeRole("https://127.0.0.1:55735/greyhoundiq"),
  () => collectClusterIdentity("https://127.0.0.1:55735/greyhoundiq"),
  () => collectApplicationBinding(
    "https://127.0.0.1:55735/greyhoundiq",
    "http://127.0.0.1:3000",
  ),
].map((collect) =>
  assert.rejects(collect, /pinned passwordless loopback contract/u),
));

const unknownArgument = spawnSync(
  process.execPath,
  [
    "node_modules/tsx/dist/cli.mjs",
    "scripts/check-design-lab-database-parity.ts",
    "--unknown",
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DESIGN_LAB_DATABASE_ADMIN_URL: "not-a-database-url",
    },
  },
);
assert.notEqual(unknownArgument.status, 0);
assert.match(unknownArgument.stderr, /Unsupported database parity argument/u);
assert.doesNotMatch(unknownArgument.stderr, /database URL|Docker|Prisma/iu);

assert.doesNotThrow(() =>
  assertStableClusterIdentities(
    {
      target: "1234567890123456789",
      reference: "2234567890123456789",
    },
    {
      target: "1234567890123456789",
      reference: "2234567890123456789",
    },
    "2234567890123456789",
  ),
);
assert.throws(() =>
  assertStableClusterIdentities(
    {
      target: "1234567890123456789",
      reference: "2234567890123456789",
    },
    {
      target: "3234567890123456789",
      reference: "2234567890123456789",
    },
    "2234567890123456789",
  ),
);

const commitBindingRoot = mkdtempSync(join(tmpdir(), "giq-parity-git-"));
try {
  const runGit = (args: readonly string[]) =>
    spawnSync("git", [...args], {
      cwd: commitBindingRoot,
      encoding: "utf8",
    });
  assert.equal(runGit(["init"]).status, 0);
  assert.equal(runGit(["config", "user.email", "parity@test.invalid"]).status, 0);
  assert.equal(runGit(["config", "user.name", "Parity Test"]).status, 0);
  writeFileSync(join(commitBindingRoot, "control.ts"), "export const value = 1;\n");
  assert.equal(runGit(["add", "control.ts"]).status, 0);
  assert.equal(runGit(["commit", "-m", "control"]).status, 0);
  assert.deepEqual(
    findRepositoryCommitBindingIssues(commitBindingRoot, ["control.ts"]),
    [],
  );
  writeFileSync(join(commitBindingRoot, "control.ts"), "export const value = 2;\n");
  assert.notDeepEqual(
    findRepositoryCommitBindingIssues(commitBindingRoot, ["control.ts"]),
    [],
  );
  writeFileSync(join(commitBindingRoot, "untracked.ts"), "export {};\n");
  assert.notDeepEqual(
    findRepositoryCommitBindingIssues(commitBindingRoot, ["untracked.ts"]),
    [],
  );
} finally {
  rmSync(commitBindingRoot, { recursive: true, force: true });
}

const ancestryRoot = mkdtempSync(join(tmpdir(), "giq-parity-ancestry-"));
try {
  const runGit = (args: readonly string[]) =>
    spawnSync("git", [...args], { cwd: ancestryRoot, encoding: "utf8" });
  assert.equal(runGit(["init"]).status, 0);
  assert.equal(runGit(["config", "user.email", "parity@test.invalid"]).status, 0);
  assert.equal(runGit(["config", "user.name", "Parity Test"]).status, 0);
  mkdirSync(join(ancestryRoot, "scripts"), { recursive: true });
  writeFileSync(
    join(ancestryRoot, "scripts", "check-design-lab-database-parity.ts"),
    "export const parity = 1;\n",
  );
  assert.equal(runGit(["add", "."]).status, 0);
  assert.equal(runGit(["commit", "-m", "source"]).status, 0);
  const auditedCommit = runGit(["rev-parse", "HEAD"]).stdout.trim();
  mkdirSync(join(ancestryRoot, "output"), { recursive: true });
  writeFileSync(join(ancestryRoot, "output", "evidence.json"), "{}\n");
  assert.equal(runGit(["add", "."]).status, 0);
  assert.equal(runGit(["commit", "-m", "evidence"]).status, 0);
  const evidenceCommit = runGit(["rev-parse", "HEAD"]).stdout.trim();
  assert.equal(
    bindCurrentParityStateToAuditedCommit(
      ancestryRoot,
      auditedCommit,
      { ...binding, testedCommitSha: evidenceCommit },
    ).testedCommitSha,
    auditedCommit,
  );
  const unrelatedCommit = runGit([
    "commit-tree",
    `${auditedCommit}^{tree}`,
    "-m",
    "unrelated",
  ]).stdout.trim();
  assert.match(unrelatedCommit, /^[0-9a-f]{40}$/u);
  assert.equal(
    bindCurrentParityStateToAuditedCommit(
      ancestryRoot,
      unrelatedCommit,
      { ...binding, testedCommitSha: evidenceCommit },
    ).testedCommitSha,
    evidenceCommit,
  );
  writeFileSync(
    join(ancestryRoot, "scripts", "check-design-lab-database-parity.ts"),
    "export const parity = 2;\n",
  );
  assert.equal(runGit(["add", "."]).status, 0);
  assert.equal(runGit(["commit", "-m", "source changed"]).status, 0);
  const changedHead = runGit(["rev-parse", "HEAD"]).stdout.trim();
  assert.equal(
    bindCurrentParityStateToAuditedCommit(
      ancestryRoot,
      auditedCommit,
      { ...binding, testedCommitSha: changedHead },
    ).testedCommitSha,
    changedHead,
  );
} finally {
  rmSync(ancestryRoot, { recursive: true, force: true });
}

const atomicWriteRoot = mkdtempSync(join(tmpdir(), "giq-parity-write-"));
try {
  const outputPath = join(atomicWriteRoot, "parity.json");
  writeFileSync(outputPath, "old\n");
  writeDesignLabDatabaseParityReportAtomic(outputPath, "new\n");
  assert.equal(readFileSync(outputPath, "utf8"), "new\n");
  assert.deepEqual(
    readdirSync(atomicWriteRoot).filter((name) => name.includes(".tmp-")),
    [],
  );
} finally {
  rmSync(atomicWriteRoot, { recursive: true, force: true });
}

const report: DesignLabDatabaseParityReport = {
  schemaVersion: 1,
  auditKind: "design-lab-database-parity",
  generatedAt: "2026-07-14T00:00:02.000Z",
  safety: {
    scope: "literal-loopback-isolated-databases",
    target: { protocol: "postgresql", host: "127.0.0.1", port: 55735, database: "greyhoundiq" },
    reference: { protocol: "postgresql", host: "127.0.0.1", port: 55734, database: "greyhoundiq" },
    productionContacted: false,
    mutation: "none-during-verification",
    clusterIdentity: {
      targetSystemIdentifier: "1234567890123456789",
      targetSystemIdentifierAfter: "1234567890123456789",
      referenceSystemIdentifier: "2234567890123456789",
      referenceSystemIdentifierAfter: "2234567890123456789",
      stable: true,
      distinct: true,
    },
    targetControlPlane: {
      containerId: "1".repeat(64),
      imageId: "sha256:cd17e2ac98240fce1541ad2a803b34009b4eea5aec8a832363cdc7eca62e722e",
      imageReference: "postgres:15-alpine@sha256:cd17e2ac98240fce1541ad2a803b34009b4eea5aec8a832363cdc7eca62e722e",
      containerName: "greyhoundiq-design-lab-postgres",
      composeProject: "greyhoundiq-design-lab-db",
      composeService: "postgres",
      state: "running",
      health: "healthy",
      portBinding: {
        containerPort: "5432/tcp",
        hostIp: "127.0.0.1",
        hostPort: 55735,
      },
      volumeMount: {
        type: "volume",
        name: "greyhoundiq-design-lab-postgres-v2",
        destination: "/var/lib/postgresql/data",
      },
    },
  },
  sourceBinding: {
    testedCommitSha: binding.testedCommitSha,
    sourceSha256: binding.sourceSha256,
    sourceFileCount: binding.sourceFileCount,
    prismaSchemaSha256: binding.prismaSchemaSha256,
    migrationsSha256: binding.migrationsSha256,
    migrationCount: binding.migrationCount,
    migrationReplaySha256: binding.migrationReplaySha256,
    migrationReplayControlSha256: binding.migrationReplayControlSha256,
    migrationReplayReferenceSystemIdentifier:
      binding.migrationReplayReferenceSystemIdentifier,
    migrationReplayTestedCommitSha:
      binding.migrationReplayTestedCommitSha,
    parityControlSha256: binding.parityControlSha256,
    parityControlFileCount: binding.parityControlFileCount,
    sourceCommitBound: true,
    migrationReplayCommitBound: true,
  },
  runtimeRole: {
    currentRole: DESIGN_LAB_RUNTIME_ROLE,
    sessionRole: DESIGN_LAB_RUNTIME_ROLE,
    canLogin: true,
    superuser: false,
    bypassRls: false,
    createRole: false,
    createDatabase: false,
    replication: false,
    inherit: true,
    validUntil: null,
    roleConfig: [],
    connectionLimit: 40,
    memberOfRoles: [],
    databaseConnect: true,
    databaseTemporary: false,
    databaseCreate: false,
    schemaUsage: true,
    schemaCreate: false,
    ownedObjectCount: 0,
    requiredPrivilegeCount: 480,
    missingPrivileges: [],
    unexpectedPrivileges: [],
    readOnlySession: true,
    applicationTableCount: 107,
    rlsEnabledCount: 107,
    forceRlsCount: 107,
  },
  catalog: {
    targetSha256: catalogSha256,
    referenceSha256: catalogSha256,
    matched: true,
    snapshotIsolation: "repeatable read",
    targetReadOnly: true,
    referenceReadOnly: true,
    components: components.map((component) => ({
      name: component.name,
      targetRows: component.rowCount,
      referenceRows: component.rowCount,
      targetSha256: component.sha256,
      referenceSha256: component.sha256,
      matched: true,
    })),
  },
  applicationBinding: {
    baseUrl: "http://127.0.0.1:3000",
    readinessStatus: 200,
    databaseStatus: "ok",
    observedApplicationName: DESIGN_LAB_APPLICATION_NAME,
    observedRole: DESIGN_LAB_RUNTIME_ROLE,
    observedConnectionCount: 2,
    observedFreshConnectionCount: 1,
    requestId: "12345678-abcd-4abc-8abc-1234567890ab",
    proofWindowStartedAt: "2026-07-14T00:00:00.000Z",
    readinessObservedAt: "2026-07-14T00:00:00.800Z",
    proofWindowEndedAt: "2026-07-14T00:00:01.000Z",
    connections: [{
      pid: 1234,
      classification: "new",
      backendStartedAt: "2026-07-13T23:59:00.000Z",
      beforeQueryStartedAt: null,
      beforeStateChangedAt: null,
      afterQueryStartedAt: "2026-07-14T00:00:00.500Z",
      afterStateChangedAt: "2026-07-14T00:00:00.600Z",
    }],
  },
  verdict: "verified",
};

assert.deepEqual(findDesignLabDatabaseParityIssues(report, binding), []);

const mutations: Array<(candidate: Record<string, unknown>) => void> = [
  (candidate) => ((candidate.sourceBinding as Record<string, unknown>).sourceSha256 = "stale"),
  (candidate) => ((candidate.sourceBinding as Record<string, unknown>).migrationReplayTestedCommitSha = "0".repeat(40)),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).sessionRole = "postgres"),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).bypassRls = true),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).connectionLimit = 41),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).forceRlsCount = 106),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).memberOfRoles = ["postgres"]),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).validUntil = "infinity"),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).roleConfig = ["search_path=public"]),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).databaseConnect = false),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).databaseTemporary = true),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).unexpectedPrivileges = ["relation:public._prisma_migrations:UPDATE"]),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).missingPrivileges = ["view:public.giq_public_social_actor_profiles:SELECT"]),
  (candidate) => ((candidate.catalog as Record<string, unknown>).referenceSha256 = "f".repeat(64)),
  (candidate) => ((candidate.catalog as Record<string, unknown>).snapshotIsolation = "read committed"),
  (candidate) => delete (candidate.catalog as Record<string, unknown>).targetSha256,
  (candidate) => (((candidate.catalog as { components: Array<Record<string, unknown>> }).components[0].matched) = false),
  (candidate) => delete (candidate.catalog as { components: Array<Record<string, unknown>> }).components[0].targetRows,
  (candidate) => ((candidate.catalog as { components: unknown[] }).components.pop()),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).readinessStatus = 503),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).observedConnectionCount = 0),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).observedFreshConnectionCount = 0),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).proofWindowStartedAt = "Tue, 14 Jul 2026 00:00:00 GMT"),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).proofWindowEndedAt = "2026-07-13T23:59:59.000Z"),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).proofWindowEndedAt = "2026-07-14T00:00:03.000Z"),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).requestId = "invalid"),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).requestId = "12345678"),
  (candidate) => ((candidate.applicationBinding as Record<string, unknown>).readinessObservedAt = "2026-07-13T23:59:59.000Z"),
  (candidate) => {
    const proof = (candidate.applicationBinding as { connections: Array<Record<string, unknown>> }).connections[0];
    proof.afterQueryStartedAt = "2026-07-13T23:59:30.000Z";
    proof.afterStateChangedAt = "2026-07-13T23:59:31.000Z";
  },
  (candidate) => ((candidate.applicationBinding as { connections: unknown[] }).connections = []),
  (candidate) => ((candidate.safety as Record<string, unknown>).productionContacted = true),
  (candidate) => (((candidate.safety as { clusterIdentity: Record<string, unknown> }).clusterIdentity.referenceSystemIdentifier) = "1234567890123456789"),
  (candidate) => (((candidate.safety as { clusterIdentity: Record<string, unknown> }).clusterIdentity.targetSystemIdentifierAfter) = "3234567890123456789"),
  (candidate) => (((candidate.safety as { targetControlPlane: { volumeMount: Record<string, unknown> } }).targetControlPlane.volumeMount.name) = "other-volume"),
  (candidate) => (candidate.generatedAt = "2000-01-01T00:00:00.000Z"),
  (candidate) => (candidate.generatedAt = "Tue, 14 Jul 2026 00:00:02 GMT"),
  (candidate) => (candidate.databaseUrl = "postgresql://postgres:secret@127.0.0.1:55735/greyhoundiq"),
  (candidate) => ((candidate.runtimeRole as Record<string, unknown>).privilegedMembership = "postgres"),
  (candidate) => (candidate.verdict = "blocked"),
];

for (const mutate of mutations) {
  const candidate = structuredClone(report) as unknown as Record<string, unknown>;
  mutate(candidate);
  assert.notDeepEqual(findDesignLabDatabaseParityIssues(candidate, binding), []);
}

assert.notDeepEqual(
  findDesignLabDatabaseParityIssues(report, {
    ...binding,
    migrationReplayValid: false,
  }),
  [],
);
for (const key of ["sourceCommitBound", "migrationReplayCommitBound"] as const) {
  assert.notDeepEqual(
    findDesignLabDatabaseParityIssues(report, { ...binding, [key]: false }),
    [],
  );
}

const replayBinding = {
  testedCommitSha: binding.testedCommitSha,
  sourceSha256: binding.sourceSha256,
  sourceFileCount: binding.sourceFileCount,
  prismaSchemaSha256: binding.prismaSchemaSha256,
  migrationsSha256: binding.migrationsSha256,
  migrationCount: binding.migrationCount,
  replayControlSha256: binding.migrationReplayControlSha256,
  now: binding.now,
};
const replaySummary = [
  "No difference detected.",
  "Loaded Prisma config from prisma.config.ts.",
];
const replayEvidence = {
  schemaVersion: 2,
  auditKind: "isolated-postgres-migration-replay",
  generatedAt: "2026-07-14T00:00:00.000Z",
  safety: {
    scope: "literal-loopback-local-only",
    target: { protocol: "postgresql", host: "127.0.0.1", port: 55734, database: "greyhoundiq" },
    shadow: { protocol: "postgresql", host: "127.0.0.1", port: 55734, database: "greyhoundiq_shadow" },
    targetMutation: "none; Prisma migrate diff is read-only for the target",
    shadowMutation: "Prisma may reset the explicitly separate disposable shadow database",
    referenceSystemIdentifier: binding.migrationReplayReferenceSystemIdentifier,
  },
  sourceBinding: {
    testedCommitSha: replayBinding.testedCommitSha,
    sourceSha256: replayBinding.sourceSha256,
    sourceFileCount: replayBinding.sourceFileCount,
    prismaSchemaSha256: replayBinding.prismaSchemaSha256,
    migrationsSha256: replayBinding.migrationsSha256,
    migrationCount: replayBinding.migrationCount,
    replayControlSha256: replayBinding.replayControlSha256,
  },
  replay: {
    status: "verified",
    exitCode: 0,
    outputSha256: createHash("sha256").update(replaySummary.join("\n")).digest("hex"),
    summary: replaySummary,
  },
  verdict: "verified",
};
assert.deepEqual(findMigrationReplayIssues(replayEvidence, replayBinding), []);
for (const mutate of [
  (candidate: Record<string, unknown>) =>
    ((candidate.sourceBinding as Record<string, unknown>).replayControlSha256 = "0".repeat(64)),
  (candidate: Record<string, unknown>) =>
    ((candidate.replay as Record<string, unknown>).outputSha256 = "0".repeat(64)),
  (candidate: Record<string, unknown>) =>
    ((candidate.safety as Record<string, unknown>).targetMutation = "read only"),
  (candidate: Record<string, unknown>) =>
    ((candidate.safety as Record<string, unknown>).shadowMutation = "none"),
  (candidate: Record<string, unknown>) => {
    const summary = ["Loaded Prisma config from prisma.config.ts."];
    (candidate.replay as Record<string, unknown>).summary = summary;
    (candidate.replay as Record<string, unknown>).outputSha256 = createHash("sha256")
      .update(summary.join("\n"))
      .digest("hex");
  },
  (candidate: Record<string, unknown>) => {
    const summary = ["No difference detected.", "Drift detected after replay."];
    (candidate.replay as Record<string, unknown>).summary = summary;
    (candidate.replay as Record<string, unknown>).outputSha256 = createHash("sha256")
      .update(summary.join("\n"))
      .digest("hex");
  },
]) {
  const candidate = structuredClone(replayEvidence) as unknown as Record<string, unknown>;
  mutate(candidate);
  assert.notDeepEqual(findMigrationReplayIssues(candidate, replayBinding), []);
}

collectorGuardChecks
  .then(() => console.log("Design Lab database parity tests passed"))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
