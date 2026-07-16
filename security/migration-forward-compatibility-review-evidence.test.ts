import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  DATABASE_COMPATIBILITY_BASELINE,
  collectDatabaseCompatibilityInventory,
  databaseCompatibilityInventoryDiff,
} from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { auditMigrationBackwardCompatibility } from "./migration-backward-compatibility-review-evidence";
import { auditMigrationConstraintValidation } from "./migration-constraint-validation-review-evidence";
import { reviewMigrationDefaultValues } from "./migration-default-value-review-evidence";
import {
  assessMigrationForwardCompatibility,
  auditMigrationForwardStructure,
  MIGRATION_FORWARD_COMPATIBILITY_REVIEW_MASTER_EVIDENCE,
  MIGRATION_FORWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID,
  MIGRATION_FORWARD_COMPATIBILITY_REVIEW_SCOPE,
  type MigrationForwardReviewFacts,
  type MigrationForwardSource,
} from "./migration-forward-compatibility-review-evidence";
import { auditMigrationIndexCreation } from "./migration-index-creation-review-evidence";
import { auditMigrationLockDuration } from "./migration-lock-duration-review-evidence";
import { evaluateMigrationNullabilityReview } from "./migration-nullability-review-evidence";
import { auditMigrationTableRewrites } from "./migration-table-rewrite-review-evidence";

const sources = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = join("prisma/migrations", entry.name, "migration.sql").replaceAll(
      "\\",
      "/",
    );
    return { path, source: readFileSync(path, "utf8") };
  });
const compatibility = collectDatabaseCompatibilityInventory();
const structure = auditMigrationForwardStructure(sources);
const backward = auditMigrationBackwardCompatibility(sources);
const nullability = evaluateMigrationNullabilityReview(
  sources.map(({ path, source }) => ({ path, sql: source })),
);
const defaults = reviewMigrationDefaultValues(process.cwd());
const rewrites = auditMigrationTableRewrites(sources);
const constraints = auditMigrationConstraintValidation(sources);
const indexes = auditMigrationIndexCreation(sources);
const locks = auditMigrationLockDuration(sources);
const provider = readFileSync("prisma/migrations/migration_lock.toml", "utf8").match(
  /^provider\s*=\s*"([^"]+)"/mu,
)?.[1];

assert.deepEqual(databaseCompatibilityInventoryDiff(compatibility), []);
assert.deepEqual(compatibility, DATABASE_COMPATIBILITY_BASELINE);
assert.equal(provider, "postgresql");
assert.deepEqual(structure.issues, []);
assert.equal(structure.records.length, 100);
assert.equal(structure.records[0]?.timestamp, "20260630093000");
assert.equal(structure.records.at(-1)?.timestamp, "20260717010000");
assert.deepEqual(backward.issues, []);
assert.equal(backward.risks.length, 1);
assert.deepEqual(nullability.issues, []);
assert.equal(nullability.addColumnOccurrences, 124);
assert.equal(nullability.columns.length, 124);
assert.equal(nullability.createdTableColumns.length, 1076);
assert.deepEqual(defaults.issues, []);
assert.equal(defaults.reviewedDefaults.length, 261);
assert.deepEqual(rewrites.issues, []);
assert.equal(rewrites.risks.length, 1);
assert.deepEqual(constraints.issues, []);
assert.equal(constraints.records.length, 412);
assert.equal(
  constraints.records.filter(({ strategy }) => strategy === "deferred-pending")
    .length,
  3,
);
assert.deepEqual(indexes.issues, []);
assert.equal(indexes.records.length, 462);
assert.equal(
  indexes.records.filter(
    ({ strategy }) => strategy === "existing-relation-reviewed-immediate",
  ).length,
  67,
);
assert.deepEqual(locks.issues, []);
assert.equal(locks.records.length, 435);

const facts = buildFacts();
assert.deepEqual(assessMigrationForwardCompatibility(facts), []);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_FORWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review migrations for forward compatibility.");
const evidence =
  MIGRATION_FORWARD_COMPATIBILITY_REVIEW_MASTER_EVIDENCE[
    MIGRATION_FORWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing forward-compatibility evidence: ${path}`);
}
assert.match(MIGRATION_FORWARD_COMPATIBILITY_REVIEW_SCOPE, /exact ordered PostgreSQL/i);
assert.match(MIGRATION_FORWARD_COMPATIBILITY_REVIEW_SCOPE, /complete backward-contract/i);
assert.match(MIGRATION_FORWARD_COMPATIBILITY_REVIEW_SCOPE, /fail closed/i);
assert.match(MIGRATION_FORWARD_COMPATIBILITY_REVIEW_SCOPE, /does not claim zero-downtime/i);
assert.match(MIGRATION_FORWARD_COMPATIBILITY_REVIEW_SCOPE, /deployed schema parity/i);

assertStructureIssue([], "FORWARD_COMPATIBILITY_SOURCE_INVENTORY_VACUOUS");
assertStructureIssue(
  [migration("invalid/migration.sql", "SELECT 1;")],
  "FORWARD_COMPATIBILITY_MIGRATION_NAME_INVALID",
);
assertStructureIssue(
  [safeMigration(), safeMigration()],
  "FORWARD_COMPATIBILITY_SOURCE_PATH_INVALID",
);
assertStructureIssue(
  [
    safeMigration(),
    migration(
      "prisma/migrations/20990101000000_second/migration.sql",
      "SELECT 1;",
    ),
  ],
  "FORWARD_COMPATIBILITY_TIMESTAMP_DUPLICATE",
);
assertStructureIssue(
  [migration("prisma/migrations/20990101000000_empty/migration.sql", "-- only")],
  "FORWARD_COMPATIBILITY_MIGRATION_EMPTY",
);
assertStructureIssue(
  [migration("prisma/migrations/20990101000000_down/migration.sql", "-- migrate:down\nSELECT 1;")],
  "FORWARD_COMPATIBILITY_INLINE_DOWN_MIGRATION_FORBIDDEN",
);
for (const [sql, code] of [
  ["CREATE DATABASE unsafe;", "CREATE_DATABASE_FORBIDDEN"],
  ["DROP DATABASE unsafe;", "DROP_DATABASE_FORBIDDEN"],
  ["DROP SCHEMA public;", "DROP_SCHEMA_FORBIDDEN"],
  ["ALTER SYSTEM SET work_mem = '1GB';", "ALTER_SYSTEM_FORBIDDEN"],
  ["REASSIGN OWNED BY old_role TO new_role;", "REASSIGN_OWNED_FORBIDDEN"],
  ["DROP OWNED BY old_role;", "DROP_OWNED_FORBIDDEN"],
  ["SET session_replication_role = replica;", "REPLICATION_ROLE_BYPASS_FORBIDDEN"],
] as const) {
  assertStructureIssue([safeMigration(sql)], `FORWARD_COMPATIBILITY_${code}`);
}
assert.deepEqual(
  auditMigrationForwardStructure([
    safeMigration("-- DROP DATABASE ignored;\nCREATE TABLE safe (id text);"),
  ]).issues,
  [],
);

assertAssessmentIssue(
  { ...facts, migrationProvider: "mysql" },
  "FORWARD_COMPATIBILITY_PROVIDER_UNEXPECTED",
);
assertAssessmentIssue(
  { ...facts, migrationCount: 1 },
  "FORWARD_COMPATIBILITY_MIGRATION_INVENTORY_INCOMPLETE",
);
for (const [field, expected] of [
  ["structureIssues", "FORWARD_COMPATIBILITY_STRUCTURE"],
  ["backwardCompatibilityIssues", "FORWARD_COMPATIBILITY_BACKWARD_CONTRACT"],
  ["tableRewriteIssues", "FORWARD_COMPATIBILITY_TABLE_REWRITE"],
  ["constraintValidationIssues", "FORWARD_COMPATIBILITY_CONSTRAINT_VALIDATION"],
  ["indexCreationIssues", "FORWARD_COMPATIBILITY_INDEX_CREATION"],
  ["lockDurationIssues", "FORWARD_COMPATIBILITY_LOCK_DURATION"],
] as const) {
  assertAssessmentIssue({ ...facts, [field]: ["negative-fixture"] }, expected);
}
assertAssessmentIssue(
  { ...facts, nullabilityIssueCount: 1 },
  "FORWARD_COMPATIBILITY_NULLABILITY_REVIEW_INCOMPLETE",
);
assertAssessmentIssue(
  { ...facts, defaultValueIssueCount: 1 },
  "FORWARD_COMPATIBILITY_DEFAULT_REVIEW_INCOMPLETE",
);
assertAssessmentIssue(
  { ...facts, constraintCount: 1 },
  "FORWARD_COMPATIBILITY_CONSTRAINT_REVIEW_INCOMPLETE",
);
assertAssessmentIssue(
  { ...facts, indexCount: 1 },
  "FORWARD_COMPATIBILITY_INDEX_REVIEW_INCOMPLETE",
);
assertAssessmentIssue(
  { ...facts, alterTableCount: 1 },
  "FORWARD_COMPATIBILITY_LOCK_REVIEW_INCOMPLETE",
);

console.log(
  "Migration forward-compatibility review passed: 100 ordered PostgreSQL migrations composed with 7 exact source audits covering 124 added columns, 261 defaults, 1 contract break, 1 rewrite, 412 constraints, 462 indexes and 435 ALTER TABLE operations.",
);

function buildFacts(): MigrationForwardReviewFacts {
  return {
    migrationProvider: provider ?? "missing",
    migrationCount: sources.length,
    structureIssues: structure.issues,
    backwardCompatibilityIssues: backward.issues,
    backwardCompatibilityRiskCount: backward.risks.length,
    nullabilityIssueCount: nullability.issues.length,
    addedColumnCount: nullability.columns.length,
    defaultValueIssueCount: defaults.issues.length,
    reviewedDefaultCount: defaults.reviewedDefaults.length,
    tableRewriteIssues: rewrites.issues,
    tableRewriteRiskCount: rewrites.risks.length,
    constraintValidationIssues: constraints.issues,
    constraintCount: constraints.records.length,
    pendingConstraintCount: constraints.records.filter(
      ({ strategy }) => strategy === "deferred-pending",
    ).length,
    indexCreationIssues: indexes.issues,
    indexCount: indexes.records.length,
    reviewedImmediateIndexCount: indexes.records.filter(
      ({ strategy }) => strategy === "existing-relation-reviewed-immediate",
    ).length,
    lockDurationIssues: locks.issues,
    alterTableCount: locks.records.length,
  };
}

function assertStructureIssue(
  fixtureSources: MigrationForwardSource[],
  expected: string,
) {
  const issues = auditMigrationForwardStructure(fixtureSources).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function assertAssessmentIssue(
  fixtureFacts: MigrationForwardReviewFacts,
  expected: string,
) {
  const issues = assessMigrationForwardCompatibility(fixtureFacts);
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function safeMigration(source = "SELECT 1;"): MigrationForwardSource {
  return migration(
    "prisma/migrations/20990101000000_security_fixture/migration.sql",
    source,
  );
}

function migration(path: string, source: string): MigrationForwardSource {
  return { path, source };
}
