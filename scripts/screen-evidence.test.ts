import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  CoverageClaim,
  FamilyScreenManifest,
} from "../src/components/screen-contracts/types";
import {
  assertScreenManifestShape,
  resolveScreenEvidence,
} from "./screen-evidence";

const HEAD_SHA = "a".repeat(40);
const FAMILY = { key: "example", screens: [{ route: "/example" }] } as const;
const root = mkdtempSync(path.join(tmpdir(), "screen-evidence-"));
let readyTestedCommitSha = HEAD_SHA;

try {
  write("src/example.ts", "export const example = true;\n");
  write("tests/example.test.ts", "// screen-evidence-test-id: TEST.example\n");
  writeJson("output/demo-route-audit/latest.json", {
    results: [{ route: "/example", passed: true }],
  });
  const dualAudit = {
    results: [{ route: "/example", passed: true }],
  };
  writeJson("output/demo-route-audit/dual.json", dualAudit);
  const frame = Buffer.alloc(2 * 1024 * 1024 + 17, 0x5a);
  assert.ok(frame.byteLength > 2 * 1024 * 1024);
  writeBuffer("output/orchestration/design-captures/example/frame.png", frame);
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    testedCommitSha: HEAD_SHA,
    frames: [
      {
        id: "frame-1",
        file: "frame.png",
        sha256: sha256(frame),
        captureStatus: "pass",
      },
    ],
  });

  const manifest = makeManifest();
  assert.doesNotThrow(() =>
    assertScreenManifestShape({ families: [FAMILY], manifests: [manifest] })
  );

  const testIdA = clone(manifest);
  testIdA.tests = [{ id: "TEST.collision", path: "tests/a.test.ts" }];
  const testIdB = clone(manifest);
  testIdB.tests = [{ id: "TEST.collision", path: "tests/b.test.ts" }];
  assert.throws(
    () =>
      resolveScreenEvidence({
        manifests: [testIdA, testIdB],
        repoRoot: root,
        testedCommitSha: HEAD_SHA,
      }),
    /Test ID TEST\.collision maps to multiple paths: tests\/a\.test\.ts, tests\/b\.test\.ts/
  );

  const resolved = resolveScreenEvidence({
    manifests: [manifest],
    repoRoot: root,
    testedCommitSha: HEAD_SHA,
  });
  assert.deepEqual(
    resolved[0].evidenceFiles.map((file) => file.path),
    [
      "output/demo-route-audit/latest.json",
      "output/orchestration/design-captures/example/frame.png",
      "output/orchestration/design-captures/example/manifest.json",
      "src/example.ts",
      "tests/example.test.ts",
    ]
  );
  for (const file of resolved[0].evidenceFiles) {
    assert.equal(file.sha256, sha256(readFileSync(path.join(root, file.path))));
  }

  expectShapeFailure([], /missing: \/example/);
  expectShapeFailure([manifest, manifest], /Duplicate screen manifest route/);
  assert.throws(
    () =>
      assertScreenManifestShape({
        families: [
          { key: "example", screens: [{ route: "/example" }, { route: "/example" }] },
        ],
        manifests: [manifest],
      }),
    /Duplicate route in family/
  );

  const missingArea = clone(manifest) as unknown as {
    coverage: Partial<FamilyScreenManifest["coverage"]>;
  };
  delete missingArea.coverage.actions;
  expectShapeFailure(
    [missingArea as unknown as FamilyScreenManifest],
    /every screen-contract area exactly once/
  );

  const emptyVerified = clone(manifest);
  emptyVerified.coverage.permissions = {
    status: "verified",
    evidence: [],
  } as unknown as CoverageClaim;
  expectShapeFailure([emptyVerified], /verified requires evidence/);

  const unsupportedTested = clone(manifest);
  unsupportedTested.coverage.tests = {
    status: "tested",
    evidence: [{ kind: "source", path: "src/example.ts" }],
  };
  expectShapeFailure([unsupportedTested], /tested requires a test or exact-commit/);

  const invalidExclusionArea = clone(manifest);
  invalidExclusionArea.coverage.actions = exclusion();
  expectShapeFailure([invalidExclusionArea], /only forms and onboarding may be excluded/);

  const missingExclusionOwner = clone(manifest);
  missingExclusionOwner.coverage.forms = exclusion("");
  expectShapeFailure([missingExclusionOwner], /exclusion owner is required/);

  const nonEmptyExcludedInventory = clone(manifest);
  nonEmptyExcludedInventory.forms = [
    { id: "form", submitsTo: "/api/example", testIds: [] },
  ];
  nonEmptyExcludedInventory.coverage.forms = exclusion();
  expectShapeFailure([nonEmptyExcludedInventory], /excluded inventory must be empty/);

  const validExclusion = clone(manifest);
  validExclusion.coverage.forms = exclusion();
  assert.doesNotThrow(() =>
    assertScreenManifestShape({ families: [FAMILY], manifests: [validExclusion] })
  );

  const missingFile = clone(manifest);
  missingFile.coverage.permissions = {
    status: "verified",
    evidence: [{ kind: "source", path: "src/missing.ts" }],
  };
  expectResolveFailure(missingFile, /Evidence file does not exist/);

  const unsafeAuditRoot = clone(manifest);
  unsafeAuditRoot.coverage.route = {
    status: "verified",
    evidence: [
      {
        kind: "route-audit",
        path: "output/unsafe-audit.json",
        route: "/example",
      },
    ],
  };
  expectResolveFailure(
    unsafeAuditRoot,
    /route-audit evidence must be under output\/demo-route-audit\//
  );

  const unsafeCaptureRoot = clone(manifest);
  unsafeCaptureRoot.coverage.designLab = {
    status: "tested",
    evidence: [
      {
        kind: "capture-manifest",
        path: "output/captures/manifest.json",
        frameIds: ["frame-1"],
      },
    ],
  };
  expectResolveFailure(
    unsafeCaptureRoot,
    /capture-manifest evidence must be under output\/orchestration\/design-captures\//
  );

  const outside = mkdtempSync(path.join(tmpdir(), "screen-evidence-outside-"));
  const escapePath = path.join(root, "escape");
  try {
    writeFileSync(path.join(outside, "outside.ts"), "export const outside = true;\n");
    try {
      symlinkSync(outside, escapePath, process.platform === "win32" ? "junction" : "dir");
      const escapedEvidence = clone(manifest);
      escapedEvidence.coverage.permissions = {
        status: "verified",
        evidence: [{ kind: "source", path: "escape/outside.ts" }],
      };
      expectResolveFailure(escapedEvidence, /must resolve inside the repository/);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    } finally {
      if (pathExists(escapePath)) unlinkSync(escapePath);
    }
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }

  const missingTestInventory = clone(manifest);
  missingTestInventory.tests = [];
  expectResolveFailure(missingTestInventory, /one exact manifest\.tests entry/);

  write("tests/example.test.ts", "// screen-evidence-test-id: TEST.example-extra\n");
  expectResolveFailure(manifest, /one exact marker declaration/);
  write("tests/example.test.ts", "// screen-evidence-test-id: TEST.example\n");

  writeJson("output/demo-route-audit/latest.json", {
    results: [{ route: "/different", passed: true }],
  });
  expectResolveFailure(manifest, /expected one exact row for \/example/);
  writeJson("output/demo-route-audit/latest.json", {
    results: [{ route: "/example", passed: false }],
  });
  expectResolveFailure(manifest, /route \/example did not pass/);
  writeJson("output/demo-route-audit/latest.json", {
    results: [{ route: "/example", passed: true }],
  });

  const capture = readJson("output/orchestration/design-captures/example/manifest.json");
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    testedCommitSha: "b".repeat(40),
  });
  expectResolveFailure(manifest, /testedCommitSha does not match the requested commit/);
  writeJson("output/orchestration/design-captures/example/manifest.json", capture);
  const captureFrame = (capture.frames as Record<string, unknown>[])[0];
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    frames: [{ ...captureFrame, file: "../../../../unsafe-frame.png" }],
  });
  expectResolveFailure(
    manifest,
    /capture-frame evidence must be under output\/orchestration\/design-captures\//
  );
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    frames: [{ ...captureFrame, accepted: false }],
  });
  expectResolveFailure(manifest, /accepted must be boolean true/);
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    frames: [{ ...captureFrame, accepted: "true" }],
  });
  expectResolveFailure(manifest, /accepted must be boolean true/);
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    frames: [{ ...captureFrame, captureStatus: " pass " }],
  });
  expectResolveFailure(manifest, /frame frame-1 did not pass/);
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    frames: [{ ...captureFrame, captureStatus: true }],
  });
  expectResolveFailure(manifest, /frame frame-1 did not pass/);
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    frames: [{ ...captureFrame, status: "ready" }],
  });
  expectResolveFailure(manifest, /status must equal pass/);
  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...capture,
    frames: [{ ...captureFrame, status: " pass " }],
  });
  expectResolveFailure(manifest, /status must equal pass/);
  writeJson("output/orchestration/design-captures/example/manifest.json", capture);
  writeBuffer("output/orchestration/design-captures/example/frame.png", Buffer.from("tampered"));
  expectResolveFailure(manifest, /sha256 does not match its file/);
  writeBuffer("output/orchestration/design-captures/example/frame.png", frame);

  // Normal validation is deliberately independent of Git readiness state.
  assert.doesNotThrow(() =>
    resolveScreenEvidence({
      manifests: [manifest],
      repoRoot: root,
      testedCommitSha: HEAD_SHA,
    })
  );

  git("init");
  git("config", "user.email", "screen-evidence@example.invalid");
  git("config", "user.name", "Screen Evidence Test");
  git("config", "core.autocrlf", "false");
  git("add", "src", "tests", "output/demo-route-audit/dual.json");
  git("commit", "-m", "tested source");
  readyTestedCommitSha = gitOutput("rev-parse", "HEAD");
  const readyCapture = { ...capture, testedCommitSha: readyTestedCommitSha };
  writeJson("output/orchestration/design-captures/example/manifest.json", readyCapture);
  git("add", "output");
  git("commit", "-m", "generated evidence");

  assert.doesNotThrow(() =>
    resolveScreenEvidence({
      manifests: [manifest],
      repoRoot: root,
      testedCommitSha: readyTestedCommitSha,
      requireTracked: true,
    })
  );

  git("update-index", "--assume-unchanged", "src/example.ts");
  write("src/example.ts", "export const example = false;\n");
  expectResolveFailure(
    manifest,
    /Evidence working bytes do not match the index: src\/example\.ts/,
    true
  );
  write("src/example.ts", "export const example = true;\n");
  git("update-index", "--no-assume-unchanged", "src/example.ts");

  writeJson("output/orchestration/design-captures/example/manifest.json", {
    ...readyCapture,
    dirty: true,
  });
  expectResolveFailure(
    manifest,
    /Required evidence file is dirty: output\/orchestration\/design-captures\/example\/manifest\.json/,
    true
  );
  writeJson("output/orchestration/design-captures/example/manifest.json", readyCapture);

  writeBuffer(
    "output/orchestration/design-captures/example/frame.png",
    Buffer.from("dirty frame")
  );
  expectResolveFailure(
    manifest,
    /Required evidence file is dirty: output\/orchestration\/design-captures\/example\/frame\.png/,
    true
  );
  writeBuffer("output/orchestration/design-captures/example/frame.png", frame);

  writeJson("output/demo-route-audit/untracked.json", {
    results: [{ route: "/example", passed: true }],
  });
  const untrackedAudit = clone(manifest);
  untrackedAudit.coverage.route = {
    status: "verified",
    evidence: [
      {
        kind: "route-audit",
        path: "output/demo-route-audit/untracked.json",
        route: "/example",
      },
    ],
  };
  expectResolveFailure(
    untrackedAudit,
    /Required evidence file is not tracked: output\/demo-route-audit\/untracked\.json/,
    true
  );
  rmSync(path.join(root, "output/demo-route-audit/untracked.json"));

  write("src/example.ts", "export const example = false;\n");
  expectResolveFailure(manifest, /Required evidence file is dirty/, true);
  write("src/example.ts", "export const example = true;\n");

  write("tests/untracked.test.ts", "// screen-evidence-test-id: TEST.untracked\n");
  const untracked = clone(manifest);
  untracked.tests = [{ id: "TEST.untracked", path: "tests/untracked.test.ts" }];
  untracked.coverage.tests = {
    status: "tested",
    evidence: [
      { kind: "test", path: "tests/untracked.test.ts", testId: "TEST.untracked" },
    ],
  };
  expectResolveFailure(untracked, /Required evidence file is not tracked/, true);
  rmSync(path.join(root, "tests/untracked.test.ts"));

  const unrelatedCommit = gitOutput(
    "commit-tree",
    gitOutput("write-tree"),
    "-m",
    "unrelated"
  );
  assert.throws(
    () =>
      resolveScreenEvidence({
        manifests: [manifest],
        repoRoot: root,
        testedCommitSha: unrelatedCommit,
        requireTracked: true,
      }),
    /testedCommitSha must be an ancestor/
  );

  writeJson("output/demo-route-audit/dual.json", {
    ...dualAudit,
    regenerated: true,
  });
  git("add", "output/demo-route-audit/dual.json");
  git("commit", "-m", "overlapping generated evidence");
  const overlappingRoles = clone(manifest);
  overlappingRoles.coverage.route = {
    status: "verified",
    evidence: [
      {
        kind: "route-audit",
        path: "output/demo-route-audit/dual.json",
        route: "/example",
      },
    ],
  };
  overlappingRoles.coverage.permissions = {
    status: "verified",
    evidence: [
      { kind: "source", path: "output/demo-route-audit/dual.json" },
    ],
  };
  expectResolveFailure(
    overlappingRoles,
    /Immutable evidence differs from testedCommitSha: output\/demo-route-audit\/dual\.json/,
    true
  );
  writeJson("output/demo-route-audit/dual.json", dualAudit);
  git("add", "output/demo-route-audit/dual.json");
  git("commit", "-m", "restore overlapping evidence");

  write("src/example.ts", "export const example = false;\n");
  git("add", "src/example.ts");
  git("commit", "-m", "source drift");
  expectResolveFailure(
    manifest,
    /Immutable evidence differs from testedCommitSha: src\/example\.ts/,
    true
  );

  write("src/example.ts", "export const example = true;\n");
  git("add", "src/example.ts");
  git("commit", "-m", "restore source");
  write(
    "tests/example.test.ts",
    "// screen-evidence-test-id: TEST.example\n// changed test\n"
  );
  git("add", "tests/example.test.ts");
  git("commit", "-m", "test drift");
  expectResolveFailure(
    manifest,
    /Immutable evidence differs from testedCommitSha: tests\/example\.test\.ts/,
    true
  );

  console.log("screen evidence tests passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}

function makeManifest(): FamilyScreenManifest {
  return {
    route: "/example",
    userStories: [{ id: "story", actor: "reviewer", outcome: "reviews evidence" }],
    actions: [],
    forms: [],
    permissions: [],
    states: [],
    designLab: [{ fixtureId: "frame-1", href: "/example" }],
    onboarding: [],
    tests: [{ id: "TEST.example", path: "tests/example.test.ts" }],
    coverage: {
      route: {
        status: "verified",
        evidence: [
          {
            kind: "route-audit",
            path: "output/demo-route-audit/latest.json",
            route: "/example",
          },
        ],
      },
      userStories: {
        status: "captured",
        evidence: [{ kind: "source", path: "src/example.ts" }],
      },
      actions: { status: "captured", evidence: [] },
      forms: { status: "captured", evidence: [] },
      permissions: {
        status: "verified",
        evidence: [{ kind: "source", path: "src/example.ts" }],
      },
      states: { status: "captured", evidence: [] },
      designLab: {
        status: "tested",
        evidence: [
          {
            kind: "capture-manifest",
            path: "output/orchestration/design-captures/example/manifest.json",
            frameIds: ["frame-1"],
          },
        ],
      },
      onboarding: { status: "captured", evidence: [] },
      tests: {
        status: "tested",
        evidence: [
          { kind: "test", path: "tests/example.test.ts", testId: "TEST.example" },
        ],
      },
    },
  };
}

function exclusion(owner = "product-owner"): CoverageClaim {
  return {
    status: "excluded",
    exclusion: {
      kind: "not-applicable",
      owner,
      rationale: "This screen owns no form inventory.",
    },
    evidence: [{ kind: "source", path: "src/example.ts" }],
  };
}

function expectShapeFailure(
  manifests: readonly FamilyScreenManifest[],
  pattern: RegExp
) {
  assert.throws(
    () => assertScreenManifestShape({ families: [FAMILY], manifests }),
    pattern
  );
}

function expectResolveFailure(
  manifest: FamilyScreenManifest,
  pattern: RegExp,
  requireTracked = false
) {
  assert.throws(
    () =>
      resolveScreenEvidence({
        manifests: [manifest],
        repoRoot: root,
        testedCommitSha: requireTracked ? readyTestedCommitSha : HEAD_SHA,
        requireTracked,
      }),
    pattern
  );
}

function write(relativePath: string, value: string) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function writeBuffer(relativePath: string, value: Buffer) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function writeJson(relativePath: string, value: unknown) {
  write(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as Record<
    string,
    unknown
  >;
}

function git(...args: string[]) {
  gitOutput(...args);
}

function gitOutput(...args: string[]) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function pathExists(filePath: string) {
  try {
    readFileSync(filePath);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EISDIR";
  }
}
