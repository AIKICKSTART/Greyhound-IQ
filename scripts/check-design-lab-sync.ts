import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { createHash } from "node:crypto";
import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import {
  DESIGN_LAB_DELIVERY_PROGRESS,
} from "../src/components/design-lab-delivery-progress";
import {
  DESIGN_LAB_SYNC_SNAPSHOT,
  findDesignLabRegistrySyncIssues,
  findDesignLabRouteAuditSyncIssues,
} from "../src/components/design-lab-sync";
import { evaluateDemoRouteAuditEvidence } from "../src/components/demo-route-audit-evidence";
import { DEMO_ROUTE_AUDIT_EXPECTED_ROWS } from "../src/components/demo-experience-registry";
import {
  getDesignLabSourceFingerprint,
  getDesignLabSourceChangesBetween,
  getDesignLabSourcePaths,
  getDesignLabSourcePathsAtCommit,
  getRepositoryHeadSha,
  isRepositoryCommitAncestor,
} from "./design-lab-source-fingerprint";
import {
  DESIGN_LAB_STORY_AUDIT_PATH,
  findDesignLabStoryAuditIssues,
} from "./audit-design-lab-user-stories";
import {
  DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH,
  findDesignLabHydratedStoryAuditIssues,
} from "./audit-design-lab-hydrated-stories";
import {
  DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH,
  findDesignLabHydratedWave2AuditIssues,
} from "./audit-design-lab-hydrated-wave2";
import {
  DESIGN_LAB_RESPONSIVE_ARCHITECTURE_BUILD_PATH,
  DESIGN_LAB_RESPONSIVE_ARCHITECTURE_REPORT_PATH,
  DESIGN_LAB_RESPONSIVE_ARCHITECTURE_SOURCE_PATH,
  DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH,
  findDesignLabResponsiveWorkspaceAuditIssues,
} from "./audit-design-lab-responsive-workspace";

const ROUTE_AUDIT_PATH = "output/demo-route-audit/latest.json";
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_ROUTE_AUDIT_AGE_MS = 24 * 60 * 60_000;

export function collectDesignLabSyncIssues({
  repoRoot,
  now = Date.now(),
  requireReleaseReadyEvidence = false,
}: {
  repoRoot: string;
  now?: number;
  requireReleaseReadyEvidence?: boolean;
}) {
  const issues = [...findDesignLabRegistrySyncIssues()];
  const canonicalRoot = realpathSync(repoRoot);

  for (const item of DESIGN_LAB_DELIVERY_PROGRESS) {
    const updatedAt = Date.parse(item.updatedAt);
    if (!ISO_TIMESTAMP.test(item.updatedAt) || !Number.isFinite(updatedAt)) {
      issues.push(`${item.id} updatedAt is not a canonical ISO timestamp.`);
    } else if (updatedAt > now + 5 * 60_000) {
      issues.push(`${item.id} updatedAt is in the future.`);
    }

    for (const evidencePath of item.evidence) {
      if (isAbsolute(evidencePath)) {
        issues.push(`${item.id} evidence must be repository-relative: ${evidencePath}`);
        continue;
      }
      const resolvedPath = resolve(canonicalRoot, evidencePath);
      if (!isInside(canonicalRoot, resolvedPath)) {
        issues.push(`${item.id} evidence escapes the repository: ${evidencePath}`);
        continue;
      }
      if (!existsSync(resolvedPath)) {
        issues.push(`${item.id} evidence does not exist: ${evidencePath}`);
        continue;
      }
      const canonicalEvidence = realpathSync(resolvedPath);
      if (!isInside(canonicalRoot, canonicalEvidence)) {
        issues.push(
          `${item.id} evidence resolves outside the repository: ${evidencePath}`
        );
      }
    }
  }

  const auditPath = resolve(canonicalRoot, ROUTE_AUDIT_PATH);
  if (!existsSync(auditPath)) {
    issues.push(`Exact-route audit evidence is missing: ${ROUTE_AUDIT_PATH}`);
    return issues;
  }

  let rawAudit: unknown;
  try {
    rawAudit = JSON.parse(readFileSync(auditPath, "utf8"));
  } catch (error) {
    issues.push(
      `Exact-route audit is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    return issues;
  }
  const routeEvaluation = evaluateDemoRouteAuditEvidence(
    rawAudit,
    DEMO_ROUTE_AUDIT_EXPECTED_ROWS
  );
  const generatedAt = routeEvaluation.generatedAt
    ? Date.parse(routeEvaluation.generatedAt)
    : Number.NaN;
  if (Number.isFinite(generatedAt) && generatedAt > now + 5 * 60_000) {
    issues.push("Route audit generatedAt is in the future.");
  } else if (Number.isFinite(generatedAt) && now - generatedAt > MAX_ROUTE_AUDIT_AGE_MS) {
    issues.push("Route audit evidence is older than 24 hours.");
  }
  issues.push(...findDesignLabRouteAuditSyncIssues(rawAudit));

  const currentHeadSha = getRepositoryHeadSha(canonicalRoot);
  const currentSource = getDesignLabSourceFingerprint(canonicalRoot);
  if (
    !routeEvaluation.testedCommitSha ||
    !isRepositoryCommitAncestor(
      canonicalRoot,
      routeEvaluation.testedCommitSha,
      currentHeadSha
    )
  ) {
    issues.push("Route audit tested commit is not an ancestor of the current Git HEAD.");
  } else {
    issues.push(
      ...findAuditedSourceCommitIssues(
        canonicalRoot,
        "Route audit",
        routeEvaluation.testedCommitSha,
        currentHeadSha
      )
    );
  }
  if (routeEvaluation.sourceSha256 !== currentSource.sha256) {
    issues.push("Route audit source digest does not match the current source tree.");
  }
  if (routeEvaluation.sourceFileCount !== currentSource.fileCount) {
    issues.push("Route audit source-file count does not match the current source tree.");
  }

  const responsiveAuditPath = resolve(
    canonicalRoot,
    DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH
  );
  if (!existsSync(responsiveAuditPath)) {
    issues.push(
      `Responsive workspace audit evidence is missing: ${DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH}`
    );
  } else {
    try {
      const responsiveAudit = JSON.parse(
        readFileSync(responsiveAuditPath, "utf8")
      );
      const responsiveTestedCommitSha = readTestedCommitSha(responsiveAudit);
      issues.push(
        ...findDesignLabResponsiveWorkspaceAuditIssues(responsiveAudit, {
          headSha: responsiveTestedCommitSha ?? currentHeadSha,
          sourceSha256: currentSource.sha256,
          sourceFileCount: currentSource.fileCount,
          auditScriptSha256: sha256File(
            resolve(canonicalRoot, "scripts/audit-design-lab-responsive-workspace.ts")
          ),
          architectureReportSha256: sha256File(
            resolve(
              canonicalRoot,
              DESIGN_LAB_RESPONSIVE_ARCHITECTURE_REPORT_PATH
            )
          ),
          architectureSourceSha256: sha256File(
            resolve(
              canonicalRoot,
              DESIGN_LAB_RESPONSIVE_ARCHITECTURE_SOURCE_PATH
            )
          ),
          architectureBuildSha256: sha256File(
            resolve(
              canonicalRoot,
              DESIGN_LAB_RESPONSIVE_ARCHITECTURE_BUILD_PATH
            )
          ),
          now,
        })
      );
      if (
        !responsiveTestedCommitSha ||
        !isRepositoryCommitAncestor(
          canonicalRoot,
          responsiveTestedCommitSha,
          currentHeadSha
        )
      ) {
        issues.push(
          "Responsive workspace audit tested commit is not an ancestor of the current Git HEAD."
        );
      } else {
        issues.push(
          ...findAuditedSourceCommitIssues(
            canonicalRoot,
            "Responsive workspace audit",
            responsiveTestedCommitSha,
            currentHeadSha
          )
        );
      }
    } catch (error) {
      issues.push(
        `Responsive workspace audit is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const storyAuditPath = resolve(canonicalRoot, DESIGN_LAB_STORY_AUDIT_PATH);
  let storyAuditJson: string | null = null;
  if (!existsSync(storyAuditPath)) {
    issues.push(`User-story audit evidence is missing: ${DESIGN_LAB_STORY_AUDIT_PATH}`);
  } else {
    try {
      storyAuditJson = readFileSync(storyAuditPath, "utf8");
      const storyAudit = JSON.parse(storyAuditJson);
      const storyTestedCommitSha = readTestedCommitSha(storyAudit);
      issues.push(
        ...findDesignLabStoryAuditIssues(
          storyAudit,
          {
            headSha: storyTestedCommitSha ?? currentHeadSha,
            sourceSha256: currentSource.sha256,
            sourceFileCount: currentSource.fileCount,
            now,
          },
        ),
      );
      if (
        !storyTestedCommitSha ||
        !isRepositoryCommitAncestor(canonicalRoot, storyTestedCommitSha, currentHeadSha)
      ) {
        issues.push(
          "User-story audit tested commit is not an ancestor of the current Git HEAD."
        );
      } else {
        issues.push(
          ...findAuditedSourceCommitIssues(
            canonicalRoot,
            "User-story audit",
            storyTestedCommitSha,
            currentHeadSha
          )
        );
      }
    } catch (error) {
      issues.push(
        `User-story audit is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const hydratedAuditPath = resolve(
    canonicalRoot,
    DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH
  );
  if (!existsSync(hydratedAuditPath)) {
    issues.push(
      `Hydrated user-story audit evidence is missing: ${DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH}`
    );
  } else if (storyAuditJson) {
    try {
      const hydratedAudit = JSON.parse(readFileSync(hydratedAuditPath, "utf8"));
      const hydratedTestedCommitSha = readTestedCommitSha(hydratedAudit);
      issues.push(
        ...findDesignLabHydratedStoryAuditIssues(hydratedAudit, {
          headSha: hydratedTestedCommitSha ?? currentHeadSha,
          sourceSha256: currentSource.sha256,
          sourceFileCount: currentSource.fileCount,
          companionHttpAuditSha256: createHash("sha256")
            .update(storyAuditJson)
            .digest("hex"),
          now,
        })
      );
      if (
        !hydratedTestedCommitSha ||
        !isRepositoryCommitAncestor(
          canonicalRoot,
          hydratedTestedCommitSha,
          currentHeadSha
        )
      ) {
        issues.push(
          "Hydrated user-story audit tested commit is not an ancestor of the current Git HEAD."
        );
      } else {
        issues.push(
          ...findAuditedSourceCommitIssues(
            canonicalRoot,
            "Hydrated user-story audit",
            hydratedTestedCommitSha,
            currentHeadSha
          )
        );
      }
    } catch (error) {
      issues.push(
        `Hydrated user-story audit is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const hydratedWave2AuditPath = resolve(
    canonicalRoot,
    DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH
  );
  if (!existsSync(hydratedWave2AuditPath)) {
    issues.push(
      `Hydrated wave 2 audit evidence is missing: ${DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH}`
    );
  } else if (storyAuditJson) {
    try {
      const hydratedWave2Audit = JSON.parse(
        readFileSync(hydratedWave2AuditPath, "utf8")
      );
      const hydratedWave2TestedCommitSha = readTestedCommitSha(
        hydratedWave2Audit
      );
      issues.push(
        ...findDesignLabHydratedWave2AuditIssues(hydratedWave2Audit, {
          headSha: hydratedWave2TestedCommitSha ?? currentHeadSha,
          sourceSha256: currentSource.sha256,
          sourceFileCount: currentSource.fileCount,
          companionHttpAuditSha256: createHash("sha256")
            .update(storyAuditJson)
            .digest("hex"),
          now,
        })
      );
      if (
        !hydratedWave2TestedCommitSha ||
        !isRepositoryCommitAncestor(
          canonicalRoot,
          hydratedWave2TestedCommitSha,
          currentHeadSha
        )
      ) {
        issues.push(
          "Hydrated wave 2 audit tested commit is not an ancestor of the current Git HEAD."
        );
      } else {
        issues.push(
          ...findAuditedSourceCommitIssues(
            canonicalRoot,
            "Hydrated wave 2 audit",
            hydratedWave2TestedCommitSha,
            currentHeadSha
          )
        );
      }
    } catch (error) {
      issues.push(
        `Hydrated wave 2 audit is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (requireReleaseReadyEvidence) {
    issues.push(
      ...findRepositoryFileIntegrityIssues(canonicalRoot, "Route audit evidence", [
        ROUTE_AUDIT_PATH,
      ]),
      ...findRepositoryFileIntegrityIssues(canonicalRoot, "User-story audit evidence", [
        DESIGN_LAB_STORY_AUDIT_PATH,
      ]),
      ...findRepositoryFileIntegrityIssues(
        canonicalRoot,
        "Hydrated user-story audit evidence",
        [DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH]
      ),
      ...findRepositoryFileIntegrityIssues(
        canonicalRoot,
        "Hydrated wave 2 audit evidence",
        [DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH]
      ),
      ...findRepositoryFileIntegrityIssues(
        canonicalRoot,
        "Responsive workspace audit evidence",
        [DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH]
      )
    );
    const workingSourcePaths = getDesignLabSourcePaths(canonicalRoot);
    const committedSourcePaths = getDesignLabSourcePathsAtCommit(
      canonicalRoot,
      currentHeadSha
    );
    if (!committedSourcePaths) {
      issues.push("Release-ready source inventory could not be read from the current HEAD.");
    } else if (
      JSON.stringify(workingSourcePaths) !== JSON.stringify(committedSourcePaths)
    ) {
      issues.push(
        "Release-ready source inventory does not exactly match the current HEAD."
      );
    }
    issues.push(
      ...findRepositoryFileIntegrityIssues(
        canonicalRoot,
        "Audited source",
        [...new Set([...workingSourcePaths, ...(committedSourcePaths ?? [])])]
      )
    );
  }

  const routeWorkstream = DESIGN_LAB_DELIVERY_PROGRESS.find(
    (item) => item.id === "WORK.ROUTES.EXACT-AUDIT"
  );
  if (routeWorkstream && routeEvaluation.summary) {
    const score = `${routeEvaluation.summary.passed}/${routeEvaluation.summary.expected}`;
    if (!routeWorkstream.summary.includes(score)) {
      issues.push(`Exact-route workstream summary does not report ${score}.`);
    }
    if (!routeWorkstream.verification.some((record) => record.includes(score))) {
      issues.push(`Exact-route workstream verification does not report ${score}.`);
    }
    const updatedAt = Date.parse(routeWorkstream.updatedAt);
    if (Number.isFinite(generatedAt) && updatedAt < generatedAt) {
      issues.push("Exact-route workstream is older than its latest audit evidence.");
    }
  }

  return issues;
}

function readTestedCommitSha(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("testedCommitSha" in value) ||
    typeof value.testedCommitSha !== "string"
  ) {
    return null;
  }
  const sha = value.testedCommitSha.toLowerCase();
  return /^[a-f0-9]{40}$/.test(sha) ? sha : null;
}

function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findAuditedSourceCommitIssues(
  repoRoot: string,
  label: string,
  testedCommitSha: string,
  currentHeadSha: string
) {
  const changedPaths = getDesignLabSourceChangesBetween(
    repoRoot,
    testedCommitSha,
    currentHeadSha
  );
  if (!changedPaths) {
    return [`${label} source ancestry could not be verified.`];
  }
  return changedPaths.length === 0
    ? []
    : [
        `${label} fingerprinted source changed after its tested commit: ${changedPaths.join(
          ", "
        )}`,
      ];
}

export function findRepositoryFileIntegrityIssues(
  repoRoot: string,
  label: string,
  filePaths: readonly string[]
) {
  const findings = {
    control: [] as string[],
    missing: [] as string[],
    symlink: [] as string[],
    nonFile: [] as string[],
    flags: [] as string[],
    stage: [] as string[],
    head: [] as string[],
    bytes: [] as string[],
  };
  const regularPaths: string[] = [];
  for (const filePath of [...new Set(filePaths)].toSorted()) {
    if (/[\0\r\n\t]/.test(filePath)) {
      findings.control.push(filePath);
      continue;
    }
    const absolutePath = resolve(repoRoot, filePath);
    if (!existsSync(absolutePath)) {
      findings.missing.push(filePath);
    } else if (lstatSync(absolutePath).isSymbolicLink()) {
      findings.symlink.push(filePath);
    } else if (!lstatSync(absolutePath).isFile()) {
      findings.nonFile.push(filePath);
    } else {
      regularPaths.push(filePath);
    }
  }

  for (let offset = 0; offset < regularPaths.length; offset += 80) {
    const paths = regularPaths.slice(offset, offset + 80);
    const flags = runGit(repoRoot, ["ls-files", "-v", "-z", "--", ...paths]);
    const stages = runGit(repoRoot, ["ls-files", "--stage", "-z", "--", ...paths]);
    const heads = runGit(repoRoot, ["ls-tree", "-r", "-z", "HEAD", "--", ...paths]);
    const working = spawnSync(
      "git",
      ["hash-object", "--no-filters", "--stdin-paths"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        input: `${paths.join("\n")}\n`,
      }
    );
    const flagByPath = parseFlagRecords(flags.status === 0 ? flags.stdout : "");
    const stageByPath = parseStageRecords(stages.status === 0 ? stages.stdout : "");
    const headByPath = parseTreeRecords(heads.status === 0 ? heads.stdout : "");
    const workingHashes =
      working.status === 0 ? working.stdout.trim().split(/\r?\n/) : [];

    for (const [index, filePath] of paths.entries()) {
      if (flagByPath.get(filePath) !== "H") {
        findings.flags.push(filePath);
      }
      const stage = stageByPath.get(filePath);
      if (!stage || !/^100(?:644|755)$/.test(stage.mode) || stage.stage !== "0") {
        findings.stage.push(filePath);
      }
      const head = headByPath.get(filePath);
      if (!head || !/^100(?:644|755)$/.test(head.mode) || head.type !== "blob") {
        findings.head.push(filePath);
      }
      if (
        !stage ||
        !head ||
        !/^[a-f0-9]{40}$/.test(workingHashes[index] ?? "") ||
        workingHashes[index] !== stage.sha ||
        stage.sha !== head.sha
      ) {
        findings.bytes.push(filePath);
      }
    }
  }
  return [
    formatIntegrityFinding(label, "paths contain unsupported control characters", findings.control),
    formatIntegrityFinding(label, "files are missing", findings.missing),
    formatIntegrityFinding(label, "files are symbolic links", findings.symlink),
    formatIntegrityFinding(label, "paths are not regular files", findings.nonFile),
    formatIntegrityFinding(
      label,
      "files are untracked or have unsafe Git index flags",
      findings.flags
    ),
    formatIntegrityFinding(label, "files are not regular stage-0 Git entries", findings.stage),
    formatIntegrityFinding(label, "files are not regular files in current HEAD", findings.head),
    formatIntegrityFinding(label, "file bytes differ from the index or current HEAD", findings.bytes),
  ].filter((issue): issue is string => issue !== null);
}

function formatIntegrityFinding(
  label: string,
  description: string,
  filePaths: readonly string[]
) {
  if (filePaths.length === 0) return null;
  const visible = filePaths.slice(0, 12);
  const remainder = filePaths.length - visible.length;
  return `${label} ${description} (${filePaths.length}): ${visible.join(", ")}${
    remainder > 0 ? `, and ${remainder} more` : ""
  }`;
}

function parseFlagRecords(output: string) {
  const records = new Map<string, string>();
  for (const record of output.split("\0").filter(Boolean)) {
    if (record.length >= 3 && record[1] === " ") {
      records.set(record.slice(2).replaceAll("\\", "/"), record[0]);
    }
  }
  return records;
}

function parseStageRecords(output: string) {
  const records = new Map<string, { mode: string; sha: string; stage: string }>();
  for (const record of output.split("\0").filter(Boolean)) {
    const match = /^(\d{6}) ([a-f0-9]{40}) ([0-3])\t(.+)$/.exec(record);
    if (match) {
      records.set(match[4].replaceAll("\\", "/"), {
        mode: match[1],
        sha: match[2],
        stage: match[3],
      });
    }
  }
  return records;
}

function parseTreeRecords(output: string) {
  const records = new Map<string, { mode: string; type: string; sha: string }>();
  for (const record of output.split("\0").filter(Boolean)) {
    const match = /^(\d{6}) (\w+) ([a-f0-9]{40})\t(.+)$/.exec(record);
    if (match) {
      records.set(match[4].replaceAll("\\", "/"), {
        mode: match[1],
        type: match[2],
        sha: match[3],
      });
    }
  }
  return records;
}

function runGit(repoRoot: string, args: readonly string[]) {
  return spawnSync("git", [...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function isInside(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

export function main() {
  const repoRoot = resolve(__dirname, "..");
  const issues = collectDesignLabSyncIssues({ repoRoot });
  console.log(
    `Design Lab sync audit: ${DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks}/${DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks} checks across ${DESIGN_LAB_SYNC_SNAPSHOT.sectionSummary.total} canonical sections and ${DESIGN_LAB_SYNC_SNAPSHOT.workstreams.total} workstreams.`
  );
  if (issues.length > 0) {
    console.error(`Design Lab sync audit FAIL (${issues.length} issue${issues.length === 1 ? "" : "s"}):`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    "Design Lab sync audit PASS: release counters, visible summaries, section ledger, workstream evidence paths and exact-route artifact agree."
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  main();
}
