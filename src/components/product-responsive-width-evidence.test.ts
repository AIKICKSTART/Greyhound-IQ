import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  DESIGN_LAB_RESPONSIVE_ARCHITECTURE_BUILD_PATH,
  DESIGN_LAB_RESPONSIVE_ARCHITECTURE_REPORT_PATH,
  DESIGN_LAB_RESPONSIVE_ARCHITECTURE_SOURCE_PATH,
  DESIGN_LAB_RESPONSIVE_SURFACES,
  DESIGN_LAB_RESPONSIVE_VIEWPORTS,
  DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH,
  findDesignLabResponsiveWorkspaceAuditIssues,
  type ResponsiveAuditReport,
} from "../../scripts/audit-design-lab-responsive-workspace";
import {
  fingerprintRepositoryFiles,
  getDesignLabSourceChangesBetween,
  getRepositoryHeadSha,
  isRepositoryCommitAncestor,
  parseDesignLabSourceFiles,
} from "../../scripts/design-lab-source-fingerprint";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RESPONSIVE_REQUIRED_WIDTHS,
  PRODUCT_RESPONSIVE_WIDTH_EVIDENCE_FILE,
  PRODUCT_RESPONSIVE_WIDTH_MASTER_EVIDENCE,
  PRODUCT_RESPONSIVE_WIDTH_REQUIREMENT_IDS,
  PRODUCT_RESPONSIVE_WIDTH_TEST_FILE,
} from "./product-responsive-width-evidence";

const repositoryRoot = path.resolve(".");
const exactPromptIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "global.responsive-widths",
).map((requirement) => requirement.id);

assert.equal(PRODUCT_RESPONSIVE_REQUIRED_WIDTHS.length, 11);
assert.deepEqual(
  PRODUCT_RESPONSIVE_WIDTH_REQUIREMENT_IDS.toSorted(),
  exactPromptIds.toSorted(),
);
assert.deepEqual(
  Object.keys(PRODUCT_RESPONSIVE_WIDTH_MASTER_EVIDENCE).toSorted(),
  exactPromptIds.toSorted(),
);
for (const requirementId of exactPromptIds) {
  const record = PRODUCT_RESPONSIVE_WIDTH_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.ok(record.evidence.includes(PRODUCT_RESPONSIVE_WIDTH_EVIDENCE_FILE));
  assert.ok(record.evidence.includes(PRODUCT_RESPONSIVE_WIDTH_TEST_FILE));
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const configuredWidths = new Set(
  DESIGN_LAB_RESPONSIVE_VIEWPORTS.map((viewport) => viewport.width),
);
for (const width of PRODUCT_RESPONSIVE_REQUIRED_WIDTHS) {
  assert.equal(configuredWidths.has(width), true, `missing ${width}px viewport`);
}

const report = JSON.parse(
  readFileSync(DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH, "utf8"),
) as ResponsiveAuditReport;
const sourceFiles = parseDesignLabSourceFiles(report);
assert.ok(sourceFiles, "Responsive audit must carry a canonical source-files manifest");
const fingerprint = fingerprintRepositoryFiles(repositoryRoot, sourceFiles);
const auditScriptPath = "scripts/audit-design-lab-responsive-workspace.ts";
const headSha = getRepositoryHeadSha(repositoryRoot);
assert.equal(
  isRepositoryCommitAncestor(repositoryRoot, report.testedCommitSha, headSha),
  true,
  "Responsive workspace audit tested commit must be an ancestor of the current HEAD",
);
assert.deepEqual(
  getDesignLabSourceChangesBetween(
    repositoryRoot,
    report.testedCommitSha,
    headSha,
    sourceFiles,
  ),
  [],
  "Responsive workspace audit fingerprinted source changed after its tested commit",
);
const issues = findDesignLabResponsiveWorkspaceAuditIssues(report, {
  headSha: report.testedCommitSha,
  sourceSha256: fingerprint.sha256,
  sourceFileCount: fingerprint.fileCount,
  auditScriptSha256: sha256(readFileSync(auditScriptPath)),
  architectureReportSha256: sha256(
    readFileSync(DESIGN_LAB_RESPONSIVE_ARCHITECTURE_REPORT_PATH),
  ),
  architectureSourceSha256: sha256(
    readFileSync(DESIGN_LAB_RESPONSIVE_ARCHITECTURE_SOURCE_PATH),
  ),
  architectureBuildSha256: sha256(
    readFileSync(DESIGN_LAB_RESPONSIVE_ARCHITECTURE_BUILD_PATH),
  ),
});
assert.deepEqual(issues, [], issues.join("\n"));

for (const width of PRODUCT_RESPONSIVE_REQUIRED_WIDTHS) {
  const results = report.results.filter((result) => result.width === width);
  assert.equal(
    results.length,
    DESIGN_LAB_RESPONSIVE_SURFACES.length,
    `${width}px must cover every responsive surface`,
  );
  assert.ok(results.every((result) => result.passed), `${width}px has a failure`);
  assert.ok(
    results.every(
      (result) =>
        result.runtimeExceptions.length === 0 &&
        result.mutatingRequests.length === 0 &&
        !result.snapshot.document.horizontalOverflow,
    ),
    `${width}px violated the runtime, read-only or overflow boundary`,
  );
}

console.log(
  `Responsive width evidence passed: ${PRODUCT_RESPONSIVE_REQUIRED_WIDTHS.length} exact widths across ${DESIGN_LAB_RESPONSIVE_SURFACES.length} surfaces`,
);

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
