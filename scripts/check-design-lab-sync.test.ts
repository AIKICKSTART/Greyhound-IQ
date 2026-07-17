import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { findRepositoryFileIntegrityIssues } from "./check-design-lab-sync";

const syncSource = readFileSync("scripts/check-design-lab-sync.ts", "utf8");
assert.match(syncSource, /DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH/);
assert.match(syncSource, /findDesignLabHydratedWave2AuditIssues/);
assert.match(syncSource, /Hydrated wave 2 audit tested commit/);
assert.match(syncSource, /Hydrated wave 2 audit evidence/);
assert.match(syncSource, /DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH/);
assert.match(syncSource, /findDesignLabResponsiveWorkspaceAuditIssues/);
assert.match(syncSource, /Responsive workspace audit tested commit/);
assert.match(syncSource, /Responsive workspace audit evidence/);

const root = mkdtempSync(join(tmpdir(), "greyhoundiq-sync-integrity-"));
try {
  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "design-lab-test@greyhoundiq.local"]);
  runGit(root, ["config", "user.name", "Design Lab Test"]);
  writeFileSync(join(root, ".gitignore"), "ignored.ts\n");
  writeFileSync(join(root, "source.ts"), "export const source = 1;\n");
  writeFileSync(join(root, "evidence.json"), "{}\n");
  runGit(root, ["add", ".gitignore", "source.ts", "evidence.json"]);
  runGit(root, ["commit", "-m", "baseline"]);

  assert.deepEqual(
    findRepositoryFileIntegrityIssues(root, "Evidence", [
      "source.ts",
      "evidence.json",
    ]),
    []
  );

  runGit(root, ["update-index", "--assume-unchanged", "source.ts"]);
  writeFileSync(join(root, "source.ts"), "export const source = 2;\n");
  assert.ok(
    findRepositoryFileIntegrityIssues(root, "Source", ["source.ts"]).some(
      (issue) => issue.includes("unsafe Git index flags")
    )
  );
  assert.ok(
    findRepositoryFileIntegrityIssues(root, "Source", ["source.ts"]).some(
      (issue) => issue.includes("bytes differ")
    )
  );
  runGit(root, ["update-index", "--no-assume-unchanged", "source.ts"]);
  writeFileSync(join(root, "source.ts"), "export const source = 1;\n");

  runGit(root, ["update-index", "--skip-worktree", "source.ts"]);
  assert.ok(
    findRepositoryFileIntegrityIssues(root, "Source", ["source.ts"]).some(
      (issue) => issue.includes("unsafe Git index flags")
    )
  );
  runGit(root, ["update-index", "--no-skip-worktree", "source.ts"]);

  writeFileSync(join(root, "ignored.ts"), "export const ignored = true;\n");
  assert.ok(
    findRepositoryFileIntegrityIssues(root, "Source", ["ignored.ts"]).some(
      (issue) => issue.includes("untracked")
    )
  );

  try {
    symlinkSync(join(root, "evidence.json"), join(root, "evidence-link.json"));
    assert.ok(
      findRepositoryFileIntegrityIssues(root, "Evidence", [
        "evidence-link.json",
      ]).some((issue) => issue.includes("symbolic links"))
    );
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "EPERM" && code !== "EACCES") throw error;
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Design Lab sync integrity tests passed");

function runGit(cwd: string, args: readonly string[]) {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`
  );
  return result;
}
