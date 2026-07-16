import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  MIGRATION_NULLABILITY_REVIEW_EVIDENCE_FILE,
  MIGRATION_NULLABILITY_REVIEW_EXPECTED_GAIN,
  MIGRATION_NULLABILITY_REVIEW_MASTER_EVIDENCE,
  MIGRATION_NULLABILITY_REVIEW_REQUIREMENT_IDS,
  MIGRATION_NULLABILITY_REVIEW_SCOPE,
  MIGRATION_NULLABILITY_REVIEW_TEST_FILE,
  evaluateMigrationNullabilityReview,
  type NullabilityMigrationSource,
} from "./migration-nullability-review-evidence";

const repositoryRoot = path.resolve(__dirname, "..");
const migrationsRoot = path.join(repositoryRoot, "prisma", "migrations");
const requirementId = "security.migration-review.nullability";

assert.deepEqual(MIGRATION_NULLABILITY_REVIEW_REQUIREMENT_IDS, [requirementId]);
assert.equal(MIGRATION_NULLABILITY_REVIEW_EXPECTED_GAIN, 1);
assert.equal(
  SECURITY_MASTER_REQUIREMENTS.find((requirement) => requirement.id === requirementId)
    ?.requirement,
  "Review new nullable and non-nullable columns.",
);
assert.deepEqual(MIGRATION_NULLABILITY_REVIEW_MASTER_EVIDENCE[requirementId], {
  status: "verified",
  evidence: [
    MIGRATION_NULLABILITY_REVIEW_EVIDENCE_FILE,
    MIGRATION_NULLABILITY_REVIEW_TEST_FILE,
    "prisma/migrations/migration_lock.toml",
    "scripts/run-unit-tests.ts",
    ".github/workflows/ci.yml",
    "package.json",
  ],
});
for (const evidencePath of MIGRATION_NULLABILITY_REVIEW_MASTER_EVIDENCE[
  requirementId
].evidence) {
  assert.ok(existsSync(path.join(repositoryRoot, evidencePath)), evidencePath);
}
assert.doesNotMatch(
  readFileSync(
    path.join(repositoryRoot, MIGRATION_NULLABILITY_REVIEW_EVIDENCE_FILE),
    "utf8",
  ),
  /(?:from\s+["']node:|require\(["']node:)/,
  "the evidence module must stay import-safe for the shared master registry",
);

const migrations = readdirSync(migrationsRoot)
  .map((entry) => path.join(migrationsRoot, entry, "migration.sql"))
  .filter((file) => existsSync(file) && statSync(file).isFile())
  .map(readMigration);
assert.ok(migrations.length >= 50, "the complete migration history is required");

const current = evaluateMigrationNullabilityReview(migrations);
assert.ok(current.addColumnOccurrences >= 90, "the review must be non-vacuous");
assert.ok(
  current.createdTableColumns.length >= 400,
  "CREATE TABLE column definitions must remain inside the review",
);
assert.equal(
  current.columns.length,
  current.addColumnOccurrences,
  "every ADD COLUMN occurrence needs exactly one reviewed record",
);
assert.deepEqual(
  current.issues,
  [],
  current.issues
    .map(
      (issue) =>
        `${issue.migrationPath}:${issue.line} ${issue.table ?? "?"}.${issue.column ?? "?"} ${issue.reason}`,
    )
    .join("\n"),
);
assert.ok(
  current.columns.some(
    (column) => column.strategy === "existing-table-nullable",
  ),
);
assert.ok(current.createdTableColumns.some((column) => column.nullable));
assert.ok(current.createdTableColumns.some((column) => !column.nullable));
assert.ok(
  current.columns.some(
    (column) => column.strategy === "existing-table-non-null-defaulted",
  ),
);

const unsafeMissingDefault = evaluateMigrationNullabilityReview([
  migration(
    "001_unsafe.sql",
    `ALTER TABLE "Account" ADD COLUMN "status" TEXT NOT NULL;`,
  ),
]);
assert.deepEqual(unsafeMissingDefault.issues, [
  {
    migrationPath: "001_unsafe.sql",
    table: "Account",
    column: "status",
    line: 1,
    reason: "existing-table-non-null-without-default",
  },
]);

const unsafeNullDefault = evaluateMigrationNullabilityReview([
  migration(
    "001_unsafe.sql",
    `ALTER TABLE "Account" ADD COLUMN "status" TEXT NOT NULL DEFAULT NULL;`,
  ),
]);
assert.equal(
  unsafeNullDefault.issues[0]?.reason,
  "existing-table-non-null-without-default",
);

const safeExistingTable = evaluateMigrationNullabilityReview([
  migration(
    "001_safe.sql",
    [
      `ALTER TABLE "Account" ADD COLUMN "nickname" TEXT,`,
      `ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';`,
    ].join("\n"),
  ),
]);
assert.deepEqual(safeExistingTable.issues, []);
assert.deepEqual(
  safeExistingTable.columns.map((column) => column.strategy),
  ["existing-table-nullable", "existing-table-non-null-defaulted"],
);

const safeNewTable = evaluateMigrationNullabilityReview([
  migration(
    "001_new.sql",
    [
      `CREATE TABLE "Account" ("id" TEXT);`,
      `ALTER TABLE "Account" ADD COLUMN "status" TEXT NOT NULL;`,
    ].join("\n"),
  ),
]);
assert.deepEqual(safeNewTable.issues, []);
assert.equal(safeNewTable.columns[0]?.strategy, "new-table");
assert.deepEqual(
  safeNewTable.createdTableColumns.map(({ column, nullable }) => ({
    column,
    nullable,
  })),
  [{ column: "id", nullable: true }],
);

const unparsedCreateTableColumn = evaluateMigrationNullabilityReview([
  migration("001_unparsed_create.sql", `CREATE TABLE "Account" ("id");`),
]);
assert.equal(
  unparsedCreateTableColumn.issues[0]?.reason,
  "unparsed-create-table-column",
);

const unparsedAddition = evaluateMigrationNullabilityReview([
  migration("001_unparsed.sql", `ADD COLUMN "orphan" TEXT;`),
]);
assert.deepEqual(unparsedAddition.issues, [
  {
    migrationPath: "001_unparsed.sql",
    table: null,
    column: null,
    line: 1,
    reason: "unparsed-add-column",
  },
]);

const commentsDoNotCreateEvidence = evaluateMigrationNullabilityReview([
  migration("001_comments.sql", `-- ADD COLUMN "orphan" TEXT;`),
]);
assert.equal(commentsDoNotCreateEvidence.addColumnOccurrences, 0);
assert.deepEqual(commentsDoNotCreateEvidence.issues, []);

const unitRunner = readFileSync(
  path.join(repositoryRoot, "scripts/run-unit-tests.ts"),
  "utf8",
);
const packageManifest = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const ciWorkflow = readFileSync(
  path.join(repositoryRoot, ".github/workflows/ci.yml"),
  "utf8",
);
assert.match(unitRunner, /\["src", "scripts", "security"\]\.flatMap\(findTestFiles\)/);
assert.match(unitRunner, /\\\.test\\\.tsx\?\$/);
assert.match(packageManifest.scripts["test:unit"] ?? "", /run-unit-tests\.ts/);
assert.match(packageManifest.scripts.ci ?? "", /npm run test:unit/);
assert.match(ciWorkflow, /run:\s+npm run test:unit/);

assert.match(MIGRATION_NULLABILITY_REVIEW_SCOPE, /every column definition in SQL CREATE TABLE/i);
assert.match(MIGRATION_NULLABILITY_REVIEW_SCOPE, /every ADD COLUMN/i);
assert.match(MIGRATION_NULLABILITY_REVIEW_SCOPE, /pre-existing table/i);
assert.match(MIGRATION_NULLABILITY_REVIEW_SCOPE, /missing-default/i);
assert.match(MIGRATION_NULLABILITY_REVIEW_SCOPE, /fail closed/i);
assert.match(MIGRATION_NULLABILITY_REVIEW_SCOPE, /does not assess default-expression volatility/i);

console.log(
  `Migration nullability review passed: ${current.createdTableColumns.length} created-table columns and ${current.columns.length}/${current.addColumnOccurrences} added columns across ${migrations.length} ordered migrations have an explicit safe strategy.`,
);

function readMigration(absolutePath: string): NullabilityMigrationSource {
  return {
    path: path.relative(repositoryRoot, absolutePath).replace(/\\/g, "/"),
    sql: readFileSync(absolutePath, "utf8"),
  };
}

function migration(path: string, sql: string): NullabilityMigrationSource {
  return { path, sql };
}
