import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import {
  SCREEN_CONTRACT_COVERAGE_AREAS,
  type ScreenContractCoverageArea,
} from "../src/components/demo-experience-registry";
import type {
  CoverageClaim,
  EvidenceRef,
  FamilyScreenManifest,
} from "../src/components/screen-contracts/types";

type ScreenFamily = {
  key: string;
  screens: readonly { route: string }[];
};

export type ResolvedEvidenceFile = {
  path: string;
  sha256: string;
};

export type ResolvedFamilyScreenManifest = FamilyScreenManifest & {
  evidenceFiles: readonly ResolvedEvidenceFile[];
};

export const SCREEN_EVIDENCE_TEST_ID_MARKER = "// screen-evidence-test-id:";

const ROUTE_AUDIT_OUTPUT_ROOT = "output/demo-route-audit/";
const CAPTURE_OUTPUT_ROOT = "output/orchestration/design-captures/";

export function assertScreenManifestShape({
  families,
  manifests,
}: {
  families: readonly ScreenFamily[];
  manifests: readonly FamilyScreenManifest[];
}) {
  assertUniqueTestIds(manifests);
  const familyKeys = new Set<string>();
  const expectedRoutes = new Map<string, string>();

  for (const family of families) {
    assertNonEmpty(family.key, "Family key");
    assert(!familyKeys.has(family.key), `Duplicate family key: ${family.key}`);
    familyKeys.add(family.key);

    const familyRoutes = new Set<string>();
    for (const screen of family.screens) {
      assertNonEmpty(screen.route, `Route in family ${family.key}`);
      assert(
        !familyRoutes.has(screen.route),
        `Duplicate route in family ${family.key}: ${screen.route}`
      );
      assert(
        !expectedRoutes.has(screen.route),
        `Route belongs to more than one family: ${screen.route}`
      );
      familyRoutes.add(screen.route);
      expectedRoutes.set(screen.route, family.key);
    }
  }

  const manifestRoutes = new Set<string>();
  for (const manifest of manifests) {
    assertNonEmpty(manifest.route, "Manifest route");
    assert(
      !manifestRoutes.has(manifest.route),
      `Duplicate screen manifest route: ${manifest.route}`
    );
    manifestRoutes.add(manifest.route);
    assertManifestCoverage(manifest);
  }

  const missing = [...expectedRoutes.keys()].filter(
    (route) => !manifestRoutes.has(route)
  );
  const unexpected = [...manifestRoutes].filter(
    (route) => !expectedRoutes.has(route)
  );
  assert(
    missing.length === 0 && unexpected.length === 0,
    `Screen manifest routes do not match family routes (missing: ${
      missing.join(", ") || "none"
    }; unexpected: ${unexpected.join(", ") || "none"}).`
  );
}

export function resolveScreenEvidence({
  manifests,
  repoRoot,
  testedCommitSha,
  requireTracked = false,
}: {
  manifests: readonly FamilyScreenManifest[];
  repoRoot: string;
  testedCommitSha: string;
  requireTracked?: boolean;
}): readonly ResolvedFamilyScreenManifest[] {
  assert(
    /^[0-9a-f]{40}$/i.test(testedCommitSha),
    "testedCommitSha must be a 40-character commit SHA."
  );
  const root = realpathSync(path.resolve(repoRoot));
  if (requireTracked) assertTestedCommitIsAncestor(root, testedCommitSha);
  assertUniqueTestIds(manifests);
  for (const manifest of manifests) assertManifestCoverage(manifest);

  const immutableEvidenceFiles = new Set(
    manifests.flatMap((manifest) =>
      evidenceRefs(manifest)
        .filter((ref) => ref.kind === "source" || ref.kind === "test")
        .map((ref) =>
          evidenceIdentity(toRepoPath(root, resolveRepoFile(root, ref.path)))
        )
    )
  );
  const generatedEvidenceFiles = new Set<string>();

  const resolved = manifests.map((manifest) => {
    const evidenceFiles = new Map<string, string>();

    for (const ref of evidenceRefs(manifest)) {
      const evidencePath = resolveRepoFile(root, ref.path);
      const repoPath = toRepoPath(root, evidencePath);
      if (ref.kind === "route-audit") {
        assertGeneratedRoot(ref.kind, repoPath);
      } else if (ref.kind === "capture-manifest") {
        assertGeneratedRoot(ref.kind, repoPath);
      }
      addEvidenceFile(
        root,
        evidencePath,
        evidenceFiles,
        requireTracked,
        immutableEvidenceFiles.has(evidenceIdentity(repoPath))
          ? testedCommitSha
          : undefined
      );

      if (ref.kind === "source" || ref.kind === "test") {
        if (ref.kind === "test") assertTestId(ref, manifest, evidencePath);
      } else if (ref.kind === "route-audit") {
        addGeneratedRole(repoPath, immutableEvidenceFiles, generatedEvidenceFiles);
        assertRouteAudit(ref, manifest.route, evidencePath);
      } else if (ref.kind === "capture-manifest") {
        addGeneratedRole(repoPath, immutableEvidenceFiles, generatedEvidenceFiles);
        resolveCaptureEvidence({
          ref,
          evidencePath,
          evidenceFiles,
          generatedEvidenceFiles,
          immutableEvidenceFiles,
          repoRoot: root,
          requireTracked,
          testedCommitSha,
        });
      }
    }

    return {
      ...manifest,
      evidenceFiles: [...evidenceFiles]
        .map(([filePath, sha256]) => ({ path: filePath, sha256 }))
        .sort((left, right) => left.path.localeCompare(right.path)),
    };
  });

  if (requireTracked) {
    assertOnlyGeneratedEvidenceChanged(root, testedCommitSha, generatedEvidenceFiles);
  }
  return resolved;
}

function assertUniqueTestIds(manifests: readonly FamilyScreenManifest[]) {
  const pathsById = new Map<string, string>();
  for (const manifest of manifests) {
    for (const test of manifest.tests) {
      assertNonEmpty(test.id, `${manifest.route}: test inventory ID`);
      assertNonEmpty(test.path, `${manifest.route}: test inventory path`);
      const normalizedPath = evidenceIdentity(
        path.posix.normalize(test.path.replaceAll("\\", "/"))
      );
      const existingPath = pathsById.get(test.id);
      assert(
        existingPath === undefined || existingPath === normalizedPath,
        `Test ID ${test.id} maps to multiple paths: ${existingPath}, ${normalizedPath}`
      );
      pathsById.set(test.id, normalizedPath);
    }
  }
}

function addGeneratedRole(
  filePath: string,
  immutableEvidenceFiles: ReadonlySet<string>,
  generatedEvidenceFiles: Set<string>
) {
  const identity = evidenceIdentity(filePath);
  if (!immutableEvidenceFiles.has(identity)) generatedEvidenceFiles.add(identity);
}

function assertGeneratedRoot(
  kind: "route-audit" | "capture-manifest" | "capture-frame",
  filePath: string
) {
  const requiredRoot = kind === "route-audit" ? ROUTE_AUDIT_OUTPUT_ROOT : CAPTURE_OUTPUT_ROOT;
  assert(
    filePath.startsWith(requiredRoot),
    `${kind} evidence must be under ${requiredRoot}: ${filePath}`
  );
}

function assertTestId(
  ref: Extract<EvidenceRef, { kind: "test" }>,
  manifest: FamilyScreenManifest,
  evidencePath: string
) {
  const inventoryMatches = manifest.tests.filter(
    (test) => test.id === ref.testId && test.path === ref.path
  );
  assert(
    inventoryMatches.length === 1,
    `${ref.path}: testId ${ref.testId} must have one exact manifest.tests entry.`
  );
  const marker = `${SCREEN_EVIDENCE_TEST_ID_MARKER} ${ref.testId}`;
  const declarations = readFileSync(evidencePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() === marker);
  assert(
    declarations.length === 1,
    `${ref.path}: testId ${ref.testId} must have one exact marker declaration.`
  );
}

function assertManifestCoverage(manifest: FamilyScreenManifest) {
  const coverage = manifest.coverage as
    | Partial<Record<ScreenContractCoverageArea, CoverageClaim>>
    | undefined;
  assert(coverage && typeof coverage === "object", `${manifest.route}: coverage is required.`);

  const keys = Object.keys(coverage).sort();
  const expectedKeys = [...SCREEN_CONTRACT_COVERAGE_AREAS].sort();
  assert(
    JSON.stringify(keys) === JSON.stringify(expectedKeys),
    `${manifest.route}: coverage must contain every screen-contract area exactly once.`
  );

  for (const area of SCREEN_CONTRACT_COVERAGE_AREAS) {
    const claim = coverage[area];
    assert(claim && typeof claim === "object", `${manifest.route}/${area}: claim is required.`);
    assert(Array.isArray(claim.evidence), `${manifest.route}/${area}: evidence must be an array.`);
    for (const ref of claim.evidence) assertEvidenceRef(ref, manifest.route, area);

    if (claim.status === "verified" || claim.status === "tested") {
      assert(
        claim.evidence.length > 0,
        `${manifest.route}/${area}: ${claim.status} requires evidence.`
      );
    }
    if (claim.status === "tested") {
      assert(
        claim.evidence.some(
          (ref) => ref.kind === "test" || ref.kind === "capture-manifest"
        ),
        `${manifest.route}/${area}: tested requires a test or exact-commit capture manifest.`
      );
    }
    if (claim.status === "blocked") {
      assertNonEmpty(claim.blocker?.owner, `${manifest.route}/${area}: blocker owner`);
      assertNonEmpty(claim.blocker?.reason, `${manifest.route}/${area}: blocker reason`);
    }
    if (claim.status === "excluded") {
      assert(
        area === "forms" || area === "onboarding",
        `${manifest.route}/${area}: only forms and onboarding may be excluded.`
      );
      assert(
        claim.exclusion?.kind === "not-applicable",
        `${manifest.route}/${area}: exclusion must be not-applicable.`
      );
      assertNonEmpty(claim.exclusion?.owner, `${manifest.route}/${area}: exclusion owner`);
      assertNonEmpty(
        claim.exclusion?.rationale,
        `${manifest.route}/${area}: exclusion rationale`
      );
      assert(
        claim.evidence.length > 0,
        `${manifest.route}/${area}: exclusion requires evidence.`
      );
      assert(
        manifest[area].length === 0,
        `${manifest.route}/${area}: excluded inventory must be empty.`
      );
    }
    assert(
      ["not-started", "captured", "verified", "tested", "blocked", "excluded"].includes(
        claim.status
      ),
      `${manifest.route}/${area}: unsupported coverage status.`
    );
  }
}

function assertEvidenceRef(
  ref: EvidenceRef,
  manifestRoute: string,
  area: ScreenContractCoverageArea
) {
  assert(ref && typeof ref === "object", `${manifestRoute}/${area}: invalid evidence.`);
  assertNonEmpty(ref.path, `${manifestRoute}/${area}: evidence path`);

  if (ref.kind === "test") {
    assertNonEmpty(ref.testId, `${manifestRoute}/${area}: testId`);
    assert(
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(ref.testId),
      `${manifestRoute}/${area}: testId has unsupported characters.`
    );
  } else if (ref.kind === "route-audit") {
    assert(
      ref.route === manifestRoute,
      `${manifestRoute}/${area}: route-audit evidence must name the exact manifest route.`
    );
  } else if (ref.kind === "capture-manifest") {
    assert(
      Array.isArray(ref.frameIds) && ref.frameIds.length > 0,
      `${manifestRoute}/${area}: capture evidence requires frame IDs.`
    );
    assert(
      new Set(ref.frameIds).size === ref.frameIds.length,
      `${manifestRoute}/${area}: capture frame IDs must be unique.`
    );
    for (const frameId of ref.frameIds) {
      assertNonEmpty(frameId, `${manifestRoute}/${area}: frame ID`);
    }
  } else {
    assert(ref.kind === "source", `${manifestRoute}/${area}: unsupported evidence kind.`);
  }
}

function evidenceRefs(manifest: FamilyScreenManifest) {
  return SCREEN_CONTRACT_COVERAGE_AREAS.flatMap(
    (area) => manifest.coverage[area].evidence
  );
}

function assertRouteAudit(
  ref: Extract<EvidenceRef, { kind: "route-audit" }>,
  manifestRoute: string,
  evidencePath: string
) {
  assert(ref.route === manifestRoute, `${manifestRoute}: route-audit route mismatch.`);
  const report = readJsonObject(evidencePath);
  assert(Array.isArray(report.results), `${ref.path}: route audit results are missing.`);
  const rows = report.results.filter(
    (row) => isObject(row) && row.route === ref.route
  );
  assert(rows.length === 1, `${ref.path}: expected one exact row for ${ref.route}.`);
  assert(rows[0].passed === true, `${ref.path}: route ${ref.route} did not pass.`);
}

function resolveCaptureEvidence({
  ref,
  evidencePath,
  evidenceFiles,
  generatedEvidenceFiles,
  immutableEvidenceFiles,
  repoRoot,
  requireTracked,
  testedCommitSha,
}: {
  ref: Extract<EvidenceRef, { kind: "capture-manifest" }>;
  evidencePath: string;
  evidenceFiles: Map<string, string>;
  generatedEvidenceFiles: Set<string>;
  immutableEvidenceFiles: ReadonlySet<string>;
  repoRoot: string;
  requireTracked: boolean;
  testedCommitSha: string;
}) {
  const capture = readJsonObject(evidencePath);
  assert(
    typeof capture.testedCommitSha === "string" &&
      /^[0-9a-f]{40}$/i.test(capture.testedCommitSha),
    `${ref.path}: capture manifest must declare a 40-character testedCommitSha.`
  );
  assert(
    capture.testedCommitSha.toLowerCase() === testedCommitSha.toLowerCase(),
    `${ref.path}: capture testedCommitSha does not match the requested commit.`
  );
  assert(Array.isArray(capture.frames), `${ref.path}: capture frames are missing.`);

  for (const frameId of ref.frameIds) {
    const frames = capture.frames.filter(
      (frame) => isObject(frame) && frame.id === frameId
    );
    assert(frames.length === 1, `${ref.path}: expected one frame ${frameId}.`);
    const frame = frames[0];
    assert(
      frame.captureStatus === "pass",
      `${ref.path}: frame ${frameId} did not pass.`
    );
    assert(
      !("accepted" in frame) || frame.accepted === true,
      `${ref.path}: frame ${frameId} accepted must be boolean true when present.`
    );
    assert(
      !("status" in frame) || frame.status === "pass",
      `${ref.path}: frame ${frameId} status must equal pass when present.`
    );
    assertNonEmpty(
      typeof frame.file === "string" ? frame.file : undefined,
      `${ref.path}: frame ${frameId} file`
    );
    assert(
      typeof frame.sha256 === "string" && /^[0-9a-f]{64}$/i.test(frame.sha256),
      `${ref.path}: frame ${frameId} must declare sha256.`
    );

    const framePath = path.resolve(path.dirname(evidencePath), frame.file);
    const frameRepoPath = toRepoPath(repoRoot, framePath);
    assertGeneratedRoot("capture-frame", frameRepoPath);
    addEvidenceFile(
      repoRoot,
      framePath,
      evidenceFiles,
      requireTracked,
      immutableEvidenceFiles.has(evidenceIdentity(frameRepoPath))
        ? testedCommitSha
        : undefined
    );
    addGeneratedRole(frameRepoPath, immutableEvidenceFiles, generatedEvidenceFiles);
    const actualHash = evidenceFiles.get(frameRepoPath);
    assert(
      actualHash === frame.sha256.toLowerCase(),
      `${ref.path}: frame ${frameId} sha256 does not match its file.`
    );
  }
}

function addEvidenceFile(
  repoRoot: string,
  absolutePath: string,
  evidenceFiles: Map<string, string>,
  requireTracked: boolean,
  testedCommitSha?: string
) {
  const repoPath = toRepoPath(repoRoot, absolutePath);
  assertFile(repoRoot, absolutePath, repoPath);
  if (!evidenceFiles.has(repoPath)) {
    if (requireTracked) {
      assertTrackedAndClean(repoRoot, [repoPath], testedCommitSha);
    }
    evidenceFiles.set(repoPath, sha256(readFileSync(absolutePath)));
  }
}

function resolveRepoFile(repoRoot: string, filePath: string) {
  assert(!path.isAbsolute(filePath), `Evidence path must be repository-relative: ${filePath}`);
  const absolutePath = path.resolve(repoRoot, filePath);
  toRepoPath(repoRoot, absolutePath);
  return absolutePath;
}

function toRepoPath(repoRoot: string, absolutePath: string) {
  const relative = path.relative(repoRoot, absolutePath);
  assert(
    relative !== "" &&
      !path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`),
    `Evidence file must be inside the repository: ${absolutePath}`
  );
  return relative.replaceAll(path.sep, "/");
}

function assertFile(repoRoot: string, absolutePath: string, displayPath: string) {
  let stats;
  try {
    stats = statSync(absolutePath);
  } catch {
    throw new Error(`Evidence file does not exist: ${displayPath}`);
  }
  assert(stats.isFile(), `Evidence path is not a file: ${displayPath}`);
  const realPath = realpathSync(absolutePath);
  const relativeRealPath = path.relative(repoRoot, realPath);
  assert(
    relativeRealPath !== "" &&
      !path.isAbsolute(relativeRealPath) &&
      relativeRealPath !== ".." &&
      !relativeRealPath.startsWith(`..${path.sep}`),
    `Evidence file must resolve inside the repository: ${displayPath}`
  );
  assert(
    samePath(realPath, absolutePath),
    `Evidence path may not traverse a symlink or junction: ${displayPath}`
  );
}

function assertTrackedAndClean(
  repoRoot: string,
  filePaths: readonly string[],
  testedCommitSha?: string
) {
  for (const filePath of filePaths) {
    const tracked = runGit(repoRoot, ["ls-files", "--error-unmatch", "--", filePath]);
    assert(tracked.status === 0, `Required evidence file is not tracked: ${filePath}`);
    const dirty = runGit(repoRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--",
      filePath,
    ]);
    assert(dirty.status === 0, `Unable to inspect evidence file status: ${filePath}`);
    assert(dirty.stdout.trim() === "", `Required evidence file is dirty: ${filePath}`);

    const working = runGit(repoRoot, [
      "hash-object",
      "--no-filters",
      "--",
      filePath,
    ]);
    const index = runGit(repoRoot, ["rev-parse", "--verify", `:${filePath}`]);
    const head = runGit(repoRoot, ["rev-parse", "--verify", `HEAD:${filePath}`]);
    assert(
      working.status === 0 && index.status === 0 && head.status === 0,
      `Unable to compare evidence blobs: ${filePath}`
    );
    assert(
      working.stdout.trim() === index.stdout.trim(),
      `Evidence working bytes do not match the index: ${filePath}`
    );
    assert(
      index.stdout.trim() === head.stdout.trim(),
      `Evidence index blob does not match HEAD: ${filePath}`
    );

    if (testedCommitSha) {
      const tested = runGit(repoRoot, [
        "rev-parse",
        "--verify",
        `${testedCommitSha}:${filePath}`,
      ]);
      assert(
        tested.status === 0 && tested.stdout.trim() === head.stdout.trim(),
        `Immutable evidence differs from testedCommitSha: ${filePath}`
      );
    }
  }
}

function assertTestedCommitIsAncestor(repoRoot: string, testedCommitSha: string) {
  const head = runGit(repoRoot, ["rev-parse", "HEAD"]);
  assert(head.status === 0, "Unable to resolve repository HEAD for ready evidence.");
  const ancestor = runGit(repoRoot, [
    "merge-base",
    "--is-ancestor",
    testedCommitSha,
    head.stdout.trim(),
  ]);
  assert(
    ancestor.status === 0,
    "testedCommitSha must be an ancestor of repository HEAD."
  );
}

function assertOnlyGeneratedEvidenceChanged(
  repoRoot: string,
  testedCommitSha: string,
  generatedEvidenceFiles: ReadonlySet<string>
) {
  const changed = runGit(repoRoot, [
    "diff",
    "--no-renames",
    "--name-only",
    "-z",
    `${testedCommitSha}..HEAD`,
    "--",
  ]);
  assert(changed.status === 0, "Unable to inspect changes since testedCommitSha.");
  const disallowed = changed.stdout
    .split("\0")
    .filter(Boolean)
    .filter(
      (filePath) =>
        !generatedEvidenceFiles.has(
          evidenceIdentity(filePath.replaceAll("\\", "/"))
        )
    );
  assert(
    disallowed.length === 0,
    `Only generated evidence may change after testedCommitSha: ${disallowed.join(", ")}`
  );
}

function samePath(left: string, right: string) {
  const normalize = (value: string) => {
    const normalized = path.normalize(value);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  return normalize(left) === normalize(right);
}

function evidenceIdentity(filePath: string) {
  return process.platform === "win32" ? filePath.toLowerCase() : filePath;
}

function runGit(repoRoot: string, args: readonly string[]) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, stdout: result.stdout ?? "" };
}

function readJsonObject(filePath: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    assert(isObject(value), `${filePath}: expected a JSON object.`);
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${filePath}: invalid JSON.`);
    throw error;
  }
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  assert(typeof value === "string" && value.trim().length > 0, `${label} is required.`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
