import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectDatabaseCompatibilityInventory } from "./check-database-compatibility-inventory";
import {
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
} from "./design-lab-source-fingerprint";
import { assertLocalDatabaseUrl } from "./local-database-policy";

export const LOCAL_POSTGRES_CATALOG_AUDIT_PATH =
  "output/database-audit/local-postgres-catalog.json";
export const EXPECTED_RUNTIME_ROLE = "greyhoundiq_runtime";

const LITERAL_LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$.-]*$/u;

export type SourceMigration = {
  name: string;
  checksum: string;
};

export type AppliedMigration = SourceMigration & {
  status: "applied" | "rolled-back" | "incomplete";
  startedAt: string;
  finishedAt: string | null;
  rolledBackAt: string | null;
  appliedStepsCount: number;
};

export type MigrationComparison = {
  status: "in-sync" | "drift-detected";
  missing: string[];
  unexpected: string[];
  checksumMismatches: Array<{
    name: string;
    expected: string;
    received: string;
  }>;
  duplicateApplied: string[];
  incompleteOrRolledBack: Array<{
    name: string;
    status: AppliedMigration["status"];
  }>;
};

type RoleRecord = {
  name: string;
  superuser: boolean;
  inherit: boolean;
  createRole: boolean;
  createDatabase: boolean;
  canLogin: boolean;
  replication: boolean;
  bypassRls: boolean;
  connectionLimit: number;
};

type RoleMembership = {
  role: string;
  member: string;
  grantor: string;
  adminOption: boolean;
};

type GrantRecord = {
  grantee: string;
  schema: string;
  object: string;
  privilege: string;
  grantable: boolean;
};

type NamespaceGrantRecord = Omit<GrantRecord, "object">;

type Finding = {
  code: string;
  severity: "blocker" | "warning";
  message: string;
};

type PrismaDiffEvidence = {
  status: "no-differences" | "differences-detected" | "error";
  exitCode: number;
  outputSha256: string;
  summary: string[];
};

export type LocalPostgresCatalogAudit = {
  schemaVersion: 1;
  auditKind: "local-postgres-compatibility-catalog";
  generatedAt: string;
  safety: {
    scope: "literal-loopback-local-only";
    target: {
      protocol: "postgresql";
      host: "127.0.0.1" | "[::1]";
      port: number;
      database: string;
    };
    readOnlySession: boolean;
  };
  sourceBinding: {
    testedCommitSha: string;
    sourceSha256: string;
    sourceFileCount: number;
    prismaSchemaSha256: string;
    migrationsSha256: string;
  };
  postgres: {
    version: string;
    versionNum: number;
    major: number;
    configuredLocalMajor: number;
    serverEncoding: string;
    collation: string;
    ctype: string;
    timezone: string;
  };
  extensions: Array<{ name: string; version: string; schema: string }>;
  roles: {
    current: string;
    session: string;
    expectedRuntime: typeof EXPECTED_RUNTIME_ROLE;
    leastPrivilegeMatch: boolean;
    catalog: RoleRecord[];
    memberships: RoleMembership[];
  };
  grants: {
    database: NamespaceGrantRecord[];
    schemas: NamespaceGrantRecord[];
    tables: GrantRecord[];
    sequences: GrantRecord[];
    routines: GrantRecord[];
  };
  migrations: {
    source: SourceMigration[];
    applied: AppliedMigration[];
    comparison: MigrationComparison;
  };
  rowLevelSecurity: {
    publicTableCount: number;
    enabledTableCount: number;
    forceEnabledTableCount: number;
    applicationTableCount: number;
    applicationEnabledTableCount: number;
    applicationForceEnabledTableCount: number;
    prismaMigrationMetadata: {
      present: boolean;
      enabled: boolean | null;
      forced: boolean | null;
      policyCount: number | null;
    };
    policyCount: number;
    tables: Array<{
      schema: string;
      table: string;
      enabled: boolean;
      forced: boolean;
      policyCount: number;
    }>;
  };
  drift: {
    prismaDatamodel: PrismaDiffEvidence;
    migrationHistory: MigrationComparison["status"];
    unsupportedCatalog: "observed-only-not-source-replayed";
    overall: "drift-detected" | "unproven";
  };
  findings: Finding[];
  verdict: "blocked";
};

export type LocalPostgresCatalogBinding = {
  testedCommitSha: string;
  sourceSha256: string;
  sourceFileCount: number;
  prismaSchemaSha256: string;
  migrationsSha256: string;
  sourceMigrations: SourceMigration[];
  now?: number;
};

type CatalogClient = {
  $queryRawUnsafe<T>(query: string): Promise<T>;
  $disconnect(): Promise<void>;
};

export function assertCatalogDatabaseUrl(value: string) {
  assertLocalDatabaseUrl(value);
  const url = new URL(value);
  if (!LITERAL_LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      "Catalog evidence requires a literal 127.0.0.1 or [::1] PostgreSQL host; DNS names are refused.",
    );
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database || !SAFE_IDENTIFIER.test(database)) {
    throw new Error("Catalog evidence requires a simple local database name.");
  }
}

export function collectSourceMigrations(repoRoot = process.cwd()) {
  const migrationsRoot = join(repoRoot, "prisma", "migrations");
  return readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const migrationPath = join(migrationsRoot, entry.name, "migration.sql");
      if (!existsSync(migrationPath)) {
        throw new Error(`Migration ${entry.name} has no migration.sql source.`);
      }
      return {
        name: entry.name,
        checksum: sha256(readFileSync(migrationPath)),
      };
    })
    .sort((left, right) => compareText(left.name, right.name));
}

export function compareMigrationHistory(
  source: readonly SourceMigration[],
  applied: readonly AppliedMigration[],
): MigrationComparison {
  const expected = new Map(
    source.map((migration) => [migration.name, migration]),
  );
  const successful = applied.filter(
    (migration) => migration.status === "applied",
  );
  const successfulByName = new Map<string, AppliedMigration[]>();
  for (const migration of successful) {
    const rows = successfulByName.get(migration.name) ?? [];
    rows.push(migration);
    successfulByName.set(migration.name, rows);
  }

  const missing = source
    .filter((migration) => !successfulByName.has(migration.name))
    .map((migration) => migration.name);
  const unexpected = [...successfulByName.keys()]
    .filter((name) => !expected.has(name))
    .sort(compareText);
  const checksumMismatches = source.flatMap((migration) =>
    (successfulByName.get(migration.name) ?? [])
      .filter((row) => row.checksum !== migration.checksum)
      .map((row) => ({
        name: migration.name,
        expected: migration.checksum,
        received: row.checksum,
      })),
  );
  const duplicateApplied = [...successfulByName.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([name]) => name)
    .sort(compareText);
  const incompleteOrRolledBack = applied
    .filter((migration) => migration.status !== "applied")
    .map((migration) => ({ name: migration.name, status: migration.status }))
    .sort((left, right) =>
      compareText(
        `${left.name}:${left.status}`,
        `${right.name}:${right.status}`,
      ),
    );
  const hasDrift =
    missing.length > 0 ||
    unexpected.length > 0 ||
    checksumMismatches.length > 0 ||
    duplicateApplied.length > 0 ||
    incompleteOrRolledBack.some((row) => row.status === "incomplete");

  return {
    status: hasDrift ? "drift-detected" : "in-sync",
    missing,
    unexpected,
    checksumMismatches,
    duplicateApplied,
    incompleteOrRolledBack,
  };
}

export function findLocalPostgresCatalogAuditIssues(
  value: unknown,
  binding: LocalPostgresCatalogBinding,
) {
  const issues: string[] = [];
  if (!isRecord(value)) return ["Catalog evidence must be a JSON object."];
  issues.push(...findCredentialLeaks(value));
  if (value.schemaVersion !== 1)
    issues.push("Catalog evidence schemaVersion must be 1.");
  if (value.auditKind !== "local-postgres-compatibility-catalog") {
    issues.push("Catalog evidence auditKind is invalid.");
  }
  const generatedAt =
    typeof value.generatedAt === "string" ? Date.parse(value.generatedAt) : NaN;
  const now = binding.now ?? Date.now();
  if (!Number.isFinite(generatedAt))
    issues.push("Catalog evidence generatedAt is invalid.");
  else if (generatedAt > now + 5 * 60_000)
    issues.push("Catalog evidence is future-dated.");
  else if (now - generatedAt > 24 * 60 * 60_000)
    issues.push("Catalog evidence is older than 24 hours.");

  const safety = isRecord(value.safety) ? value.safety : undefined;
  const target = isRecord(safety?.target) ? safety.target : undefined;
  if (
    safety?.scope !== "literal-loopback-local-only" ||
    safety.readOnlySession !== true ||
    target?.protocol !== "postgresql" ||
    !LITERAL_LOOPBACK_HOSTS.has(String(target?.host)) ||
    !Number.isInteger(target?.port) ||
    Number(target?.port) < 1 ||
    Number(target?.port) > 65_535 ||
    typeof target?.database !== "string" ||
    !SAFE_IDENTIFIER.test(target.database)
  ) {
    issues.push(
      "Catalog evidence safety boundary is invalid or not read-only loopback.",
    );
  }

  const sourceBinding = isRecord(value.sourceBinding)
    ? value.sourceBinding
    : undefined;
  for (const [key, expected] of Object.entries({
    testedCommitSha: binding.testedCommitSha,
    sourceSha256: binding.sourceSha256,
    sourceFileCount: binding.sourceFileCount,
    prismaSchemaSha256: binding.prismaSchemaSha256,
    migrationsSha256: binding.migrationsSha256,
  })) {
    if (sourceBinding?.[key] !== expected) {
      issues.push(
        `Catalog evidence source binding ${key} does not match current source.`,
      );
    }
  }

  const postgres = isRecord(value.postgres) ? value.postgres : undefined;
  const versionNum = Number(postgres?.versionNum);
  if (
    typeof postgres?.version !== "string" ||
    !Number.isInteger(versionNum) ||
    versionNum < 100_000 ||
    postgres?.major !== Math.floor(versionNum / 10_000) ||
    !Number.isInteger(postgres?.configuredLocalMajor) ||
    typeof postgres?.serverEncoding !== "string" ||
    typeof postgres?.collation !== "string" ||
    typeof postgres?.ctype !== "string" ||
    typeof postgres?.timezone !== "string"
  ) {
    issues.push(
      "Catalog evidence PostgreSQL compatibility metadata is invalid.",
    );
  }

  if (
    !isSortedUniqueObjectArray(value.extensions, "name") ||
    !(value.extensions as unknown[]).every(isExtensionRecord)
  ) {
    issues.push(
      "Catalog evidence extensions must be a sorted unique inventory.",
    );
  }

  const roles = isRecord(value.roles) ? value.roles : undefined;
  const roleCatalog = Array.isArray(roles?.catalog) ? roles.catalog : [];
  const expectedRuntime = roleCatalog.find(
    (role) => isRecord(role) && role.name === EXPECTED_RUNTIME_ROLE,
  );
  const calculatedLeastPrivilegeMatch =
    roles?.current === EXPECTED_RUNTIME_ROLE &&
    isRecord(expectedRuntime) &&
    expectedRuntime.superuser === false &&
    expectedRuntime.bypassRls === false &&
    expectedRuntime.createRole === false &&
    expectedRuntime.createDatabase === false;
  if (
    typeof roles?.current !== "string" ||
    typeof roles?.session !== "string" ||
    roles.expectedRuntime !== EXPECTED_RUNTIME_ROLE ||
    roles.leastPrivilegeMatch !== calculatedLeastPrivilegeMatch ||
    !isSortedUniqueObjectArray(roleCatalog, "name") ||
    !roleCatalog.every(isRoleRecord) ||
    !Array.isArray(roles.memberships) ||
    !roles.memberships.every(isRoleMembership)
  ) {
    issues.push(
      "Catalog evidence role or least-privilege inventory is invalid.",
    );
  }

  const grants = isRecord(value.grants) ? value.grants : undefined;
  for (const key of [
    "database",
    "schemas",
    "tables",
    "sequences",
    "routines",
  ] as const) {
    const rows = grants?.[key];
    const valid =
      Array.isArray(rows) &&
      rows.every((row) =>
        key === "database" || key === "schemas"
          ? isNamespaceGrant(row)
          : isGrant(row),
      );
    if (!valid) {
      issues.push(`Catalog evidence ${key} grant inventory is missing.`);
    }
  }

  const migrations = isRecord(value.migrations) ? value.migrations : undefined;
  const sourceMigrations = Array.isArray(migrations?.source)
    ? migrations.source
    : [];
  const appliedMigrations = Array.isArray(migrations?.applied)
    ? migrations.applied
    : [];
  if (
    JSON.stringify(sourceMigrations) !==
    JSON.stringify(binding.sourceMigrations)
  ) {
    issues.push(
      "Catalog evidence migration source names/checksums do not match the checkout.",
    );
  }
  if (!appliedMigrations.every(isAppliedMigration)) {
    issues.push("Catalog evidence contains an invalid applied migration row.");
  } else {
    const comparison = compareMigrationHistory(
      binding.sourceMigrations,
      appliedMigrations as AppliedMigration[],
    );
    if (JSON.stringify(migrations?.comparison) !== JSON.stringify(comparison)) {
      issues.push(
        "Catalog evidence migration comparison is not derived from its rows.",
      );
    }
  }

  const rls = isRecord(value.rowLevelSecurity)
    ? value.rowLevelSecurity
    : undefined;
  const rlsTables = Array.isArray(rls?.tables) ? rls.tables : [];
  const calculatedRls = summarizeRlsTables(rlsTables);
  if (
    !calculatedRls ||
    rls?.publicTableCount !== calculatedRls.publicTableCount ||
    rls.enabledTableCount !== calculatedRls.enabledTableCount ||
    rls.forceEnabledTableCount !== calculatedRls.forceEnabledTableCount ||
    rls.applicationTableCount !== calculatedRls.applicationTableCount ||
    rls.applicationEnabledTableCount !==
      calculatedRls.applicationEnabledTableCount ||
    rls.applicationForceEnabledTableCount !==
      calculatedRls.applicationForceEnabledTableCount ||
    JSON.stringify(rls.prismaMigrationMetadata) !==
      JSON.stringify(calculatedRls.prismaMigrationMetadata) ||
    rls.policyCount !== calculatedRls.policyCount
  ) {
    issues.push(
      "Catalog evidence RLS/FORCE-RLS counts are inconsistent with its table rows.",
    );
  }

  const drift = isRecord(value.drift) ? value.drift : undefined;
  const prismaDatamodel = isRecord(drift?.prismaDatamodel)
    ? drift.prismaDatamodel
    : undefined;
  const validPrismaStatus = [
    "no-differences",
    "differences-detected",
    "error",
  ].includes(String(prismaDatamodel?.status));
  const expectedOverall =
    migrations?.comparison &&
    isRecord(migrations.comparison) &&
    migrations.comparison.status === "drift-detected"
      ? "drift-detected"
      : "unproven";
  if (
    !validPrismaStatus ||
    !Number.isInteger(prismaDatamodel?.exitCode) ||
    typeof prismaDatamodel?.outputSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(prismaDatamodel.outputSha256) ||
    !Array.isArray(prismaDatamodel.summary) ||
    drift?.migrationHistory !==
      (isRecord(migrations?.comparison)
        ? migrations.comparison.status
        : undefined) ||
    drift?.unsupportedCatalog !== "observed-only-not-source-replayed" ||
    drift?.overall !== expectedOverall
  ) {
    issues.push(
      "Catalog evidence drift result is invalid or overclaims zero drift.",
    );
  }

  if (value.verdict !== "blocked") {
    issues.push(
      "Catalog evidence must remain blocked while unsupported catalog parity is unproven.",
    );
  }
  if (!Array.isArray(value.findings) || value.findings.length === 0) {
    issues.push("Catalog evidence must include explicit blocking findings.");
  } else if (
    roles?.current !== EXPECTED_RUNTIME_ROLE &&
    !value.findings.some(
      (finding) =>
        isRecord(finding) && finding.code === "DB.RUNTIME_ROLE_MISMATCH",
    )
  ) {
    issues.push(
      "Catalog evidence omits the current-role versus runtime-role mismatch.",
    );
  }
  if (
    !Array.isArray(value.findings) ||
    !value.findings.some(
      (finding) =>
        isRecord(finding) && finding.code === "DB.CATALOG_PARITY_UNPROVEN",
    )
  ) {
    issues.push(
      "Catalog evidence omits the unsupported catalog parity blocker.",
    );
  }

  return issues;
}

export function sanitizePrismaOutput(value: string) {
  const repositoryRoot = resolve(".");
  return value
    .replace(
      /postgres(?:ql)?:\/\/[^\s"'`]+/giu,
      "<redacted-database-connection>",
    )
    .replace(/(password|secret|token)\s*[=:]\s*[^\s,;]+/giu, "$1=<redacted>")
    .replaceAll(repositoryRoot, "<repo>")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .join("\n");
}

async function collectAudit(
  repositoryRoot: string,
  localDatabaseUrl: string,
): Promise<LocalPostgresCatalogAudit> {
  assertCatalogDatabaseUrl(localDatabaseUrl);
  const evidenceUrl = buildReadOnlyEvidenceUrl(localDatabaseUrl);
  const sourceBefore = getDesignLabSourceFingerprint(repositoryRoot);
  const headBefore = getRepositoryHeadSha(repositoryRoot);
  const compatibility = collectDatabaseCompatibilityInventory(repositoryRoot);
  const sourceMigrations = collectSourceMigrations(repositoryRoot);
  const configuredLocalMajor = readConfiguredLocalMajor(repositoryRoot);

  process.env.DATABASE_URL = evidenceUrl;
  process.env.DIRECT_URL = evidenceUrl;
  const { PrismaClient } = await import("@prisma/client");
  const client: CatalogClient = new PrismaClient();
  let catalog: Awaited<ReturnType<typeof readCatalog>>;
  try {
    catalog = await readCatalog(client);
  } finally {
    await client.$disconnect();
  }
  const prismaDatamodel = runPrismaDiff(repositoryRoot, evidenceUrl);
  const sourceAfter = getDesignLabSourceFingerprint(repositoryRoot);
  const headAfter = getRepositoryHeadSha(repositoryRoot);
  if (
    sourceAfter.sha256 !== sourceBefore.sha256 ||
    sourceAfter.fileCount !== sourceBefore.fileCount ||
    headAfter !== headBefore
  ) {
    throw new Error(
      "Repository source changed during catalog capture; discard the run.",
    );
  }

  const applied = catalog.appliedMigrations.map(normalizeAppliedMigration);
  const migrationComparison = compareMigrationHistory(
    sourceMigrations,
    applied,
  );
  const runtimeRole = catalog.roles.find(
    (role) => role.name === EXPECTED_RUNTIME_ROLE,
  );
  const leastPrivilegeMatch = Boolean(
    catalog.server.currentRole === EXPECTED_RUNTIME_ROLE &&
    runtimeRole &&
    !runtimeRole.superuser &&
    !runtimeRole.bypassRls &&
    !runtimeRole.createRole &&
    !runtimeRole.createDatabase,
  );
  const overall =
    migrationComparison.status === "drift-detected"
      ? "drift-detected"
      : "unproven";
  const reportWithoutFindings = {
    schemaVersion: 1,
    auditKind: "local-postgres-compatibility-catalog",
    generatedAt: new Date().toISOString(),
    safety: {
      scope: "literal-loopback-local-only",
      target: safeTarget(localDatabaseUrl),
      readOnlySession: catalog.server.readOnlySession,
    },
    sourceBinding: {
      testedCommitSha: headBefore,
      sourceSha256: sourceBefore.sha256,
      sourceFileCount: sourceBefore.fileCount,
      prismaSchemaSha256: compatibility.schemaSha256,
      migrationsSha256: compatibility.migrationsSha256,
    },
    postgres: {
      version: catalog.server.version,
      versionNum: catalog.server.versionNum,
      major: Math.floor(catalog.server.versionNum / 10_000),
      configuredLocalMajor,
      serverEncoding: catalog.server.serverEncoding,
      collation: catalog.server.collation,
      ctype: catalog.server.ctype,
      timezone: catalog.server.timezone,
    },
    extensions: catalog.extensions,
    roles: {
      current: catalog.server.currentRole,
      session: catalog.server.sessionRole,
      expectedRuntime: EXPECTED_RUNTIME_ROLE,
      leastPrivilegeMatch,
      catalog: catalog.roles,
      memberships: catalog.memberships,
    },
    grants: catalog.grants,
    migrations: {
      source: sourceMigrations,
      applied,
      comparison: migrationComparison,
    },
    rowLevelSecurity: summarizeRlsRows(catalog.rlsTables),
    drift: {
      prismaDatamodel,
      migrationHistory: migrationComparison.status,
      unsupportedCatalog: "observed-only-not-source-replayed",
      overall,
    },
  } as const;
  const findings = deriveFindings(reportWithoutFindings);
  return { ...reportWithoutFindings, findings, verdict: "blocked" };
}

async function readCatalog(client: CatalogClient) {
  const [
    serverRows,
    extensions,
    roleRows,
    membershipRows,
    databaseGrants,
    schemaGrants,
    tableGrants,
    sequenceGrants,
    routineGrants,
    migrationRows,
    rlsRows,
  ] = await Promise.all([
    client.$queryRawUnsafe<ServerRow[]>(SERVER_QUERY),
    client.$queryRawUnsafe<ExtensionRow[]>(EXTENSION_QUERY),
    client.$queryRawUnsafe<RoleRow[]>(ROLE_QUERY),
    client.$queryRawUnsafe<RoleMembershipRow[]>(ROLE_MEMBERSHIP_QUERY),
    client.$queryRawUnsafe<NamespaceGrantRow[]>(DATABASE_GRANT_QUERY),
    client.$queryRawUnsafe<NamespaceGrantRow[]>(SCHEMA_GRANT_QUERY),
    client.$queryRawUnsafe<GrantRow[]>(TABLE_GRANT_QUERY),
    client.$queryRawUnsafe<GrantRow[]>(SEQUENCE_GRANT_QUERY),
    client.$queryRawUnsafe<GrantRow[]>(ROUTINE_GRANT_QUERY),
    client.$queryRawUnsafe<AppliedMigrationRow[]>(MIGRATION_QUERY),
    client.$queryRawUnsafe<RlsRow[]>(RLS_QUERY),
  ]);
  const server = serverRows[0];
  if (!server) throw new Error("Local PostgreSQL returned no server metadata.");
  return {
    server: {
      version: server.version,
      versionNum: Number(server.versionNum),
      currentRole: server.currentRole,
      sessionRole: server.sessionRole,
      serverEncoding: server.serverEncoding,
      collation: server.collation,
      ctype: server.ctype,
      timezone: server.timezone,
      readOnlySession: server.readOnlySession,
    },
    extensions: extensions
      .map((row) => ({
        name: row.name,
        version: row.version,
        schema: row.schema,
      }))
      .sort((left, right) => compareText(left.name, right.name)),
    roles: roleRows
      .map((row) => ({
        name: row.name,
        superuser: row.superuser,
        inherit: row.inherit,
        createRole: row.createRole,
        createDatabase: row.createDatabase,
        canLogin: row.canLogin,
        replication: row.replication,
        bypassRls: row.bypassRls,
        connectionLimit: Number(row.connectionLimit),
      }))
      .sort((left, right) => compareText(left.name, right.name)),
    memberships: membershipRows.map((row) => ({
      role: row.role,
      member: row.member,
      grantor: row.grantor,
      adminOption: row.adminOption,
    })),
    grants: {
      database: databaseGrants.map(normalizeNamespaceGrant),
      schemas: schemaGrants.map(normalizeNamespaceGrant),
      tables: tableGrants.map(normalizeGrant),
      sequences: sequenceGrants.map(normalizeGrant),
      routines: routineGrants.map(normalizeGrant),
    },
    appliedMigrations: migrationRows,
    rlsTables: rlsRows,
  };
}

function runPrismaDiff(
  repositoryRoot: string,
  databaseUrl: string,
): PrismaDiffEvidence {
  const cli = join(
    repositoryRoot,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "migrate",
      "diff",
      "--exit-code",
      "--from-schema-datamodel=prisma/schema.prisma",
      "--to-schema-datasource=prisma/schema.prisma",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
      encoding: "utf8",
      windowsHide: true,
      timeout: 120_000,
    },
  );
  const exitCode = result.status ?? -1;
  const summaryText = sanitizePrismaOutput(
    `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  );
  return {
    status:
      exitCode === 0
        ? "no-differences"
        : exitCode === 2
          ? "differences-detected"
          : "error",
    exitCode,
    outputSha256: sha256(summaryText),
    summary: summaryText ? summaryText.split("\n") : [],
  };
}

function deriveFindings(
  report: Omit<LocalPostgresCatalogAudit, "findings" | "verdict">,
): Finding[] {
  const findings: Finding[] = [];
  if (!report.safety.readOnlySession) {
    findings.push({
      code: "DB.READ_ONLY_SESSION_MISSING",
      severity: "blocker",
      message:
        "Catalog evidence was not captured through a read-only PostgreSQL session.",
    });
  }
  if (report.postgres.major !== report.postgres.configuredLocalMajor) {
    findings.push({
      code: "DB.LOCAL_MAJOR_CONFIG_MISMATCH",
      severity: "blocker",
      message: `Server major ${report.postgres.major} does not match configured local major ${report.postgres.configuredLocalMajor}.`,
    });
  }
  if (report.postgres.timezone.toUpperCase() !== "UTC") {
    findings.push({
      code: "DB.TIMEZONE_NOT_UTC",
      severity: "blocker",
      message: `Local database timezone is ${report.postgres.timezone}, expected UTC.`,
    });
  }
  if (report.roles.current !== EXPECTED_RUNTIME_ROLE) {
    findings.push({
      code: "DB.RUNTIME_ROLE_MISMATCH",
      severity: "blocker",
      message: `Catalog queries ran as ${report.roles.current}, not least-privilege ${EXPECTED_RUNTIME_ROLE}.`,
    });
  }
  const currentRole = report.roles.catalog.find(
    (role) => role.name === report.roles.current,
  );
  if (currentRole?.superuser || currentRole?.bypassRls) {
    findings.push({
      code: "DB.CURRENT_ROLE_BYPASSES_RLS",
      severity: "blocker",
      message: `Current role ${report.roles.current} is superuser or BYPASSRLS and cannot prove application isolation.`,
    });
  }
  if (
    !report.roles.catalog.some((role) => role.name === EXPECTED_RUNTIME_ROLE)
  ) {
    findings.push({
      code: "DB.RUNTIME_ROLE_MISSING",
      severity: "blocker",
      message: `Expected runtime role ${EXPECTED_RUNTIME_ROLE} is absent from the local catalog.`,
    });
  }
  if (report.migrations.comparison.status !== "in-sync") {
    const mismatchNames = report.migrations.comparison.checksumMismatches.map(
      (migration) => migration.name,
    );
    findings.push({
      code: "DB.MIGRATION_HISTORY_DRIFT",
      severity: "blocker",
      message:
        mismatchNames.length > 0
          ? `Applied Prisma migration checksums do not match this checkout: ${mismatchNames.join(", ")}. The checkout cannot be assumed to reproduce the applied schema.`
          : "Applied Prisma migration names/status do not match this checkout; the checkout cannot be assumed to reproduce the applied schema.",
    });
  }
  if (report.drift.prismaDatamodel.status === "differences-detected") {
    findings.push({
      code: "DB.PRISMA_DATAMODEL_DIFFERENCES",
      severity: "warning",
      message:
        "The live catalog differs from the Prisma datamodel; migration-managed supplemental objects must be attributed before this is classified as drift.",
    });
  } else if (report.drift.prismaDatamodel.status === "error") {
    findings.push({
      code: "DB.PRISMA_DIFF_ERROR",
      severity: "blocker",
      message: "Prisma datamodel comparison did not complete successfully.",
    });
  }
  if (
    report.rowLevelSecurity.enabledTableCount !==
    report.rowLevelSecurity.forceEnabledTableCount
  ) {
    findings.push({
      code: "DB.FORCE_RLS_GAP",
      severity: "blocker",
      message:
        "At least one RLS-enabled public table does not FORCE ROW LEVEL SECURITY.",
    });
  }
  findings.push({
    code: "DB.CATALOG_PARITY_UNPROVEN",
    severity: "blocker",
    message:
      "Functions, triggers, grants, extensions and policies were observed but not compared with a safely replayed isolated migration catalog.",
  });
  findings.push({
    code: "DB.PRODUCTION_PARITY_UNVERIFIED",
    severity: "blocker",
    message:
      "This loopback-only lane does not prove production PostgreSQL version, collation, extensions, roles, grants or topology.",
  });
  return findings;
}

function normalizeAppliedMigration(row: AppliedMigrationRow): AppliedMigration {
  return {
    name: row.name,
    checksum: row.checksum.toLowerCase(),
    status: row.rolledBackAt
      ? "rolled-back"
      : row.finishedAt
        ? "applied"
        : "incomplete",
    startedAt: toIso(row.startedAt),
    finishedAt: row.finishedAt ? toIso(row.finishedAt) : null,
    rolledBackAt: row.rolledBackAt ? toIso(row.rolledBackAt) : null,
    appliedStepsCount: Number(row.appliedStepsCount),
  };
}

function normalizeGrant(row: GrantRow): GrantRecord {
  return {
    grantee: row.grantee,
    schema: row.schema,
    object: row.object,
    privilege: row.privilege,
    grantable: row.grantable,
  };
}

function normalizeNamespaceGrant(row: NamespaceGrantRow): NamespaceGrantRecord {
  return {
    grantee: row.grantee,
    schema: row.schema,
    privilege: row.privilege,
    grantable: row.grantable,
  };
}

function summarizeRlsRows(rows: RlsRow[]) {
  const tables = rows.map((row) => ({
    schema: row.schema,
    table: row.table,
    enabled: row.enabled,
    forced: row.forced,
    policyCount: Number(row.policyCount),
  }));
  const applicationTables = tables.filter(
    (table) => table.table !== "_prisma_migrations",
  );
  const prismaMigrationTable = tables.find(
    (table) => table.table === "_prisma_migrations",
  );
  return {
    publicTableCount: tables.length,
    enabledTableCount: tables.filter((table) => table.enabled).length,
    forceEnabledTableCount: tables.filter((table) => table.forced).length,
    applicationTableCount: applicationTables.length,
    applicationEnabledTableCount: applicationTables.filter(
      (table) => table.enabled,
    ).length,
    applicationForceEnabledTableCount: applicationTables.filter(
      (table) => table.forced,
    ).length,
    prismaMigrationMetadata: {
      present: Boolean(prismaMigrationTable),
      enabled: prismaMigrationTable?.enabled ?? null,
      forced: prismaMigrationTable?.forced ?? null,
      policyCount: prismaMigrationTable?.policyCount ?? null,
    },
    policyCount: tables.reduce((total, table) => total + table.policyCount, 0),
    tables,
  };
}

function summarizeRlsTables(value: unknown[]) {
  if (!value.every(isRlsTable)) return null;
  const rows = value as LocalPostgresCatalogAudit["rowLevelSecurity"]["tables"];
  const applicationTables = rows.filter(
    (table) => table.table !== "_prisma_migrations",
  );
  const prismaMigrationTable = rows.find(
    (table) => table.table === "_prisma_migrations",
  );
  return {
    publicTableCount: rows.length,
    enabledTableCount: rows.filter((row) => row.enabled).length,
    forceEnabledTableCount: rows.filter((row) => row.forced).length,
    applicationTableCount: applicationTables.length,
    applicationEnabledTableCount: applicationTables.filter((row) => row.enabled)
      .length,
    applicationForceEnabledTableCount: applicationTables.filter(
      (row) => row.forced,
    ).length,
    prismaMigrationMetadata: {
      present: Boolean(prismaMigrationTable),
      enabled: prismaMigrationTable?.enabled ?? null,
      forced: prismaMigrationTable?.forced ?? null,
      policyCount: prismaMigrationTable?.policyCount ?? null,
    },
    policyCount: rows.reduce((total, row) => total + row.policyCount, 0),
  };
}

function buildReadOnlyEvidenceUrl(value: string) {
  const url = new URL(value);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "10");
  url.searchParams.set("connect_timeout", "5");
  url.searchParams.set(
    "options",
    "-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=2000",
  );
  return url.toString();
}

function safeTarget(
  value: string,
): LocalPostgresCatalogAudit["safety"]["target"] {
  const url = new URL(value);
  return {
    protocol: "postgresql",
    host: url.hostname as "127.0.0.1" | "[::1]",
    port: Number(url.port || "5432"),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
  };
}

function readConfiguredLocalMajor(repositoryRoot: string) {
  const source = readFileSync(
    join(repositoryRoot, "docker-compose.local-db.yml"),
    "utf8",
  );
  const match = source.match(/^\s*image:\s*postgres:(\d+)(?:[-\s]|$)/mu);
  if (!match)
    throw new Error("Unable to determine configured local PostgreSQL major.");
  return Number(match[1]);
}

function currentBinding(repositoryRoot: string): LocalPostgresCatalogBinding {
  const fingerprint = getDesignLabSourceFingerprint(repositoryRoot);
  const compatibility = collectDatabaseCompatibilityInventory(repositoryRoot);
  return {
    testedCommitSha: getRepositoryHeadSha(repositoryRoot),
    sourceSha256: fingerprint.sha256,
    sourceFileCount: fingerprint.fileCount,
    prismaSchemaSha256: compatibility.schemaSha256,
    migrationsSha256: compatibility.migrationsSha256,
    sourceMigrations: collectSourceMigrations(repositoryRoot),
  };
}

function findCredentialLeaks(
  value: unknown,
  path = "$",
  issues: string[] = [],
) {
  if (typeof value === "string") {
    if (
      /postgres(?:ql)?:\/\//iu.test(value) ||
      /(?:password|secret|token)\s*[=:]/iu.test(value)
    ) {
      issues.push(
        `Catalog evidence contains connection or credential material at ${path}.`,
      );
    }
    return issues;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      findCredentialLeaks(item, `${path}[${index}]`, issues),
    );
    return issues;
  }
  if (!isRecord(value)) return issues;
  for (const [key, item] of Object.entries(value)) {
    if (
      [
        "password",
        "secret",
        "token",
        "databaseUrl",
        "directUrl",
        "connectionString",
      ].includes(key)
    ) {
      issues.push(`Catalog evidence contains prohibited key ${path}.${key}.`);
    }
    findCredentialLeaks(item, `${path}.${key}`, issues);
  }
  return issues;
}

function isAppliedMigration(value: unknown): value is AppliedMigration {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    /^[a-f0-9]{64}$/u.test(String(value.checksum)) &&
    ["applied", "rolled-back", "incomplete"].includes(String(value.status)) &&
    typeof value.startedAt === "string" &&
    (typeof value.finishedAt === "string" || value.finishedAt === null) &&
    (typeof value.rolledBackAt === "string" || value.rolledBackAt === null) &&
    Number.isInteger(value.appliedStepsCount)
  );
}

function isRlsTable(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.schema === "string" &&
    typeof value.table === "string" &&
    typeof value.enabled === "boolean" &&
    typeof value.forced === "boolean" &&
    Number.isInteger(value.policyCount) &&
    Number(value.policyCount) >= 0
  );
}

function isExtensionRecord(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.schema === "string"
  );
}

function isRoleRecord(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.superuser === "boolean" &&
    typeof value.inherit === "boolean" &&
    typeof value.createRole === "boolean" &&
    typeof value.createDatabase === "boolean" &&
    typeof value.canLogin === "boolean" &&
    typeof value.replication === "boolean" &&
    typeof value.bypassRls === "boolean" &&
    Number.isInteger(value.connectionLimit)
  );
}

function isRoleMembership(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.role === "string" &&
    typeof value.member === "string" &&
    typeof value.grantor === "string" &&
    typeof value.adminOption === "boolean"
  );
}

function isNamespaceGrant(value: unknown): value is NamespaceGrantRecord {
  return (
    isRecord(value) &&
    typeof value.grantee === "string" &&
    typeof value.schema === "string" &&
    typeof value.privilege === "string" &&
    typeof value.grantable === "boolean"
  );
}

function isGrant(value: unknown): value is GrantRecord {
  return (
    isNamespaceGrant(value) &&
    "object" in value &&
    typeof value.object === "string"
  );
}

function isSortedUniqueObjectArray(value: unknown, key: string) {
  if (!Array.isArray(value)) return false;
  const names = value.map((item) => (isRecord(item) ? item[key] : undefined));
  if (!names.every((name) => typeof name === "string")) return false;
  return (
    new Set(names).size === names.length &&
    JSON.stringify(names) === JSON.stringify([...names].sort(compareText))
  );
}

function toIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Migration timestamp is invalid.");
  return date.toISOString();
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left: unknown, right: unknown) {
  return String(left).localeCompare(String(right), "en");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry && resolve(entry) === fileURLToPath(import.meta.url));
}

async function main() {
  const repositoryRoot = resolve(".");
  const outputPath = resolve(
    readFlag("--output") ?? LOCAL_POSTGRES_CATALOG_AUDIT_PATH,
  );
  if (process.argv.includes("--validate-existing")) {
    const value = JSON.parse(readFileSync(outputPath, "utf8")) as unknown;
    const issues = findLocalPostgresCatalogAuditIssues(
      value,
      currentBinding(repositoryRoot),
    );
    if (issues.length > 0) {
      throw new Error(
        `Existing catalog evidence is invalid:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
      );
    }
    console.log(
      "Local PostgreSQL catalog evidence is structurally valid and source-bound.",
    );
    console.log(
      "Compatibility remains blocked; inspect the artifact findings.",
    );
    process.exitCode = 1;
    return;
  }

  const localDatabaseUrl = process.env.LOCAL_DATABASE_URL;
  if (!localDatabaseUrl) {
    throw new Error(
      "LOCAL_DATABASE_URL is required explicitly; the catalog audit will not fall back to DATABASE_URL or a hard-coded port.",
    );
  }
  const report = await collectAudit(repositoryRoot, localDatabaseUrl);
  const issues = findLocalPostgresCatalogAuditIssues(
    report,
    currentBinding(repositoryRoot),
  );
  if (issues.length > 0) {
    throw new Error(
      `Catalog evidence validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
    );
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(outputPath, reportJson, "utf8");
  console.log(`Local PostgreSQL catalog evidence captured: ${report.verdict}.`);
  console.log(
    `PostgreSQL ${report.postgres.major}; migrations ${report.migrations.applied.filter((row) => row.status === "applied").length}/${report.migrations.source.length}; application RLS ${report.rowLevelSecurity.applicationEnabledTableCount}/${report.rowLevelSecurity.applicationTableCount}; application FORCE RLS ${report.rowLevelSecurity.applicationForceEnabledTableCount}; Prisma metadata RLS ${report.rowLevelSecurity.prismaMigrationMetadata.enabled === true ? "on" : "off"}.`,
  );
  console.log(
    `Current role ${report.roles.current}; expected ${report.roles.expectedRuntime}; least-privilege match ${report.roles.leastPrivilegeMatch}.`,
  );
  console.log(`Evidence SHA-256: ${sha256(reportJson)}`);
  console.log(`Report: ${outputPath}`);
  process.exitCode = 1;
}

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a path value.`);
  }
  return value;
}

type ServerRow = {
  version: string;
  versionNum: number;
  currentRole: string;
  sessionRole: string;
  serverEncoding: string;
  timezone: string;
  readOnlySession: boolean;
  collation: string;
  ctype: string;
};
type ExtensionRow = { name: string; version: string; schema: string };
type RoleRow = {
  name: string;
  superuser: boolean;
  inherit: boolean;
  createRole: boolean;
  createDatabase: boolean;
  canLogin: boolean;
  replication: boolean;
  bypassRls: boolean;
  connectionLimit: number;
};
type RoleMembershipRow = RoleMembership;
type GrantRow = GrantRecord;
type NamespaceGrantRow = NamespaceGrantRecord;
type AppliedMigrationRow = {
  name: string;
  checksum: string;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  rolledBackAt: Date | string | null;
  appliedStepsCount: bigint | number;
};
type RlsRow = {
  schema: string;
  table: string;
  enabled: boolean;
  forced: boolean;
  policyCount: bigint | number;
};

const SERVER_QUERY = `
  SELECT
    current_setting('server_version')::text AS "version",
    current_setting('server_version_num')::int AS "versionNum",
    current_user::text AS "currentRole",
    session_user::text AS "sessionRole",
    current_setting('server_encoding')::text AS "serverEncoding",
    current_setting('TimeZone')::text AS "timezone",
    current_setting('transaction_read_only')::boolean AS "readOnlySession",
    d.datcollate::text AS "collation",
    d.datctype::text AS "ctype"
  FROM pg_database d
  WHERE d.datname = current_database()
`;

const EXTENSION_QUERY = `
  SELECT e.extname::text AS "name", e.extversion::text AS "version", n.nspname::text AS "schema"
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  ORDER BY e.extname
`;

const ROLE_QUERY = `
  SELECT
    rolname::text AS "name", rolsuper AS "superuser", rolinherit AS "inherit",
    rolcreaterole AS "createRole", rolcreatedb AS "createDatabase", rolcanlogin AS "canLogin",
    rolreplication AS "replication", rolbypassrls AS "bypassRls", rolconnlimit::int AS "connectionLimit"
  FROM pg_roles
  ORDER BY rolname
`;

const ROLE_MEMBERSHIP_QUERY = `
  SELECT
    parent.rolname::text AS "role", member.rolname::text AS "member",
    grantor.rolname::text AS "grantor", membership.admin_option AS "adminOption"
  FROM pg_auth_members membership
  JOIN pg_roles parent ON parent.oid = membership.roleid
  JOIN pg_roles member ON member.oid = membership.member
  JOIN pg_roles grantor ON grantor.oid = membership.grantor
  ORDER BY parent.rolname, member.rolname, grantor.rolname
`;

const DATABASE_GRANT_QUERY = `
  SELECT
    COALESCE(grantee.rolname, 'PUBLIC')::text AS "grantee",
    current_database()::text AS "schema",
    acl.privilege_type::text AS "privilege",
    acl.is_grantable AS "grantable"
  FROM pg_database d
  CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) acl
  LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
  WHERE d.datname = current_database()
  ORDER BY "grantee", "privilege"
`;

const SCHEMA_GRANT_QUERY = `
  SELECT
    COALESCE(grantee.rolname, 'PUBLIC')::text AS "grantee",
    n.nspname::text AS "schema",
    acl.privilege_type::text AS "privilege",
    acl.is_grantable AS "grantable"
  FROM pg_namespace n
  CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
  LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
  WHERE n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
  ORDER BY "grantee", "schema", "privilege"
`;

const TABLE_GRANT_QUERY = `
  SELECT grantee::text AS "grantee", table_schema::text AS "schema",
    table_name::text AS "object", privilege_type::text AS "privilege",
    (is_grantable = 'YES') AS "grantable"
  FROM information_schema.table_privileges
  WHERE table_schema <> 'information_schema' AND table_schema NOT LIKE 'pg\\_%' ESCAPE '\\'
  ORDER BY grantee, table_schema, table_name, privilege_type
`;

const SEQUENCE_GRANT_QUERY = `
  SELECT grantee::text AS "grantee", object_schema::text AS "schema",
    object_name::text AS "object", privilege_type::text AS "privilege",
    (is_grantable = 'YES') AS "grantable"
  FROM information_schema.usage_privileges
  WHERE object_type = 'SEQUENCE'
    AND object_schema <> 'information_schema' AND object_schema NOT LIKE 'pg\\_%' ESCAPE '\\'
  ORDER BY grantee, object_schema, object_name, privilege_type
`;

const ROUTINE_GRANT_QUERY = `
  SELECT grantee::text AS "grantee", routine_schema::text AS "schema",
    routine_name::text AS "object", privilege_type::text AS "privilege",
    (is_grantable = 'YES') AS "grantable"
  FROM information_schema.routine_privileges
  WHERE routine_schema <> 'information_schema' AND routine_schema NOT LIKE 'pg\\_%' ESCAPE '\\'
  ORDER BY grantee, routine_schema, routine_name, privilege_type
`;

const MIGRATION_QUERY = `
  SELECT migration_name::text AS "name", checksum::text AS "checksum",
    started_at AS "startedAt", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt",
    applied_steps_count::bigint AS "appliedStepsCount"
  FROM "_prisma_migrations"
  ORDER BY migration_name, started_at
`;

const RLS_QUERY = `
  SELECT n.nspname::text AS "schema", c.relname::text AS "table",
    c.relrowsecurity AS "enabled", c.relforcerowsecurity AS "forced",
    COUNT(p.oid)::bigint AS "policyCount"
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  GROUP BY n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
  ORDER BY n.nspname, c.relname
`;

if (isMainModule()) {
  main().catch((error: unknown) => {
    const message = sanitizePrismaOutput(
      error instanceof Error ? error.message : String(error),
    );
    console.error("Local PostgreSQL catalog audit failed safely.");
    if (message) console.error(message);
    process.exitCode = 1;
  });
}
