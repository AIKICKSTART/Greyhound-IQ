import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditMigrationBackwardCompatibility,
  MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_MASTER_EVIDENCE,
  MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID,
  MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_SCOPE,
  REVIEWED_BACKWARD_COMPATIBILITY_RISKS,
  type MigrationBackwardCompatibilitySource,
} from "./migration-backward-compatibility-review-evidence";

const sources = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = join("prisma/migrations", entry.name, "migration.sql").replaceAll(
      "\\",
      "/",
    );
    return { path, source: readFileSync(path, "utf8") };
  });
const audit = auditMigrationBackwardCompatibility(sources);

assert.ok(sources.length >= 90, "migration source inventory must be non-vacuous");
assert.deepEqual(audit.issues, []);
assert.deepEqual(
  audit.risks,
  REVIEWED_BACKWARD_COMPATIBILITY_RISKS.map((review) => ({
    path: review.path,
    line: review.line,
    subject: review.subject,
    kind: review.kind,
    operation: review.operation,
  })),
);
assert.equal(audit.risks.length, 1);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review migrations for backward compatibility.");
const evidence =
  MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_MASTER_EVIDENCE[
    MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing backward-compatibility evidence: ${path}`);
}
assert.match(MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_SCOPE, /fail closed/i);
assert.match(MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_SCOPE, /pre-production cutover/i);
assert.match(MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_SCOPE, /does not prove zero-downtime/i);

const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /\bworkosUserId\s+String\?/);
assert.doesNotMatch(schema, /\bsupabaseUid\b/);
const reviewedMigration = readFileSync(
  REVIEWED_BACKWARD_COMPATIBILITY_RISKS[0].path,
  "utf8",
);
assert.match(
  reviewedMigration,
  /^ALTER TABLE "User" RENAME COLUMN "supabaseUid" TO "workosUserId";/,
);

assertIssue([], "BACKWARD_COMPATIBILITY_SOURCE_INVENTORY_VACUOUS");
for (const sql of [
  'DROP TABLE "Account";',
  'DROP VIEW "AccountView";',
  'DROP MATERIALIZED VIEW "AccountSummary";',
  'DROP TYPE "AccountState";',
  'DROP DOMAIN "EmailAddress";',
  'DROP FUNCTION "account_name";',
  'DROP PROCEDURE "purge_account";',
  'ALTER TABLE "Account" DROP COLUMN "name";',
  'ALTER TABLE "Account" RENAME TO "Customer";',
  'ALTER TABLE "Account" RENAME COLUMN "name" TO "displayName";',
  'ALTER TABLE "Account" ALTER COLUMN "name" TYPE VARCHAR(80);',
  'ALTER TABLE "Account" ALTER COLUMN "name" SET NOT NULL;',
  'ALTER TABLE "Account" ALTER COLUMN "state" DROP DEFAULT;',
  'ALTER TABLE "Account" ADD COLUMN "state" TEXT NOT NULL;',
]) {
  assertIssue([source(sql)], "BACKWARD_COMPATIBILITY_UNREVIEWED");
}
assert.ok(
  auditMigrationBackwardCompatibility(sources, []).issues.some((issue) =>
    issue.startsWith("BACKWARD_COMPATIBILITY_UNREVIEWED"),
  ),
  "removing the exact historical review must fail closed",
);
assert.ok(
  auditMigrationBackwardCompatibility(sources, [
    ...REVIEWED_BACKWARD_COMPATIBILITY_RISKS,
    {
      ...REVIEWED_BACKWARD_COMPATIBILITY_RISKS[0],
      line: 999,
      disposition:
        "This deliberately stale compatibility fixture is long enough to pass disposition completeness while proving stale reviews fail closed.",
    },
  ]).issues.some((issue) =>
    issue.startsWith("BACKWARD_COMPATIBILITY_REVIEW_STALE"),
  ),
);
assert.ok(
  auditMigrationBackwardCompatibility(sources, [
    REVIEWED_BACKWARD_COMPATIBILITY_RISKS[0],
    REVIEWED_BACKWARD_COMPATIBILITY_RISKS[0],
  ]).issues.includes("BACKWARD_COMPATIBILITY_REVIEW_DUPLICATE"),
);
assert.ok(
  auditMigrationBackwardCompatibility(sources, [
    {
      ...REVIEWED_BACKWARD_COMPATIBILITY_RISKS[0],
      disposition: "too short",
    },
  ]).issues.includes("BACKWARD_COMPATIBILITY_DISPOSITION_INCOMPLETE"),
);

const safe = auditMigrationBackwardCompatibility(
  [
    source(
      [
        '-- DROP TABLE "Ignored";',
        'CREATE TABLE "Safe" ("id" TEXT NOT NULL);',
        'ALTER TABLE "Safe" ADD COLUMN "nickname" TEXT;',
        'ALTER TABLE "Safe" ADD COLUMN "state" TEXT NOT NULL DEFAULT \'active\';',
        'ALTER INDEX "Safe_id_key" RENAME TO "Safe_identifier_key";',
      ].join("\n"),
    ),
  ],
  [],
);
assert.deepEqual(safe, { risks: [], issues: [] });

console.log(
  `Migration backward-compatibility review passed: ${sources.length} migrations scanned and ${audit.risks.length} exact historical schema-contract break reviewed; every new breaking family fails closed.`,
);

function assertIssue(
  sources: MigrationBackwardCompatibilitySource[],
  expected: string,
) {
  const issues = auditMigrationBackwardCompatibility(sources, []).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function source(sql: string): MigrationBackwardCompatibilitySource {
  return { path: "negative.sql", source: sql };
}
