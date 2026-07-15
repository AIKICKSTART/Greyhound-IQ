import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditMigrationTableRewrites,
  MIGRATION_TABLE_REWRITE_REVIEW_MASTER_EVIDENCE,
  MIGRATION_TABLE_REWRITE_REVIEW_REQUIREMENT_ID,
  MIGRATION_TABLE_REWRITE_REVIEW_SCOPE,
  REVIEWED_TABLE_REWRITES,
  type MigrationRewriteSource,
} from "./migration-table-rewrite-review-evidence";

const sources = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = join("prisma/migrations", entry.name, "migration.sql").replaceAll("\\", "/");
    return { path, source: readFileSync(path, "utf8") };
  });
const audit = auditMigrationTableRewrites(sources);
assert.deepEqual(audit.issues, []);
assert.ok(sources.length >= 90, "migration source inventory must be non-vacuous");
  assert.deepEqual(
    audit.risks,
    REVIEWED_TABLE_REWRITES.map((review) => ({
      path: review.path,
      line: review.line,
      table: review.table,
      kind: review.kind,
      operation: review.operation,
    })),
  );
assert.equal(audit.risks.length, 1);
assert.equal(REVIEWED_TABLE_REWRITES[0].disposition.length > 80, true);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_TABLE_REWRITE_REVIEW_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable migration table-rewrite requirement missing");
assert.equal(requirement.requirement, "Review migrations for table-rewrite risk.");
const evidence =
  MIGRATION_TABLE_REWRITE_REVIEW_MASTER_EVIDENCE[
    MIGRATION_TABLE_REWRITE_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing table-rewrite evidence: ${path}`);
}
assert.match(MIGRATION_TABLE_REWRITE_REVIEW_SCOPE, /every new or changed risk fails closed/i);

assertIssue([], "TABLE_REWRITE_SOURCE_INVENTORY_VACUOUS");
for (const sql of [
  'ALTER TABLE "User" ALTER COLUMN "email" TYPE VARCHAR(320);',
  'ALTER TABLE "User" ADD COLUMN "search" TEXT GENERATED ALWAYS AS (lower("email")) STORED;',
  'ALTER TABLE "User" ADD COLUMN "nonce" UUID DEFAULT gen_random_uuid();',
  'ALTER TABLE "User" SET LOGGED;',
  'ALTER TABLE "User" SET ACCESS METHOD heap;',
  'ALTER TABLE "User" SET TABLESPACE fast_space;',
  'CLUSTER "User" USING "User_email_key";',
  'VACUUM FULL "User";',
]) {
  assertIssue([source(sql)], "TABLE_REWRITE_UNREVIEWED");
}
assert.ok(
  auditMigrationTableRewrites(sources, []).issues.some((issue) =>
    issue.startsWith("TABLE_REWRITE_UNREVIEWED"),
  ),
  "removing the current exact review must fail closed",
);
assert.ok(
  auditMigrationTableRewrites(sources, [
    ...REVIEWED_TABLE_REWRITES,
    {
      ...REVIEWED_TABLE_REWRITES[0],
      line: 999,
      disposition: "A deliberately stale table-rewrite review fixture whose full disposition is long enough to reach stale-review validation.",
    },
  ]).issues.some((issue) => issue.startsWith("TABLE_REWRITE_REVIEW_STALE")),
  "a stale review must fail closed",
);
assert.ok(
  auditMigrationTableRewrites(sources, [
    REVIEWED_TABLE_REWRITES[0],
    REVIEWED_TABLE_REWRITES[0],
  ]).issues.includes("TABLE_REWRITE_REVIEW_DUPLICATE"),
  "duplicate review records must fail closed",
);
assert.deepEqual(
  auditMigrationTableRewrites([
    source('-- ALTER TABLE "User" SET LOGGED;\nCREATE TABLE "Safe" ("id" TEXT);'),
  ], []),
  { risks: [], issues: [] },
  "commented risks must not be promoted",
);

console.log(
  `Migration table-rewrite review passed: ${sources.length} migrations scanned and ${audit.risks.length} exact ephemeral-table rewrite reviewed; all unreviewed rewrite families fail closed.`,
);

function assertIssue(sources: MigrationRewriteSource[], expected: string) {
  const issues = auditMigrationTableRewrites(sources).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function source(sql: string): MigrationRewriteSource {
  return { path: "negative.sql", source: sql };
}
