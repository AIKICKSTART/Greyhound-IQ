import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditMigrationIndexCreation,
  MIGRATION_INDEX_CREATION_REVIEW_MASTER_EVIDENCE,
  MIGRATION_INDEX_CREATION_REVIEW_REQUIREMENT_ID,
  MIGRATION_INDEX_CREATION_REVIEW_SCOPE,
  REVIEWED_EXISTING_RELATION_INDEX_BATCHES,
  type MigrationIndexSource,
  type ReviewedExistingRelationIndexBatch,
} from "./migration-index-creation-review-evidence";

const sources = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = join("prisma/migrations", entry.name, "migration.sql").replaceAll(
      "\\",
      "/",
    );
    return { path, source: readFileSync(path, "utf8") };
  });
const audit = auditMigrationIndexCreation(sources);

assert.ok(sources.length >= 90, "migration source inventory must be non-vacuous");
assert.deepEqual(audit.issues, []);
assert.equal(audit.occurrences, 462);
assert.equal(audit.records.length, audit.occurrences);
assert.equal(audit.existingImmediateBatches.length, 22);
assert.equal(REVIEWED_EXISTING_RELATION_INDEX_BATCHES.length, 22);
assert.equal(
  REVIEWED_EXISTING_RELATION_INDEX_BATCHES.reduce(
    (total, batch) => total + batch.signatures.length,
    0,
  ),
  67,
);
assert.equal(count("new-relation-immediate"), 394);
assert.equal(count("existing-relation-reviewed-immediate"), 67);
assert.equal(count("existing-relation-concurrent"), 1);
assert.equal(count("existing-relation-unreviewed"), 0);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_INDEX_CREATION_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review index-creation strategy.");
const evidence =
  MIGRATION_INDEX_CREATION_REVIEW_MASTER_EVIDENCE[
    MIGRATION_INDEX_CREATION_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing index-creation evidence: ${path}`);
}
assert.match(MIGRATION_INDEX_CREATION_REVIEW_SCOPE, /every CREATE INDEX/i);
assert.match(MIGRATION_INDEX_CREATION_REVIEW_SCOPE, /normalized-SQL signature/i);
assert.match(MIGRATION_INDEX_CREATION_REVIEW_SCOPE, /do not prove online production safety/i);

assertIssue([], "INDEX_CREATION_SOURCE_INVENTORY_VACUOUS");
assertIssue([source("CREATE INDEX broken;")], "INDEX_CREATION_PARSE_COVERAGE_MISMATCH");
assertIssue(
  [source('CREATE INDEX "Existing_name_idx" ON "Existing"("name");')],
  "INDEX_CREATION_EXISTING_RELATION_UNREVIEWED",
);

assert.deepEqual(
  auditMigrationIndexCreation(
    [
      source(
        [
          '-- CREATE INDEX "Ignored" ON "Existing"("unsafe");',
          'CREATE TABLE "NewTable" ("id" TEXT);',
          'CREATE INDEX "NewTable_id_idx" ON "NewTable"("id");',
          'CREATE MATERIALIZED VIEW "NewSummary" AS SELECT 1 AS id;',
          'CREATE UNIQUE INDEX "NewSummary_id_idx" ON "NewSummary"(id);',
          'CREATE INDEX CONCURRENTLY "Existing_id_idx" ON "Existing"("id");',
        ].join("\n"),
      ),
    ],
    [],
  ).issues,
  [],
);

const reviewedFixture = review(
  "fixture.sql",
  ['CREATE INDEX "Existing_name_idx" ON "Existing"("name");'],
);
assert.deepEqual(
  auditMigrationIndexCreation(
    [source('CREATE INDEX "Existing_name_idx" ON "Existing"("name");')],
    [reviewedFixture],
  ).issues,
  [],
);
assertIssueWithReviews(
  [source('CREATE INDEX "Existing_name_idx" ON "Existing"("displayName");')],
  [reviewedFixture],
  "INDEX_CREATION_REVIEW_DRIFT",
);
assertIssueWithReviews(
  [source('CREATE INDEX "Existing_name_idx" ON "Existing"("name");')],
  [{ ...reviewedFixture, path: "stale.sql" }],
  "INDEX_CREATION_REVIEW_STALE",
);
assertIssueWithReviews(
  [source('CREATE INDEX "Existing_name_idx" ON "Existing"("name");')],
  [reviewedFixture, reviewedFixture],
  "INDEX_CREATION_REVIEW_PATH_DUPLICATE",
);
assertIssueWithReviews(
  [source('CREATE INDEX "Existing_name_idx" ON "Existing"("name");')],
  [{ ...reviewedFixture, disposition: "too short" }],
  "INDEX_CREATION_DISPOSITION_INCOMPLETE",
);
assertIssueWithReviews(
  [source('CREATE INDEX "Existing_name_idx" ON "Existing"("name");')],
  [
    {
      ...reviewedFixture,
      signatures: [
        reviewedFixture.signatures[0],
        reviewedFixture.signatures[0],
      ],
    },
  ],
  "INDEX_CREATION_REVIEW_SIGNATURES_INVALID",
);

console.log(
  `Migration index-creation review passed: ${audit.records.length}/${audit.occurrences} indexes across ${sources.length} migrations classified; 394 new-relation, 1 concurrent and 67 exact pre-production immediate builds reviewed.`,
);

function count(strategy: (typeof audit.records)[number]["strategy"]) {
  return audit.records.filter((record) => record.strategy === strategy).length;
}

function assertIssue(sources: MigrationIndexSource[], expected: string) {
  assertIssueWithReviews(sources, [], expected);
}

function assertIssueWithReviews(
  sources: MigrationIndexSource[],
  reviews: ReviewedExistingRelationIndexBatch[],
  expected: string,
) {
  const issues = auditMigrationIndexCreation(sources, reviews).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function source(sql: string): MigrationIndexSource {
  return { path: "fixture.sql", source: sql };
}

function review(
  path: string,
  signatures: readonly string[],
): ReviewedExistingRelationIndexBatch {
  return {
    path,
    signatures,
    disposition:
      "This exact synthetic non-concurrent index batch is accepted only for the negative fixture. Any SQL signature drift must fail closed and require a new measured review before use.",
  };
}
