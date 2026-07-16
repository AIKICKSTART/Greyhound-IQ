import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  MIGRATION_DATA_LOSS_REVIEW_MASTER_EVIDENCE,
  MIGRATION_DATA_LOSS_REVIEW_REQUIREMENT_ID,
} from "./migration-data-loss-review-evidence";

const repositoryRoot = resolve(import.meta.dirname, "..");
const checkerPath = join(repositoryRoot, "scripts", "check-migrations.ts");
const tsxCliPath = join(repositoryRoot, "node_modules", "tsx", "dist", "cli.mjs");

const current = runMigrationSafetyGate(repositoryRoot);
assert.equal(
  current.status,
  0,
  `current migration history must pass the data-loss review gate:\n${current.output}`,
);
assert.match(current.output, /Migration safety gate passed\./u);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MIGRATION_DATA_LOSS_REVIEW_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable migration data-loss requirement missing");
const evidence =
  MIGRATION_DATA_LOSS_REVIEW_MASTER_EVIDENCE[
    MIGRATION_DATA_LOSS_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(join(repositoryRoot, path)), `missing evidence: ${path}`);
}

const unsafeRoot = createMigrationFixture(`
  DROP TABLE "CustomerArchive";
  ALTER TABLE "Customer" DROP COLUMN "legacyEmail";
  TRUNCATE TABLE "AuditLog";
  DELETE FROM "WebhookEvent";
  DROP TRIGGER IF EXISTS giq_unsafe ON "User";
`);
try {
  const unsafe = runMigrationSafetyGate(unsafeRoot);
  assert.notEqual(unsafe.status, 0, "destructive fixture must fail closed");
  for (const rule of [
    "drop-column",
    "drop-destructive-object",
    "truncate",
    "delete-from",
  ]) {
    assert.match(unsafe.output, new RegExp(`\\b${rule}\\b`, "u"));
  }
} finally {
  rmSync(unsafeRoot, { force: true, recursive: true });
}

const missingSqlRoot = createMigrationFixture();
try {
  const missingSql = runMigrationSafetyGate(missingSqlRoot);
  assert.notEqual(missingSql.status, 0, "missing migration SQL must fail closed");
  assert.match(missingSql.output, /missing-migration-sql/u);
} finally {
  rmSync(missingSqlRoot, { force: true, recursive: true });
}

console.log(
  "Migration data-loss review passed: current history is clean and destructive or missing migration fixtures fail closed.",
);

function createMigrationFixture(source?: string) {
  const root = mkdtempSync(join(tmpdir(), "greyhoundiq-migration-safety-"));
  const migration = join(
    root,
    "prisma",
    "migrations",
    "20990101000000_security_negative_fixture",
  );
  mkdirSync(migration, { recursive: true });
  if (source !== undefined) {
    writeFileSync(join(migration, "migration.sql"), source, "utf8");
  }
  return root;
}

function runMigrationSafetyGate(cwd: string) {
  const result = spawnSync(process.execPath, [tsxCliPath, checkerPath], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(result.error, undefined, "migration safety checker must start");
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}
