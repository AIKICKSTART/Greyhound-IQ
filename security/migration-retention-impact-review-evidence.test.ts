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
  auditMigrationRetentionImpacts,
  MIGRATION_RETENTION_IMPACT_REVIEW_MASTER_EVIDENCE,
  MIGRATION_RETENTION_IMPACT_REVIEW_REQUIREMENT_ID,
  MIGRATION_RETENTION_IMPACT_REVIEW_SCOPE,
  REVIEWED_MIGRATION_RETENTION_IMPACTS,
  type MigrationRetentionReview,
  type MigrationRetentionSource,
} from "./migration-retention-impact-review-evidence";
import { RETENTION_SCHEDULES } from "./retention-schedule";

const sources = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = join("prisma/migrations", entry.name, "migration.sql").replaceAll(
      "\\",
      "/",
    );
    return { path, source: readFileSync(path, "utf8") };
  });
const scheduleRequirementIds = RETENTION_SCHEDULES.map(
  ({ requirementId }) => requirementId,
);
const compatibility = collectDatabaseCompatibilityInventory();
const current = auditMigrationRetentionImpacts(
  sources,
  REVIEWED_MIGRATION_RETENTION_IMPACTS,
  scheduleRequirementIds,
);

assert.deepEqual(databaseCompatibilityInventoryDiff(compatibility), []);
assert.deepEqual(compatibility, DATABASE_COMPATIBILITY_BASELINE);
assert.equal(sources.length, 97);
assert.deepEqual(current.issues, []);
assert.equal(current.candidates.length, 26);
assert.equal(REVIEWED_MIGRATION_RETENTION_IMPACTS.length, 26);
assert.equal(
  current.candidates.filter(({ operation }) => operation === "create-column")
    .length,
  22,
);
assert.equal(
  current.candidates.filter(({ operation }) => operation === "add-column").length,
  4,
);
assert.equal(
  REVIEWED_MIGRATION_RETENTION_IMPACTS.filter(
    ({ decision }) => decision === "retention-schedule-binding",
  ).length,
  14,
);
assert.equal(
  REVIEWED_MIGRATION_RETENTION_IMPACTS.filter(
    ({ decision }) => decision === "operational-validity-only",
  ).length,
  6,
);
assert.equal(
  REVIEWED_MIGRATION_RETENTION_IMPACTS.filter(
    ({ decision }) => decision === "lifecycle-marker-only",
  ).length,
  6,
);
assert.deepEqual(
  [
    ...new Set(
      REVIEWED_MIGRATION_RETENTION_IMPACTS.flatMap(({ scheduleRequirementId }) =>
        scheduleRequirementId === null ? [] : [scheduleRequirementId],
      ),
    ),
  ].sort(),
  [
    "security.retention-schedule.ai-prompts-and-responses",
    "security.retention-schedule.comments",
    "security.retention-schedule.deleted-account-data",
    "security.retention-schedule.exports",
    "security.retention-schedule.listings",
    "security.retention-schedule.media",
    "security.retention-schedule.messages",
    "security.retention-schedule.posts",
  ],
);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_RETENTION_IMPACT_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review retention impact.");
const evidence =
  MIGRATION_RETENTION_IMPACT_REVIEW_MASTER_EVIDENCE[
    MIGRATION_RETENTION_IMPACT_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing migration retention evidence: ${path}`);
}
assert.match(MIGRATION_RETENTION_IMPACT_REVIEW_SCOPE, /complete checked-in Prisma migration history/i);
assert.match(MIGRATION_RETENTION_IMPACT_REVIEW_SCOPE, /retention-impact review only/i);
assert.match(MIGRATION_RETENTION_IMPACT_REVIEW_SCOPE, /does not assert retention-job execution/i);
assert.match(MIGRATION_RETENTION_IMPACT_REVIEW_SCOPE, /deletion completion/i);
assert.match(MIGRATION_RETENTION_IMPACT_REVIEW_SCOPE, /production readiness/i);

assertIssue([], [], [], "MIGRATION_RETENTION_SOURCE_INVENTORY_VACUOUS");
assertIssue([], [], [], "MIGRATION_RETENTION_CANDIDATE_INVENTORY_VACUOUS");
assertIssue([], [], [], "MIGRATION_RETENTION_REVIEW_INVENTORY_VACUOUS");
assertIssue([], [], [], "MIGRATION_RETENTION_SCHEDULE_INVENTORY_VACUOUS");
assertIssue(
  [fixtureSource('CREATE TABLE "NoLifecycle" ("id" TEXT);')],
  [],
  scheduleRequirementIds,
  "MIGRATION_RETENTION_CANDIDATE_INVENTORY_VACUOUS",
);
assertIssue(
  [
    fixtureSource('CREATE TABLE "Artifact" ("expiresAt" TIMESTAMP);'),
    fixtureSource('CREATE TABLE "Artifact" ("expiresAt" TIMESTAMP);'),
  ],
  [],
  scheduleRequirementIds,
  "MIGRATION_RETENTION_SOURCE_PATH_DUPLICATE",
);

const fixture = fixtureSource(
  [
    '-- CREATE TABLE "Ignored" ("deletedAt" TIMESTAMP);',
    'CREATE TABLE "Artifact" (',
    '  "id" TEXT,',
    '  "expiresAt" TIMESTAMP',
    ');',
    'ALTER TABLE "Artifact" ADD COLUMN "deletedAt" TIMESTAMP;',
    'ALTER TABLE "Artifact" ALTER COLUMN "expiresAt" SET NOT NULL;',
    'ALTER TABLE "Artifact" RENAME COLUMN "deletedAt" TO "purgedAt";',
    'ALTER TABLE "Artifact" DROP COLUMN "purgedAt";',
  ].join("\n"),
);
const fixtureCandidates = auditMigrationRetentionImpacts(
  [fixture],
  [],
  scheduleRequirementIds,
).candidates;
assert.equal(fixtureCandidates.length, 5);
assert.deepEqual(
  fixtureCandidates.map(({ operation }) => operation).sort(),
  [
    "add-column",
    "alter-column",
    "create-column",
    "drop-column",
    "rename-column",
  ],
);
const fixtureReviews = fixtureCandidates.map(
  ({ key }): MigrationRetentionReview => ({
    key,
    decision: "retention-schedule-binding",
    scheduleRequirementId: "security.retention-schedule.exports",
    rationale:
      "The synthetic artifact lifecycle field is deliberately bound to the export schedule so the fixture can prove exact review coverage for each supported migration operation without asserting execution.",
  }),
);
assert.deepEqual(
  auditMigrationRetentionImpacts(
    [fixture],
    fixtureReviews,
    scheduleRequirementIds,
  ).issues,
  [],
);
assertIssue(
  [fixture],
  fixtureReviews.slice(1),
  scheduleRequirementIds,
  "MIGRATION_RETENTION_CANDIDATE_UNREVIEWED",
);
assertIssue(
  [fixture],
  [...fixtureReviews, fixtureReviews[0]],
  scheduleRequirementIds,
  "MIGRATION_RETENTION_REVIEW_DUPLICATE",
);
assertIssue(
  [fixture],
  [...fixtureReviews, { ...fixtureReviews[0], key: "stale-review" }],
  scheduleRequirementIds,
  "MIGRATION_RETENTION_REVIEW_STALE",
);
assertIssue(
  [fixture],
  [
    {
      ...fixtureReviews[0],
      scheduleRequirementId: "security.retention-schedule.missing",
    },
    ...fixtureReviews.slice(1),
  ],
  scheduleRequirementIds,
  "MIGRATION_RETENTION_SCHEDULE_INVALID",
);
assertIssue(
  [fixture],
  [{ ...fixtureReviews[0], rationale: "too short" }, ...fixtureReviews.slice(1)],
  scheduleRequirementIds,
  "MIGRATION_RETENTION_RATIONALE_INCOMPLETE",
);
assertIssue(
  [fixture],
  [
    {
      ...fixtureReviews[0],
      decision: "operational-validity-only",
    },
    ...fixtureReviews.slice(1),
  ],
  scheduleRequirementIds,
  "MIGRATION_RETENTION_NON_BINDING_HAS_SCHEDULE",
);

console.log(
  "Migration retention-impact review passed: 26 retention-semantic column changes across 97 migrations have exact decisions (14 schedule-bound, 6 operational-validity, 6 lifecycle-only).",
);

function assertIssue(
  fixtureSources: readonly MigrationRetentionSource[],
  reviews: readonly MigrationRetentionReview[],
  schedules: readonly string[],
  expected: string,
) {
  const issues = auditMigrationRetentionImpacts(
    fixtureSources,
    reviews,
    schedules,
  ).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function fixtureSource(source: string): MigrationRetentionSource {
  return {
    path: "prisma/migrations/20990101000000_retention_fixture/migration.sql",
    source,
  };
}
