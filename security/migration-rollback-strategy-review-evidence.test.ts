import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  MIGRATION_ROLLBACK_STRATEGY,
  MIGRATION_ROLLBACK_STRATEGY_REVIEW_MASTER_EVIDENCE,
  MIGRATION_ROLLBACK_STRATEGY_REVIEW_REQUIREMENT_ID,
  MIGRATION_ROLLBACK_STRATEGY_REVIEW_SCOPE,
  reviewMigrationRollbackStrategy,
} from "./migration-rollback-strategy-review-evidence";

const repositoryRoot = resolve(import.meta.dirname, "..");
const current = reviewMigrationRollbackStrategy(repositoryRoot);

assert.deepEqual(
  current.issues,
  [],
  `current rollback strategy review must pass:\n${JSON.stringify(current.issues, null, 2)}`,
);
assert.deepEqual(current, {
  policyFilesReviewed: 3,
  policyClausesReviewed: 4,
  migrationDirectoriesReviewed: 100,
  migrationSqlFilesReviewed: 100,
  issues: [],
});

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_ROLLBACK_STRATEGY_REVIEW_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Review rollback strategy.");
const evidence =
  MIGRATION_ROLLBACK_STRATEGY_REVIEW_MASTER_EVIDENCE[
    MIGRATION_ROLLBACK_STRATEGY_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(join(repositoryRoot, path)), `missing evidence: ${path}`);
}

assert.match(MIGRATION_ROLLBACK_STRATEGY, /newly reviewed forward-fix migration/iu);
assert.match(MIGRATION_ROLLBACK_STRATEGY, /separate operational controls/iu);
assert.match(MIGRATION_ROLLBACK_STRATEGY_REVIEW_SCOPE, /100-directory history/iu);
assert.match(MIGRATION_ROLLBACK_STRATEGY_REVIEW_SCOPE, /does not prove/iu);
assert.match(MIGRATION_ROLLBACK_STRATEGY_REVIEW_SCOPE, /backup or restore/iu);

const reverseArtifactRoot = createRepositoryFixture(
  `CREATE TABLE "ForwardOnly" ("id" TEXT);`,
);
writeFixtureFile(
  reverseArtifactRoot,
  "prisma/migrations/20990101000000_fixture/down.sql",
  `DROP TABLE "ForwardOnly";`,
);
try {
  const reverseArtifact = reviewMigrationRollbackStrategy(reverseArtifactRoot);
  assert.ok(
    reverseArtifact.issues.some(
      ({ code, path }) =>
        code === "unexpected-migration-artifact" && path.endsWith("/down.sql"),
    ),
    "a reverse/down companion must fail closed",
  );
} finally {
  rmSync(reverseArtifactRoot, { force: true, recursive: true });
}

const executableRollbackRoot = createRepositoryFixture(`
  BEGIN;
  CREATE TABLE "Transient" ("id" TEXT);
  ROLLBACK;
`);
try {
  const executableRollback = reviewMigrationRollbackStrategy(
    executableRollbackRoot,
  );
  assert.ok(
    executableRollback.issues.some(
      ({ code, line }) =>
        code === "executable-rollback-statement" && line === 4,
    ),
    "an executable ROLLBACK statement must fail closed",
  );
} finally {
  rmSync(executableRollbackRoot, { force: true, recursive: true });
}

const ignoredTextRoot = createRepositoryFixture(`
  -- ROLLBACK is explanatory text only.
  /* A nested /* rollback */ comment remains non-executable. */
  DO $$ BEGIN RAISE NOTICE 'ROLLBACK'; END $$;
  CREATE TABLE "ForwardFix" ("description" TEXT DEFAULT 'rollback-safe');
`);
try {
  assert.deepEqual(
    reviewMigrationRollbackStrategy(ignoredTextRoot).issues,
    [],
    "comments and quoted text must not be mistaken for executable rollback",
  );
} finally {
  rmSync(ignoredTextRoot, { force: true, recursive: true });
}

const missingPolicyRoot = createRepositoryFixture(
  `CREATE TABLE "ForwardOnly" ("id" TEXT);`,
);
writeFixtureFile(
  missingPolicyRoot,
  "docs/planning/operations-deployment.md",
  "### Rollback strategy\nDatabase rollback is left implicit.",
);
try {
  assert.ok(
    reviewMigrationRollbackStrategy(missingPolicyRoot).issues.some(
      ({ code, path }) =>
        code === "missing-policy-clause" &&
        path === "docs/planning/operations-deployment.md",
    ),
    "an implicit or erased forward-fix policy must fail closed",
  );
} finally {
  rmSync(missingPolicyRoot, { force: true, recursive: true });
}

const malformedRoot = createRepositoryFixture(`
  CREATE TABLE "Malformed" ("id" TEXT);
  /* unterminated
`);
try {
  assert.ok(
    reviewMigrationRollbackStrategy(malformedRoot).issues.some(
      ({ code }) => code === "malformed-migration-sql",
    ),
    "malformed migration SQL must fail closed",
  );
} finally {
  rmSync(malformedRoot, { force: true, recursive: true });
}

const vacuousRoot = createRepositoryFixture(
  `CREATE TABLE "Removed" ("id" TEXT);`,
);
rmSync(join(vacuousRoot, "prisma", "migrations"), {
  force: true,
  recursive: true,
});
mkdirSync(join(vacuousRoot, "prisma", "migrations"), { recursive: true });
try {
  assert.ok(
    reviewMigrationRollbackStrategy(vacuousRoot).issues.some(
      ({ code }) => code === "no-migrations",
    ),
    "a vacuous history must not verify rollback strategy",
  );
} finally {
  rmSync(vacuousRoot, { force: true, recursive: true });
}

console.log(
  "Migration rollback-strategy review passed: 100/100 canonical forward-only migrations, four policy clauses, and fail-closed reverse-artifact/executable-rollback fixtures.",
);

function createRepositoryFixture(migrationSql: string) {
  const root = mkdtempSync(join(tmpdir(), "greyhoundiq-rollback-review-"));
  writeFixtureFile(
    root,
    "AGENTS.md",
    "Any Prisma migration must be forward-only and reviewed.",
  );
  writeFixtureFile(
    root,
    "prisma/AGENTS.md",
    [
      "migrations/ owns forward-only schema history.",
      "Add a new migration for schema changes.",
    ].join("\n"),
  );
  writeFixtureFile(
    root,
    "docs/planning/operations-deployment.md",
    [
      "### Rollback strategy",
      "Database migrations are forward-only (no rollbacks); reverse migrations are forward-fix scripts",
    ].join("\n"),
  );
  writeFixtureFile(
    root,
    "prisma/migrations/20990101000000_fixture/migration.sql",
    migrationSql,
  );
  return root;
}

function writeFixtureFile(root: string, path: string, contents: string) {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}
