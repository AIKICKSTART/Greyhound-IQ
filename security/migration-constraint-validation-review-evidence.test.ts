import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditMigrationConstraintValidation,
  MIGRATION_CONSTRAINT_VALIDATION_REVIEW_MASTER_EVIDENCE,
  MIGRATION_CONSTRAINT_VALIDATION_REVIEW_REQUIREMENT_ID,
  MIGRATION_CONSTRAINT_VALIDATION_REVIEW_SCOPE,
  REVIEWED_PENDING_CONSTRAINTS,
} from "./migration-constraint-validation-review-evidence";
import type { ConstraintSource } from "./database-constraint-inventory-evidence";

const sources = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = join("prisma/migrations", entry.name, "migration.sql").replaceAll(
      "\\",
      "/",
    );
    return { path, source: readFileSync(path, "utf8") };
  });
const audit = auditMigrationConstraintValidation(sources);

assert.ok(sources.length >= 90, "migration source inventory must be non-vacuous");
assert.deepEqual(audit.issues, []);
assert.ok(audit.records.length >= 300, "constraint review must be non-vacuous");
assert.equal(
  audit.records.filter(({ strategy }) => strategy === "deferred-pending").length,
  REVIEWED_PENDING_CONSTRAINTS.length,
);
for (const strategy of [
  "new-table-immediate",
  "new-nullable-column-immediate",
  "new-nullable-column-null-guarded-check",
  "deferred-validated",
  "deferred-pending",
] as const) {
  assert.ok(
    audit.records.some((record) => record.strategy === strategy),
    `${strategy}: current source strategy must be represented`,
  );
}
assert.ok(
  audit.records.every(({ strategy }) => strategy !== "unreviewed-immediate"),
);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_CONSTRAINT_VALIDATION_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review constraint-validation strategy.");
const evidence =
  MIGRATION_CONSTRAINT_VALIDATION_REVIEW_MASTER_EVIDENCE[
    MIGRATION_CONSTRAINT_VALIDATION_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing constraint-validation evidence: ${path}`);
}
assert.match(MIGRATION_CONSTRAINT_VALIDATION_REVIEW_SCOPE, /fails closed/i);
assert.match(MIGRATION_CONSTRAINT_VALIDATION_REVIEW_SCOPE, /three feed checks/i);
assert.match(MIGRATION_CONSTRAINT_VALIDATION_REVIEW_SCOPE, /does not prove deployed data validity/i);

assertIssue([], "CONSTRAINT_VALIDATION_SOURCE_INVENTORY_VACUOUS");
assertIssue(
  [source('ALTER TABLE "Existing" ADD CONSTRAINT "old_fk" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id");')],
  "CONSTRAINT_VALIDATION_IMMEDIATE_UNREVIEWED",
);
assertIssue(
  [source('ALTER TABLE "Existing" ADD CONSTRAINT "old_check" CHECK ("state" = \'safe\');')],
  "CONSTRAINT_VALIDATION_IMMEDIATE_UNREVIEWED",
);
assertIssue(
  [source('ALTER TABLE "Existing" ADD CONSTRAINT "pending_check" CHECK (true) NOT VALID;')],
  "CONSTRAINT_VALIDATION_PENDING_UNREVIEWED",
);

assert.ok(
  auditMigrationConstraintValidation(sources, []).issues.some((issue) =>
    issue.startsWith("CONSTRAINT_VALIDATION_PENDING_UNREVIEWED"),
  ),
  "removing pending reviews must fail closed",
);
assert.ok(
  auditMigrationConstraintValidation(sources, [
    ...REVIEWED_PENDING_CONSTRAINTS,
    {
      ...REVIEWED_PENDING_CONSTRAINTS[0],
      name: "stale_constraint",
      disposition:
        "This deliberately stale validation review is long enough to pass completeness while proving unmatched source reviews fail closed.",
    },
  ]).issues.some((issue) =>
    issue.startsWith("CONSTRAINT_VALIDATION_REVIEW_STALE"),
  ),
);
assert.ok(
  auditMigrationConstraintValidation(sources, [
    REVIEWED_PENDING_CONSTRAINTS[0],
    REVIEWED_PENDING_CONSTRAINTS[0],
  ]).issues.includes("CONSTRAINT_VALIDATION_REVIEW_DUPLICATE"),
);
assert.ok(
  auditMigrationConstraintValidation(sources, [
    { ...REVIEWED_PENDING_CONSTRAINTS[0], disposition: "too short" },
  ]).issues.includes("CONSTRAINT_VALIDATION_DISPOSITION_INCOMPLETE"),
);

assertSafe([
  source(
    [
      '-- ALTER TABLE "Ignored" ADD CONSTRAINT "bad" CHECK (false);',
      'CREATE TABLE "NewTable" (',
      '  "id" TEXT,',
      '  CONSTRAINT "NewTable_pkey" PRIMARY KEY ("id")',
      ');',
    ].join("\n"),
  ),
]);
assertSafe([
  source(
    [
      'ALTER TABLE "Existing" ADD COLUMN "ownerId" TEXT;',
      'ALTER TABLE "Existing" ADD CONSTRAINT "new_fk" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id");',
    ].join("\n"),
  ),
]);
assertSafe([
  source(
    [
      'ALTER TABLE "Existing" ADD COLUMN "requestedBy" TEXT;',
      'ALTER TABLE "Existing" ADD CONSTRAINT "new_check" CHECK ("requestedBy" IS NULL OR "requestedBy" = "ownerId");',
    ].join("\n"),
  ),
]);
assertSafe([
  source(
    [
      'ALTER TABLE "Existing" ADD CONSTRAINT "deferred_check" CHECK (true) NOT VALID;',
      'ALTER TABLE "Existing" VALIDATE CONSTRAINT "deferred_check";',
    ].join("\n"),
  ),
]);

console.log(
  `Migration constraint-validation review passed: ${audit.records.length} named constraints across ${sources.length} migrations have exact strategies; ${REVIEWED_PENDING_CONSTRAINTS.length} historical validations remain explicitly pending.`,
);

function assertIssue(sources: ConstraintSource[], expected: string) {
  const issues = auditMigrationConstraintValidation(sources, []).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function assertSafe(sources: ConstraintSource[]) {
  assert.deepEqual(auditMigrationConstraintValidation(sources, [] ).issues, []);
}

function source(sql: string): ConstraintSource {
  return { path: "fixture.sql", source: sql };
}
