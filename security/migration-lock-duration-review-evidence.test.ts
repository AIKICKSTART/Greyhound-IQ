import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  DATABASE_COMPATIBILITY_BASELINE,
  collectDatabaseCompatibilityInventory,
  databaseCompatibilityInventoryDiff,
} from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditMigrationIndexCreation,
  type MigrationIndexSource,
} from "./migration-index-creation-review-evidence";
import {
  auditMigrationLockDuration,
  MIGRATION_LOCK_DURATION_REVIEW_MASTER_EVIDENCE,
  MIGRATION_LOCK_DURATION_REVIEW_REQUIREMENT_ID,
  MIGRATION_LOCK_DURATION_REVIEW_SCOPE,
  REVIEWED_BLOCKING_ALTER_TABLES,
  type MigrationLockSource,
  type ReviewedBlockingAlterTable,
} from "./migration-lock-duration-review-evidence";

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
const lockAudit = auditMigrationLockDuration(sources);
const indexAudit = auditMigrationIndexCreation(sources as MigrationIndexSource[]);

assert.deepEqual(databaseCompatibilityInventoryDiff(compatibility), []);
assert.deepEqual(compatibility, DATABASE_COMPATIBILITY_BASELINE);
assert.equal(sources.length, 97);
assert.deepEqual(lockAudit.issues, []);
assert.equal(lockAudit.records.length, 409);
assert.deepEqual(lockAudit.counts, {
  "new-relation-operation": 199,
  "existing-catalog-operation": 179,
  "existing-validation-scan": 23,
  "existing-rewrite-operation": 0,
  "existing-blocking-operation": 8,
});
assert.equal(REVIEWED_BLOCKING_ALTER_TABLES.length, 8);
assert.deepEqual(indexAudit.issues, []);
assert.equal(indexAudit.occurrences, 429);
assert.equal(indexCount("new-relation-immediate"), 361);
assert.equal(indexCount("existing-relation-reviewed-immediate"), 67);
assert.equal(indexCount("existing-relation-concurrent"), 1);
assert.equal(indexCount("existing-relation-unreviewed"), 0);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_LOCK_DURATION_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review migrations for lock duration.");
const evidence =
  MIGRATION_LOCK_DURATION_REVIEW_MASTER_EVIDENCE[
    MIGRATION_LOCK_DURATION_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing migration lock evidence: ${path}`);
}
assert.match(MIGRATION_LOCK_DURATION_REVIEW_SCOPE, /every ALTER TABLE/i);
assert.match(MIGRATION_LOCK_DURATION_REVIEW_SCOPE, /exact index-creation review/i);
assert.match(MIGRATION_LOCK_DURATION_REVIEW_SCOPE, /does not claim measured lock duration/i);
assert.match(MIGRATION_LOCK_DURATION_REVIEW_SCOPE, /maintenance window/i);
assert.match(MIGRATION_LOCK_DURATION_REVIEW_SCOPE, /abort plan/i);

assertIssue([], [], "MIGRATION_LOCK_SOURCE_INVENTORY_VACUOUS");
assertIssue([], [], "MIGRATION_LOCK_ALTER_INVENTORY_VACUOUS");
assertIssue(
  [source("ALTER TABLE broken;")],
  [],
  "MIGRATION_LOCK_ALTER_PARSE_COVERAGE_MISMATCH",
);
assertIssue(
  [source("ALTER TABLE existing SET TABLESPACE fast;")],
  [],
  "MIGRATION_LOCK_ALTER_OPERATION_UNCLASSIFIED",
);
assertIssue(
  [source('ALTER TABLE existing ALTER COLUMN "value" TYPE text;')],
  [],
  "MIGRATION_LOCK_REWRITE_OPERATION_UNREVIEWED",
);
assertIssue(
  [source("ALTER TABLE existing DISABLE TRIGGER guard;")],
  [],
  "MIGRATION_LOCK_BLOCKING_OPERATION_UNREVIEWED",
);
for (const statement of [
  "TRUNCATE existing;",
  "VACUUM FULL existing;",
  "CLUSTER existing;",
  "REINDEX TABLE existing;",
  "LOCK TABLE existing;",
]) {
  assertIssue(
    [source(`ALTER TABLE existing ADD COLUMN value text;\n${statement}`)],
    [],
    "MIGRATION_LOCK_UNBOUNDED_MAINTENANCE_FORBIDDEN",
  );
}
assertIssue(
  [
    source(
      "ALTER TABLE existing ADD COLUMN value text;\nREFRESH MATERIALIZED VIEW summary;",
    ),
  ],
  [],
  "MIGRATION_LOCK_NONCONCURRENT_REFRESH_FORBIDDEN",
);

const positiveCatalog = auditMigrationLockDuration(
  [
    source(
      [
        "-- ALTER TABLE ignored SET TABLESPACE unsafe;",
        "ALTER TABLE existing ADD COLUMN value text;",
        "REFRESH MATERIALIZED VIEW CONCURRENTLY summary;",
      ].join("\n"),
    ),
  ],
  [],
);
assert.deepEqual(positiveCatalog.issues, []);
assert.equal(positiveCatalog.counts["existing-catalog-operation"], 1);

const blockingSource = source("ALTER TABLE existing DISABLE TRIGGER guard;");
const blockingRecord = auditMigrationLockDuration([blockingSource], []).records[0];
assert.ok(blockingRecord);
const blockingReview = review(blockingRecord.path, blockingRecord.signature);
assert.deepEqual(
  auditMigrationLockDuration([blockingSource], [blockingReview]).issues,
  [],
);
assertIssue(
  [blockingSource],
  [blockingReview, blockingReview],
  "MIGRATION_LOCK_BLOCKING_REVIEW_DUPLICATE",
);
assertIssue(
  [blockingSource],
  [{ ...blockingReview, disposition: "too short" }],
  "MIGRATION_LOCK_BLOCKING_DISPOSITION_INCOMPLETE",
);
assertIssue(
  [source("ALTER TABLE existing ADD COLUMN value text;")],
  [blockingReview],
  "MIGRATION_LOCK_BLOCKING_REVIEW_STALE",
);
assertIssue(
  [source("ALTER TABLE existing DISABLE TRIGGER changed_guard;")],
  [blockingReview],
  "MIGRATION_LOCK_BLOCKING_OPERATION_UNREVIEWED",
);

console.log(
  `Migration lock-duration review passed: ${lockAudit.records.length} ALTER TABLE and ${indexAudit.occurrences} CREATE INDEX operations across ${sources.length} migrations; 8 exact trigger toggles reviewed, 67 pre-production immediate indexes dispositioned, 1 concurrent index, and zero existing-table rewrites.`,
);

function indexCount(
  strategy: (typeof indexAudit.records)[number]["strategy"],
) {
  return indexAudit.records.filter((record) => record.strategy === strategy).length;
}

function assertIssue(
  fixtureSources: MigrationLockSource[],
  reviews: ReviewedBlockingAlterTable[],
  expected: string,
) {
  const issues = auditMigrationLockDuration(fixtureSources, reviews).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function source(sql: string): MigrationLockSource {
  return { path: "fixture.sql", source: sql };
}

function review(path: string, signature: string): ReviewedBlockingAlterTable {
  return {
    path,
    signature,
    disposition:
      "This exact trigger toggle is accepted only in the pre-production negative fixture. Any equivalent production change requires representative timing, a measured maintenance window, lock timeout, monitoring and an abort plan.",
  };
}
