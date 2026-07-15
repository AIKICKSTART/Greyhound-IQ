import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  type DesignLabSourceContract,
  fingerprintRepositoryFiles,
  getDesignLabSourceChangesBetween,
  getDesignLabSourcePaths,
  getDesignLabSourcePathsAtCommit,
  getRepositoryHeadSha,
  isRepositoryCommitAncestor,
} from "./design-lab-source-fingerprint";

const root = mkdtempSync(join(tmpdir(), "greyhoundiq-source-fingerprint-"));
try {
  writeFileSync(join(root, "a.ts"), "export const a = 1;\n");
  writeFileSync(join(root, "b.ts"), "export const b = 2;\n");
  const first = fingerprintRepositoryFiles(root, ["a.ts", "b.ts"]);
  const reordered = fingerprintRepositoryFiles(root, ["b.ts", "a.ts"]);
  assert.deepEqual(first, reordered, "file ordering must not change the digest");
  assert.equal(first.fileCount, 2);
  assert.match(first.sha256, /^[a-f0-9]{64}$/);

  writeFileSync(join(root, "b.ts"), "export const b = 3;\n");
  const changed = fingerprintRepositoryFiles(root, ["a.ts", "b.ts"]);
  assert.notEqual(changed.sha256, first.sha256);
  assert.throws(
    () => fingerprintRepositoryFiles(root, ["../outside.ts"]),
    /escapes repository|ENOENT/
  );

  writeFileSync(join(root, "entry.ts"), 'import "./dependency";\n');
  writeFileSync(join(root, "dependency.ts"), "export const dependency = 1;\n");
  writeFileSync(join(root, "fixture.json"), "{}\n");
  writeFileSync(join(root, "schema.prisma"), "model Test { id String @id }\n");
  writeFileSync(join(root, "runtime.ts"), "export const runtime = true;\n");
  writeFileSync(join(root, "unrelated.ts"), "export const unrelated = 1;\n");
  const contract: DesignLabSourceContract = {
    directFiles: ["entry.ts"],
    transitiveImportRoots: ["entry.ts"],
    fixtures: ["fixture.json"],
    schemaFiles: ["schema.prisma"],
    runtimeContractFiles: ["runtime.ts"],
  };
  const scopedPaths = getDesignLabSourcePaths(root, contract);
  assert.deepEqual(scopedPaths, [
    "dependency.ts",
    "entry.ts",
    "fixture.json",
    "runtime.ts",
    "schema.prisma",
  ]);
  const scopedBefore = fingerprintRepositoryFiles(root, scopedPaths);
  writeFileSync(join(root, "unrelated.ts"), "export const unrelated = 2;\n");
  assert.deepEqual(fingerprintRepositoryFiles(root, scopedPaths), scopedBefore);
  writeFileSync(join(root, "dependency.ts"), "export const dependency = 2;\n");
  assert.notEqual(
    fingerprintRepositoryFiles(root, scopedPaths).sha256,
    scopedBefore.sha256,
  );

  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "design-lab-test@greyhoundiq.local"]);
  runGit(root, ["config", "user.name", "Design Lab Test"]);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "prisma", "migrations"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "docker-compose.design-lab-db.yml"), "services: {}\n");
  writeFileSync(join(root, "src", "source.ts"), "export const source = 1;\n");
  writeFileSync(join(root, "src", "runtime.mts"), "export const runtime = true;\n");
  writeFileSync(
    join(root, "prisma", "migrations", "migration_lock.toml"),
    'provider = "postgresql"\n'
  );
  writeFileSync(
    join(root, "prisma", "migrations", "migration.sql"),
    "CREATE TABLE audit_test (id text PRIMARY KEY);\n"
  );
  for (const script of [
    "audit-design-lab-hydrated-wave2-atomic.test.ts",
    "audit-design-lab-hydrated-wave2.ts",
    "audit-design-lab-hydrated-wave2.test.ts",
    "check-database-compatibility-inventory.ts",
    "check-database-compatibility-inventory.test.ts",
    "check-database-migration-replay.ts",
    "check-database-migration-replay.test.ts",
    "check-demo-route-fixture-evidence.test.ts",
    "check-demo-route-fixture-idempotency.ts",
    "check-demo-route-fixture-idempotency.test.ts",
    "check-design-lab-database-parity.ts",
    "check-design-lab-database-parity.test.ts",
    "design-lab-database-parity-catalog.ts",
    "design-lab-database-parity-contract.ts",
    "design-lab-database-parity-evidence.ts",
    "design-lab-database-parity-runtime.ts",
    "design-lab-database-parity-support.ts",
    "demo-route-fixture-contract.ts",
    "design-lab-database.ts",
    "design-lab-database.test.ts",
    "local-database-policy.ts",
    "local-database-policy.test.ts",
    "design-lab-release-evidence.ts",
    "design-lab-release-evidence.test.ts",
    "seed-demo-route-fixtures.ts",
  ]) {
    writeFileSync(join(root, "scripts", script), `// ${script}\n`);
  }
  assert.ok(getDesignLabSourcePaths(root).includes("prisma/migrations/migration_lock.toml"));
  assert.ok(getDesignLabSourcePaths(root).includes("prisma/migrations/migration.sql"));
  assert.ok(getDesignLabSourcePaths(root).includes("docker-compose.design-lab-db.yml"));
  for (const script of [
    "audit-design-lab-hydrated-wave2-atomic.test.ts",
    "audit-design-lab-hydrated-wave2.ts",
    "audit-design-lab-hydrated-wave2.test.ts",
    "check-database-compatibility-inventory.ts",
    "check-database-compatibility-inventory.test.ts",
    "check-database-migration-replay.ts",
    "check-database-migration-replay.test.ts",
    "check-demo-route-fixture-evidence.test.ts",
    "check-demo-route-fixture-idempotency.ts",
    "check-demo-route-fixture-idempotency.test.ts",
    "check-design-lab-database-parity.ts",
    "check-design-lab-database-parity.test.ts",
    "design-lab-database-parity-catalog.ts",
    "design-lab-database-parity-contract.ts",
    "design-lab-database-parity-evidence.ts",
    "design-lab-database-parity-runtime.ts",
    "design-lab-database-parity-support.ts",
    "demo-route-fixture-contract.ts",
    "design-lab-database.ts",
    "design-lab-database.test.ts",
    "local-database-policy.ts",
    "local-database-policy.test.ts",
    "design-lab-release-evidence.ts",
    "design-lab-release-evidence.test.ts",
    "seed-demo-route-fixtures.ts",
  ]) {
    assert.ok(
      getDesignLabSourcePaths(root).includes(`scripts/${script}`),
      `${script} must remain in the source-binding dependency closure`
    );
  }
  runGit(root, [
    "add",
    "a.ts",
    "b.ts",
    "entry.ts",
    "dependency.ts",
    "fixture.json",
    "schema.prisma",
    "runtime.ts",
    "unrelated.ts",
    "docker-compose.design-lab-db.yml",
    "src",
    "prisma",
    "scripts",
  ]);
  runGit(root, ["commit", "-m", "source"]);
  const sourceCommit = getRepositoryHeadSha(root);
  writeFileSync(join(root, "evidence.json"), "{}\n");
  runGit(root, ["add", "evidence.json"]);
  runGit(root, ["commit", "-m", "evidence"]);
  const evidenceCommit = getRepositoryHeadSha(root);
  assert.equal(isRepositoryCommitAncestor(root, sourceCommit, evidenceCommit), true);
  assert.equal(isRepositoryCommitAncestor(root, evidenceCommit, sourceCommit), false);
  assert.equal(isRepositoryCommitAncestor(root, "not-a-commit", evidenceCommit), false);
  assert.deepEqual(
    getDesignLabSourceChangesBetween(root, sourceCommit, evidenceCommit),
    []
  );
  writeFileSync(join(root, "unrelated.ts"), "export const unrelated = 3;\n");
  runGit(root, ["add", "unrelated.ts"]);
  runGit(root, ["commit", "-m", "unrelated change"]);
  const unrelatedCommit = getRepositoryHeadSha(root);
  assert.deepEqual(
    getDesignLabSourceChangesBetween(
      root,
      sourceCommit,
      unrelatedCommit,
      scopedPaths,
    ),
    [],
    "commit movement without scoped dependency changes must remain fresh",
  );
  assert.deepEqual(
    getDesignLabSourcePathsAtCommit(root, evidenceCommit),
    [
      "docker-compose.design-lab-db.yml",
      "prisma/migrations/migration.sql",
      "prisma/migrations/migration_lock.toml",
      "scripts/audit-design-lab-hydrated-wave2-atomic.test.ts",
      "scripts/audit-design-lab-hydrated-wave2.test.ts",
      "scripts/audit-design-lab-hydrated-wave2.ts",
      "scripts/check-database-compatibility-inventory.test.ts",
      "scripts/check-database-compatibility-inventory.ts",
      "scripts/check-database-migration-replay.test.ts",
      "scripts/check-database-migration-replay.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-idempotency.ts",
      "scripts/check-design-lab-database-parity.test.ts",
      "scripts/check-design-lab-database-parity.ts",
      "scripts/demo-route-fixture-contract.ts",
      "scripts/design-lab-database-parity-catalog.ts",
      "scripts/design-lab-database-parity-contract.ts",
      "scripts/design-lab-database-parity-evidence.ts",
      "scripts/design-lab-database-parity-runtime.ts",
      "scripts/design-lab-database-parity-support.ts",
      "scripts/design-lab-database.test.ts",
      "scripts/design-lab-database.ts",
      "scripts/design-lab-release-evidence.test.ts",
      "scripts/design-lab-release-evidence.ts",
      "scripts/local-database-policy.test.ts",
      "scripts/local-database-policy.ts",
      "scripts/seed-demo-route-fixtures.ts",
      "src/runtime.mts",
      "src/source.ts",
    ]
  );

  const tag = runGit(root, ["tag", "-a", "audited", "-m", "annotated audit"]);
  assert.equal(tag.status, 0);
  const tagObject = runGit(root, ["rev-parse", "audited^{tag}"]).stdout.trim();
  assert.equal(isRepositoryCommitAncestor(root, tagObject, evidenceCommit), false);

  writeFileSync(join(root, "src", "source.ts"), "export const source = 2;\n");
  runGit(root, ["add", "src/source.ts"]);
  runGit(root, ["commit", "-m", "source change"]);
  const changedCommit = getRepositoryHeadSha(root);
  assert.deepEqual(
    getDesignLabSourceChangesBetween(root, sourceCommit, changedCommit),
    ["src/source.ts"]
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Design Lab source fingerprint tests passed");

function runGit(cwd: string, args: readonly string[]) {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`
  );
  return result;
}
