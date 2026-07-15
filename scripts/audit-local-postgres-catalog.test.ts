import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  EXPECTED_RUNTIME_ROLE,
  assertCatalogDatabaseUrl,
  compareMigrationHistory,
  findLocalPostgresCatalogAuditIssues,
  sanitizePrismaOutput,
  type AppliedMigration,
  type LocalPostgresCatalogAudit,
  type LocalPostgresCatalogBinding,
  type SourceMigration,
} from "./audit-local-postgres-catalog";

const sourceMigrations: SourceMigration[] = [
  { name: "20260714000000_example", checksum: "a".repeat(64) },
];
const appliedMigrations: AppliedMigration[] = [
  {
    ...sourceMigrations[0],
    status: "applied",
    startedAt: "2026-07-14T00:00:00.000Z",
    finishedAt: "2026-07-14T00:00:01.000Z",
    rolledBackAt: null,
    appliedStepsCount: 1,
  },
];
const binding: LocalPostgresCatalogBinding = {
  testedCommitSha: "b".repeat(40),
  sourceSha256: "c".repeat(64),
  sourceFileCount: 10,
  prismaSchemaSha256: "d".repeat(64),
  migrationsSha256: "e".repeat(64),
  sourceMigrations,
  now: Date.parse("2026-07-14T01:00:00.000Z"),
};

const auditSource = readFileSync(
  join(__dirname, "audit-local-postgres-catalog.ts"),
  "utf8",
);
assert.match(
  auditSource,
  /const localDatabaseUrl = process\.env\.LOCAL_DATABASE_URL/,
);
assert.doesNotMatch(
  auditSource,
  /process\.env\.DATABASE_URL\s*\?\?|postgresql:\/\/postgres:postgres@127\.0\.0\.1/,
);

const validBlockedAudit: LocalPostgresCatalogAudit = {
  schemaVersion: 1,
  auditKind: "local-postgres-compatibility-catalog",
  generatedAt: "2026-07-14T01:00:00.000Z",
  safety: {
    scope: "literal-loopback-local-only",
    target: {
      protocol: "postgresql",
      host: "127.0.0.1",
      port: 55433,
      database: "greyhoundiq",
    },
    readOnlySession: true,
  },
  sourceBinding: {
    testedCommitSha: binding.testedCommitSha,
    sourceSha256: binding.sourceSha256,
    sourceFileCount: binding.sourceFileCount,
    prismaSchemaSha256: binding.prismaSchemaSha256,
    migrationsSha256: binding.migrationsSha256,
  },
  postgres: {
    version: "15.13",
    versionNum: 150013,
    major: 15,
    configuredLocalMajor: 15,
    serverEncoding: "UTF8",
    collation: "en_US.utf8",
    ctype: "en_US.utf8",
    timezone: "UTC",
  },
  extensions: [
    { name: "pg_trgm", version: "1.6", schema: "public" },
    { name: "plpgsql", version: "1.0", schema: "pg_catalog" },
  ],
  roles: {
    current: "postgres",
    session: "postgres",
    expectedRuntime: EXPECTED_RUNTIME_ROLE,
    leastPrivilegeMatch: false,
    catalog: [
      {
        name: EXPECTED_RUNTIME_ROLE,
        superuser: false,
        inherit: true,
        createRole: false,
        createDatabase: false,
        canLogin: false,
        replication: false,
        bypassRls: false,
        connectionLimit: -1,
      },
      {
        name: "postgres",
        superuser: true,
        inherit: true,
        createRole: true,
        createDatabase: true,
        canLogin: true,
        replication: true,
        bypassRls: true,
        connectionLimit: -1,
      },
    ],
    memberships: [],
  },
  grants: {
    database: [],
    schemas: [],
    tables: [],
    sequences: [],
    routines: [],
  },
  migrations: {
    source: sourceMigrations,
    applied: appliedMigrations,
    comparison: compareMigrationHistory(sourceMigrations, appliedMigrations),
  },
  rowLevelSecurity: {
    publicTableCount: 2,
    enabledTableCount: 1,
    forceEnabledTableCount: 1,
    applicationTableCount: 1,
    applicationEnabledTableCount: 1,
    applicationForceEnabledTableCount: 1,
    prismaMigrationMetadata: {
      present: true,
      enabled: false,
      forced: false,
      policyCount: 0,
    },
    policyCount: 2,
    tables: [
      {
        schema: "public",
        table: "Alpha",
        enabled: true,
        forced: true,
        policyCount: 2,
      },
      {
        schema: "public",
        table: "_prisma_migrations",
        enabled: false,
        forced: false,
        policyCount: 0,
      },
    ],
  },
  drift: {
    prismaDatamodel: {
      status: "no-differences",
      exitCode: 0,
      outputSha256: "f".repeat(64),
      summary: ["No difference detected."],
    },
    migrationHistory: "in-sync",
    unsupportedCatalog: "observed-only-not-source-replayed",
    overall: "unproven",
  },
  findings: [
    {
      code: "DB.RUNTIME_ROLE_MISMATCH",
      severity: "blocker",
      message: "Catalog ran as postgres, not the runtime role.",
    },
    {
      code: "DB.CATALOG_PARITY_UNPROVEN",
      severity: "blocker",
      message: "Unsupported catalog parity remains unproven.",
    },
  ],
  verdict: "blocked",
};

assert.deepEqual(
  findLocalPostgresCatalogAuditIssues(validBlockedAudit, binding),
  [],
);

for (const mutate of [
  (audit: LocalPostgresCatalogAudit) => {
    audit.safety.target.host = "database.internal" as "127.0.0.1";
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.safety.readOnlySession = false;
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.sourceBinding.sourceSha256 = "0".repeat(64);
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.extensions[0].version = 1 as unknown as string;
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.roles.catalog[0].bypassRls = "false" as unknown as boolean;
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.grants.tables = [{ grantee: "PUBLIC" } as never];
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.migrations.source[0].checksum = "0".repeat(64);
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.migrations.applied[0].checksum = "0".repeat(64);
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.rowLevelSecurity.enabledTableCount = 2;
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.rowLevelSecurity.applicationTableCount = 2;
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.rowLevelSecurity.prismaMigrationMetadata.enabled = true;
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.drift.overall = "zero-drift-proven" as "unproven";
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.verdict = "compatible" as "blocked";
  },
  (audit: LocalPostgresCatalogAudit) => {
    audit.findings = audit.findings.filter(
      (finding) => finding.code !== "DB.RUNTIME_ROLE_MISMATCH",
    );
  },
]) {
  const invalid = structuredClone(validBlockedAudit);
  mutate(invalid);
  assert.ok(findLocalPostgresCatalogAuditIssues(invalid, binding).length > 0);
}

const leaked = structuredClone(
  validBlockedAudit,
) as LocalPostgresCatalogAudit & {
  connectionString: string;
};
leaked.connectionString =
  "postgresql://user:credential@127.0.0.1:55433/greyhoundiq";
assert.ok(
  findLocalPostgresCatalogAuditIssues(leaked, binding).some((issue) =>
    issue.includes("credential"),
  ),
);

assert.doesNotThrow(() =>
  assertCatalogDatabaseUrl(
    "postgresql://local:credential@127.0.0.1:55433/greyhoundiq",
  ),
);
assert.doesNotThrow(() =>
  assertCatalogDatabaseUrl(
    "postgresql://local:credential@[::1]:5432/greyhoundiq",
  ),
);
for (const unsafe of [
  "postgresql://local:credential@localhost:55433/greyhoundiq",
  "postgresql://prod:credential@database.internal:5432/greyhoundiq",
  "https://127.0.0.1:55433/greyhoundiq",
]) {
  assert.throws(() => assertCatalogDatabaseUrl(unsafe));
}
assert.throws(
  () =>
    assertCatalogDatabaseUrl(
      "postgresql://sensitive_user:sensitive_password@database.internal:5432/greyhoundiq",
    ),
  (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /sensitive_user|sensitive_password/);
    return true;
  },
);

const drifted = compareMigrationHistory(sourceMigrations, [
  { ...appliedMigrations[0], checksum: "0".repeat(64) },
  {
    ...appliedMigrations[0],
    name: "unexpected",
    status: "incomplete",
    finishedAt: null,
  },
]);
assert.equal(drifted.status, "drift-detected");
assert.equal(drifted.checksumMismatches.length, 1);
assert.deepEqual(drifted.incompleteOrRolledBack, [
  { name: "unexpected", status: "incomplete" },
]);

const resolvedRollback = compareMigrationHistory(sourceMigrations, [
  ...appliedMigrations,
  {
    ...appliedMigrations[0],
    status: "rolled-back",
    finishedAt: null,
    rolledBackAt: "2026-07-14T00:00:02.000Z",
  },
]);
assert.equal(resolvedRollback.status, "in-sync");
assert.deepEqual(resolvedRollback.incompleteOrRolledBack, [
  { name: sourceMigrations[0].name, status: "rolled-back" },
]);

const sanitized = sanitizePrismaOutput(
  "failed postgresql://user:password@127.0.0.1:55433/greyhoundiq password=hidden",
);
assert.doesNotMatch(sanitized, /user|password@|hidden/);
assert.match(sanitized, /<redacted>/);

console.log("Local PostgreSQL catalog audit contract passed");
