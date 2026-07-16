import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type DatabaseCompatibilityCounts = {
  models: number;
  migrations: number;
  extensions: number;
  functions: number;
  triggers: number;
  policies: number;
  ordinaryViews: number;
  materializedViews: number;
  indexes: number;
  createdRoles: number;
};

export type DatabaseCompatibilityInventory = {
  schemaSha256: string;
  migrationsSha256: string;
  counts: DatabaseCompatibilityCounts;
};

export type MigrationSource = {
  path: string;
  source: string;
};

// Update only after reviewing the compatibility impact of the source change.
export const DATABASE_COMPATIBILITY_BASELINE: DatabaseCompatibilityInventory = {
  schemaSha256: "b0e50aa4850eebd5e3095bba619c87370b78f249fbeabf5b8691e169f3c02b22",
  migrationsSha256: "4812e2d48b9e24ed89dae0c79fb2ff1966b73539bb1ae92a804c2c2ffef1162f",
  counts: {
    models: 107,
    migrations: 97,
    extensions: 1,
    functions: 54,
    triggers: 15,
    policies: 252,
    ordinaryViews: 1,
    materializedViews: 5,
    indexes: 428,
    createdRoles: 1,
  },
};

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_IDENTIFIER = `${IDENTIFIER}(?:\s*\.\s*${IDENTIFIER})*`;

export function collectDatabaseCompatibilityInventory(
  repoRoot = process.cwd(),
): DatabaseCompatibilityInventory {
  const schemaPath = join(repoRoot, "prisma", "schema.prisma");
  const migrationsRoot = join(repoRoot, "prisma", "migrations");
  const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(migrationsRoot, entry.name, "migration.sql");
      return {
        path: toRepoPath(repoRoot, path),
        source: readFileSync(path, "utf8"),
      };
    });

  return buildDatabaseCompatibilityInventory(
    readFileSync(schemaPath, "utf8"),
    migrations,
  );
}

export function buildDatabaseCompatibilityInventory(
  schemaSource: string,
  migrations: readonly MigrationSource[],
): DatabaseCompatibilityInventory {
  const migrationSources = migrations
    .map((migration) => ({
      path: migration.path.replaceAll("\\", "/"),
      source: normalizeText(migration.source),
    }))
    .sort((left, right) => compareText(left.path, right.path));
  const sql = stripSqlComments(
    migrationSources.map((migration) => migration.source).join("\n"),
  );

  return {
    schemaSha256: sha256(normalizeText(schemaSource)),
    migrationsSha256: digestMigrations(migrationSources),
    counts: {
      models: uniqueMatches(
        normalizeText(schemaSource),
        new RegExp(`^\\s*model\\s+(${IDENTIFIER})\\s*\\{`, "gmu"),
      ).size,
      migrations: migrationSources.length,
      extensions: uniqueMatches(
        sql,
        new RegExp(
          `\\bCREATE\\s+EXTENSION\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${QUALIFIED_IDENTIFIER})`,
          "giu",
        ),
      ).size,
      functions: uniqueMatches(
        sql,
        new RegExp(
          `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(${QUALIFIED_IDENTIFIER})\\s*\\(`,
          "giu",
        ),
      ).size,
      triggers: uniqueMatches(
        sql,
        new RegExp(
          `\\bCREATE\\s+(?:CONSTRAINT\\s+)?TRIGGER\\s+(${IDENTIFIER})`,
          "giu",
        ),
      ).size,
      policies: uniqueMatches(
        sql,
        new RegExp(`\\bCREATE\\s+POLICY\\s+(${IDENTIFIER})`, "giu"),
      ).size,
      ordinaryViews: uniqueMatches(
        sql,
        new RegExp(
          `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?VIEW\\s+(${QUALIFIED_IDENTIFIER})`,
          "giu",
        ),
      ).size,
      materializedViews: uniqueMatches(
        sql,
        new RegExp(
          `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?MATERIALIZED\\s+VIEW\\s+(${QUALIFIED_IDENTIFIER})`,
          "giu",
        ),
      ).size,
      indexes: uniqueMatches(
        sql,
        new RegExp(
          `\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?(${QUALIFIED_IDENTIFIER})`,
          "giu",
        ),
      ).size,
      createdRoles: uniqueMatches(
        sql,
        new RegExp(`\\bCREATE\\s+ROLE\\s+(${IDENTIFIER})`, "giu"),
      ).size,
    },
  };
}

export function databaseCompatibilityInventoryDiff(
  actual: DatabaseCompatibilityInventory,
  expected: DatabaseCompatibilityInventory = DATABASE_COMPATIBILITY_BASELINE,
) {
  const findings: string[] = [];
  if (actual.schemaSha256 !== expected.schemaSha256) {
    findings.push(
      `schemaSha256 expected ${expected.schemaSha256}, received ${actual.schemaSha256}`,
    );
  }
  if (actual.migrationsSha256 !== expected.migrationsSha256) {
    findings.push(
      `migrationsSha256 expected ${expected.migrationsSha256}, received ${actual.migrationsSha256}`,
    );
  }
  for (const key of Object.keys(expected.counts) as Array<
    keyof DatabaseCompatibilityCounts
  >) {
    if (actual.counts[key] !== expected.counts[key]) {
      findings.push(
        `${key} expected ${expected.counts[key]}, received ${actual.counts[key]}`,
      );
    }
  }
  return findings;
}

function uniqueMatches(source: string, pattern: RegExp) {
  return new Set(
    [...source.matchAll(pattern)].map((match) => normalizeIdentifier(match[1])),
  );
}

function normalizeIdentifier(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function stripSqlComments(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function digestMigrations(migrations: readonly MigrationSource[]) {
  const hash = createHash("sha256");
  for (const migration of migrations) {
    hash.update(migration.path);
    hash.update("\0");
    hash.update(migration.source);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function toRepoPath(repoRoot: string, path: string) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry && resolve(entry) === fileURLToPath(import.meta.url));
}

function main() {
  const actual = collectDatabaseCompatibilityInventory();
  if (process.argv.includes("--print")) {
    console.log(JSON.stringify(actual, null, 2));
    return;
  }

  const findings = databaseCompatibilityInventoryDiff(actual);
  if (findings.length > 0) {
    console.error("Database compatibility inventory gate failed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log("Database compatibility source inventory passed.");
  console.log(`schemaSha256: ${actual.schemaSha256}`);
  console.log(`migrationsSha256: ${actual.migrationsSha256}`);
  console.log(`counts: ${JSON.stringify(actual.counts)}`);
}

if (isMainModule()) main();
