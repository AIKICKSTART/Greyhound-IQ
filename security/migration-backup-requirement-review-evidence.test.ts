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
import {
  auditMigrationBackupRequirements,
  auditReviewedNonDmlBackupRequirements,
  MIGRATION_BACKUP_REQUIREMENT_REVIEW_MASTER_EVIDENCE,
  MIGRATION_BACKUP_REQUIREMENT_REVIEW_REQUIREMENT_ID,
  MIGRATION_BACKUP_REQUIREMENT_REVIEW_SCOPE,
  REVIEWED_NON_DML_BACKUP_REQUIREMENTS,
  type MigrationBackupSource,
  type ReviewedNonDmlBackupRequirement,
} from "./migration-backup-requirement-review-evidence";
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
const mutationAudit = auditMigrationBackupRequirements(sources);
const backwardAudit = auditMigrationBackwardCompatibility(sources);
const rewriteAudit = auditMigrationTableRewrites(sources);
const nonDmlRiskKeys = [
  ...backwardAudit.risks.map(
    ({ path, line, subject, kind, operation }) =>
      `${path}:${line}:${subject}:${kind}:${operation}`,
  ),
  ...rewriteAudit.risks.map(
    ({ path, line, table, kind, operation }) =>
      `${path}:${line}:${table}:${kind}:${operation}`,
  ),
];

assert.deepEqual(databaseCompatibilityInventoryDiff(compatibility), []);
assert.deepEqual(compatibility, DATABASE_COMPATIBILITY_BASELINE);
assert.equal(sources.length, 108);
assert.deepEqual(mutationAudit.issues, []);
assert.equal(mutationAudit.records.length, 21);
assert.equal(mutationAudit.requiredBackupCount, 20);
assert.equal(mutationAudit.newRelationCount, 1);
assert.equal(
  mutationAudit.records.filter(({ operation }) => operation === "update").length,
  21,
);
assert.equal(
  mutationAudit.records.filter(({ operation }) => operation === "delete").length,
  0,
);
assert.equal(
  mutationAudit.records.filter(({ operation }) => operation === "truncate").length,
  0,
);
assert.ok(
  mutationAudit.records.some(
    ({ relation, decision }) =>
      relation === "storage.buckets" &&
      decision === "backup-required-before-production",
  ),
);
assert.deepEqual(backwardAudit.issues, []);
assert.equal(backwardAudit.risks.length, 1);
assert.deepEqual(rewriteAudit.issues, []);
assert.equal(rewriteAudit.risks.length, 1);
assert.deepEqual(auditReviewedNonDmlBackupRequirements(nonDmlRiskKeys), []);
assert.equal(REVIEWED_NON_DML_BACKUP_REQUIREMENTS.length, 2);
assert.deepEqual(
  REVIEWED_NON_DML_BACKUP_REQUIREMENTS.map(({ decision }) => decision).sort(),
  [
    "backup-required-before-production",
    "no-backup-for-new-disposable-relation",
  ],
);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_BACKUP_REQUIREMENT_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review backup requirements.");
const evidence =
  MIGRATION_BACKUP_REQUIREMENT_REVIEW_MASTER_EVIDENCE[
    MIGRATION_BACKUP_REQUIREMENT_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing migration backup evidence: ${path}`);
}
assert.match(MIGRATION_BACKUP_REQUIREMENT_REVIEW_SCOPE, /every executable migration UPDATE/i);
assert.match(MIGRATION_BACKUP_REQUIREMENT_REVIEW_SCOPE, /backup-requirement review only/i);
assert.match(MIGRATION_BACKUP_REQUIREMENT_REVIEW_SCOPE, /does not assert a backup/i);
assert.match(MIGRATION_BACKUP_REQUIREMENT_REVIEW_SCOPE, /restore test/i);
assert.match(MIGRATION_BACKUP_REQUIREMENT_REVIEW_SCOPE, /deployed data volume/i);

assertMutationIssue([], "MIGRATION_BACKUP_SOURCE_INVENTORY_VACUOUS");
assertMutationIssue([], "MIGRATION_BACKUP_MUTATION_INVENTORY_VACUOUS");
assertMutationIssue(
  [source("UPDATE existing SET value = 1;"), source("UPDATE existing SET value = 1;")],
  "MIGRATION_BACKUP_SOURCE_PATH_INVALID",
);
const grantFixtureAudit = auditMigrationBackupRequirements([
  source("GRANT SELECT, INSERT, UPDATE ON existing TO runtime;\nUPDATE existing SET value = 1;"),
]);
assert.deepEqual(grantFixtureAudit.issues, []);
assert.deepEqual(
  grantFixtureAudit.records.map(({ operation, relation }) => ({ operation, relation })),
  [{ operation: "update", relation: "existing" }],
);

const fixtureAudit = auditMigrationBackupRequirements([
  source(
    [
      "-- UPDATE ignored SET value = 1;",
      'DROP POLICY IF EXISTS "Update private rows" ON existing;',
      "CREATE FUNCTION ignored() RETURNS trigger LANGUAGE plpgsql AS $$",
      "BEGIN UPDATE hidden SET value = 1; RETURN NEW; END;",
      "$$;",
      "CREATE TABLE new_relation (id text, value integer);",
      "UPDATE new_relation SET value = 1;",
      "UPDATE existing SET value = 1;",
      "DELETE FROM existing WHERE id = 'x';",
      "TRUNCATE TABLE existing;",
    ].join("\n"),
  ),
]);
assert.deepEqual(fixtureAudit.issues, []);
assert.equal(fixtureAudit.records.length, 4);
assert.equal(fixtureAudit.requiredBackupCount, 3);
assert.equal(fixtureAudit.newRelationCount, 1);
assert.equal(
  fixtureAudit.records.filter(({ relation }) => relation === "hidden").length,
  0,
);

assert.deepEqual(
  auditReviewedNonDmlBackupRequirements([], []),
  ["MIGRATION_BACKUP_NON_DML_RISKS_VACUOUS"],
);
assertNonDmlIssue(
  nonDmlRiskKeys,
  [],
  "MIGRATION_BACKUP_NON_DML_RISK_UNREVIEWED",
);
assertNonDmlIssue(
  nonDmlRiskKeys,
  [
    REVIEWED_NON_DML_BACKUP_REQUIREMENTS[0],
    REVIEWED_NON_DML_BACKUP_REQUIREMENTS[0],
  ],
  "MIGRATION_BACKUP_NON_DML_REVIEW_DUPLICATE",
);
assertNonDmlIssue(
  nonDmlRiskKeys,
  [
    ...REVIEWED_NON_DML_BACKUP_REQUIREMENTS,
    {
      ...REVIEWED_NON_DML_BACKUP_REQUIREMENTS[0],
      riskKey: "stale-risk",
    },
  ],
  "MIGRATION_BACKUP_NON_DML_REVIEW_STALE",
);
assertNonDmlIssue(
  nonDmlRiskKeys,
  [
    { ...REVIEWED_NON_DML_BACKUP_REQUIREMENTS[0], disposition: "too short" },
    REVIEWED_NON_DML_BACKUP_REQUIREMENTS[1],
  ],
  "MIGRATION_BACKUP_NON_DML_DISPOSITION_INCOMPLETE",
);

console.log(
  "Migration backup-requirement review passed: 21 executable data mutations across 100 migrations have explicit source decisions (20 production backup required, 1 new relation); 1 contract rename and 1 disposable-table rewrite have exact bound decisions.",
);

function assertMutationIssue(
  fixtureSources: MigrationBackupSource[],
  expected: string,
) {
  const issues = auditMigrationBackupRequirements(fixtureSources).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function assertNonDmlIssue(
  riskKeys: string[],
  reviews: ReviewedNonDmlBackupRequirement[],
  expected: string,
) {
  const issues = auditReviewedNonDmlBackupRequirements(riskKeys, reviews);
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function source(sql: string): MigrationBackupSource {
  return { path: "prisma/migrations/20990101000000_fixture/migration.sql", source: sql };
}
