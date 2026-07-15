import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  createReleaseEvidenceManifest,
  resolveReleaseEvidenceReferences,
} from "./design-lab-release-evidence";
import { findRepositoryFileIntegrityIssues } from "./check-design-lab-sync";

const root = mkdtempSync(join(tmpdir(), "greyhoundiq-release-evidence-"));
try {
  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "release-evidence@greyhoundiq.local"]);
  runGit(root, ["config", "user.name", "Release Evidence Test"]);
  mkdirSync(join(root, "evidence", "nested"), { recursive: true });
  writeFileSync(join(root, "evidence", "one.txt"), "one\n");
  writeFileSync(join(root, "evidence", "nested", "two.txt"), "two\n");
  writeFileSync(join(root, "evidence", "[literal].txt"), "literal\n");
  runGit(root, ["add", "evidence"]);
  runGit(root, ["commit", "-m", "evidence"]);

  const expected = [
    "evidence/[literal].txt",
    "evidence/nested/two.txt",
    "evidence/one.txt",
  ];
  assert.deepEqual(resolveReleaseEvidenceReferences(root, ["evidence"]), expected);
  assert.deepEqual(
    resolveReleaseEvidenceReferences(root, [
      "evidence/one.txt",
      "evidence/[literal].txt",
      "evidence/nested",
    ]),
    expected
  );
  assert.deepEqual(
    resolveReleaseEvidenceReferences(root, ["evidence/[literal].txt"]),
    ["evidence/[literal].txt"],
    "Git pathspec metacharacters must be treated literally"
  );

  const firstManifest = createReleaseEvidenceManifest(root, expected);
  const reorderedManifest = createReleaseEvidenceManifest(root, [
    ...expected.toReversed(),
    expected[0],
  ]);
  assert.deepEqual(firstManifest, reorderedManifest);
  assert.deepEqual(
    firstManifest.map((entry) => entry.path),
    expected
  );
  firstManifest.forEach((entry) => assert.match(entry.sha256, /^[a-f0-9]{64}$/));

  writeFileSync(join(root, "evidence", "one.txt"), "changed\n");
  const changedManifest = createReleaseEvidenceManifest(root, expected);
  assert.notEqual(changedManifest[2].sha256, firstManifest[2].sha256);
  writeFileSync(join(root, "evidence", "one.txt"), "one\n");

  rmSync(join(root, "evidence", "nested", "two.txt"));
  assert.deepEqual(
    resolveReleaseEvidenceReferences(root, ["evidence"]),
    expected,
    "a committed child missing from the worktree must remain in the integrity inventory"
  );
  assert.ok(
    findRepositoryFileIntegrityIssues(root, "Synthetic evidence", expected).some(
      (issue) =>
        issue.includes("missing") && issue.includes("evidence/nested/two.txt")
    ),
    "the release-ready integrity check must reject the deleted committed child"
  );

  writeFileSync(join(root, "evidence", "untracked.txt"), "untracked\n");
  const inventoryWithUntracked = resolveReleaseEvidenceReferences(root, ["evidence"]);
  assert.ok(inventoryWithUntracked.includes("evidence/untracked.txt"));
  assert.ok(
    findRepositoryFileIntegrityIssues(
      root,
      "Synthetic evidence",
      inventoryWithUntracked
    ).some(
      (issue) =>
        issue.includes("untracked or have unsafe Git index flags") &&
        issue.includes("evidence/untracked.txt")
    ),
    "the release-ready integrity check must reject an untracked directory child"
  );

  mkdirSync(join(root, "empty-evidence"));
  assert.throws(
    () => resolveReleaseEvidenceReferences(root, ["empty-evidence"]),
    /resolves to no regular files/
  );
  assert.throws(
    () => resolveReleaseEvidenceReferences(root, ["../outside"]),
    /missing or escapes/
  );
  assert.throws(
    () => resolveReleaseEvidenceReferences(root, [root]),
    /must be repository-relative/
  );
  assert.throws(
    () => resolveReleaseEvidenceReferences(root, ["."]),
    /must not reference the repository root/
  );

  const linkPath = join(root, "evidence", "linked.txt");
  try {
    symlinkSync(join(root, "evidence", "one.txt"), linkPath, "file");
    assert.throws(
      () => resolveReleaseEvidenceReferences(root, ["evidence"]),
      /must not be a symbolic link/
    );
    assert.throws(
      () => createReleaseEvidenceManifest(root, ["evidence/linked.txt"]),
      /must not be a symbolic link/
    );
  } catch (error) {
    if (!isWindowsSymlinkPermissionError(error)) throw error;
  } finally {
    rmSync(linkPath, { force: true });
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Design Lab release evidence manifest tests passed");

function runGit(cwd: string, args: readonly string[]) {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`
  );
}

function isWindowsSymlinkPermissionError(error: unknown) {
  return (
    process.platform === "win32" &&
    error instanceof Error &&
    "code" in error &&
    ["EPERM", "EACCES", "UNKNOWN"].includes(String(error.code))
  );
}
