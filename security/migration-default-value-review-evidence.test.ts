import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  MIGRATION_DEFAULT_VALUE_REVIEW_MASTER_EVIDENCE,
  MIGRATION_DEFAULT_VALUE_REVIEW_REQUIREMENT_ID,
  reviewMigrationDefaultValues,
} from "./migration-default-value-review-evidence";

const repositoryRoot = resolve(import.meta.dirname, "..");
const current = reviewMigrationDefaultValues(repositoryRoot);

assert.deepEqual(
  current.issues,
  [],
  `current migration defaults must be fully reviewed:\n${JSON.stringify(current.issues, null, 2)}`,
);
assert.equal(current.migrationFiles, 97);
assert.equal(current.reviewedDefaults.length, 246);
assert.equal(
  current.reviewedDefaults.length + current.skippedDefaultPrivilegeClauses,
  current.executableDefaultKeywords,
  "every executable DEFAULT keyword must be classified or identified as privilege grammar",
);
assert.deepEqual(countClassifications(current.reviewedDefaults), {
  "boolean-literal": 22,
  "numeric-literal": 38,
  "string-literal": 65,
  "transaction-timestamp": 121,
});
assert.ok(
  current.reviewedDefaults.every(
    ({ path, behavior }) =>
      path.startsWith("prisma/migrations/") && behavior.length > 20,
  ),
  "each reviewed default must retain its source and explicit behavior",
);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_DEFAULT_VALUE_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review default-value behavior.");
const evidence =
  MIGRATION_DEFAULT_VALUE_REVIEW_MASTER_EVIDENCE[
    MIGRATION_DEFAULT_VALUE_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(join(repositoryRoot, path)), `missing evidence: ${path}`);
}

const unsafeRoot = createMigrationFixture(`
  CREATE TABLE "UnsafeDefault" (
    "randomValue" DOUBLE PRECISION NOT NULL DEFAULT random(),
    "sessionOwner" TEXT NOT NULL DEFAULT current_setting('app.user_id'),
    "nullableByDefault" TEXT DEFAULT NULL
  );
`);
try {
  const unsafe = reviewMigrationDefaultValues(unsafeRoot);
  assert.equal(
    unsafe.issues.filter(
      ({ code }) => code === "unreviewed-default-expression",
    ).length,
    3,
    "volatile, session-dependent, and NULL defaults must fail closed",
  );
} finally {
  rmSync(unsafeRoot, { force: true, recursive: true });
}

const ignoredTextRoot = createMigrationFixture(`
  -- DEFAULT random() is documentation, not executable SQL.
  DO $$ BEGIN RAISE NOTICE 'DEFAULT current_setting'; END $$;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  CREATE TABLE "SafeDefault" (
    "status" TEXT NOT NULL DEFAULT 'pending'
  );
`);
try {
  const ignoredText = reviewMigrationDefaultValues(ignoredTextRoot);
  assert.deepEqual(ignoredText.issues, []);
  assert.equal(ignoredText.reviewedDefaults.length, 1);
  assert.equal(ignoredText.skippedDefaultPrivilegeClauses, 1);
  assert.equal(ignoredText.executableDefaultKeywords, 2);
} finally {
  rmSync(ignoredTextRoot, { force: true, recursive: true });
}

const malformedRoot = createMigrationFixture(`
  CREATE TABLE "MalformedDefault" (
    "status" TEXT NOT NULL DEFAULT 'pending
  );
`);
try {
  const malformed = reviewMigrationDefaultValues(malformedRoot);
  assert.ok(
    malformed.issues.some(({ code }) => code === "unterminated-string"),
    "malformed SQL must fail closed",
  );
} finally {
  rmSync(malformedRoot, { force: true, recursive: true });
}

const emptyRoot = createMigrationFixture(`CREATE TABLE "NoDefault" ("id" TEXT);`);
try {
  const empty = reviewMigrationDefaultValues(emptyRoot);
  assert.ok(
    empty.issues.some(({ code }) => code === "no-reviewed-defaults"),
    "a vacuous migration corpus must not verify the gate",
  );
} finally {
  rmSync(emptyRoot, { force: true, recursive: true });
}

console.log(
  "Migration default-value review passed: 246/246 defaults across 97 migrations have explicit behavior classifications; unsafe and vacuous fixtures fail closed.",
);

function createMigrationFixture(source: string) {
  const root = mkdtempSync(join(tmpdir(), "greyhoundiq-default-review-"));
  const migration = join(
    root,
    "prisma",
    "migrations",
    "20990101000000_security_negative_fixture",
  );
  mkdirSync(migration, { recursive: true });
  writeFileSync(join(migration, "migration.sql"), source, "utf8");
  return root;
}

function countClassifications(
  defaults: ReturnType<typeof reviewMigrationDefaultValues>["reviewedDefaults"],
) {
  return defaults.reduce<Record<string, number>>((counts, item) => {
    counts[item.classification] = (counts[item.classification] ?? 0) + 1;
    return counts;
  }, {});
}
