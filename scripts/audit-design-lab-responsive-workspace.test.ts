import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";

import {
  DESIGN_LAB_RESPONSIVE_DESKTOP_DIAGRAM_TEXT_FLOOR_PX,
  DESIGN_LAB_RESPONSIVE_DESKTOP_TABLE_TEXT_FLOOR_PX,
  DESIGN_LAB_RESPONSIVE_EMBEDDED_REPORT_MIN_WIDTH,
  DESIGN_LAB_RESPONSIVE_EVIDENCE_BOUNDARY,
  DESIGN_LAB_RESPONSIVE_SURFACES,
  DESIGN_LAB_RESPONSIVE_TABLE_COMPACT_MAX_WIDTH,
  DESIGN_LAB_RESPONSIVE_VIEWPORTS,
  findDesignLabResponsiveWorkspaceAuditIssues,
  findResponsiveCaseFailures,
  isLoopbackBaseUrl,
  type ResponsiveAuditReport,
  type ResponsiveCaseResult,
  type ResponsiveSnapshot,
  writeResponsiveReport,
} from "./audit-design-lab-responsive-workspace";

const expectedResponsiveWidths = [
  320, 360, 375, 390, 430, 768, 820, 821, 1024, 1152, 1279, 1280, 1440, 1535,
  1536, 1680, 1920,
];

const expectedAreas = [
  "advertising",
  "architecture",
  "delivery",
  "overview",
  "readiness",
  "requirements",
  "screens",
];
assert.deepEqual(
  DESIGN_LAB_RESPONSIVE_SURFACES.filter(
    (surface) => surface.kind === "workspace-area",
  )
    .map((surface) => surface.area)
    .sort(),
  expectedAreas,
);
assert.deepEqual(
  DESIGN_LAB_RESPONSIVE_VIEWPORTS.map((viewport) => viewport.width),
  expectedResponsiveWidths,
);
assert.equal(DESIGN_LAB_RESPONSIVE_TABLE_COMPACT_MAX_WIDTH, 1320);
assert.equal(DESIGN_LAB_RESPONSIVE_DESKTOP_TABLE_TEXT_FLOOR_PX, 10);
assert.equal(DESIGN_LAB_RESPONSIVE_DESKTOP_DIAGRAM_TEXT_FLOOR_PX, 12);
assert.equal(DESIGN_LAB_RESPONSIVE_EMBEDDED_REPORT_MIN_WIDTH, 1024);
assert.equal(
  DESIGN_LAB_RESPONSIVE_SURFACES.filter(
    (surface) => surface.kind === "architecture-report",
  ).length,
  1,
);
for (const requirementId of [
  "GLOBAL.WIDTH.360",
  "GLOBAL.WIDTH.390",
  "VERIFY.GATE.overflow",
]) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (item) => item.id === requirementId,
  );
  assert.ok(requirement, `${requirementId} must remain in the master registry`);
  assert.equal(
    isMasterRequirementComplete(requirement),
    true,
    `${requirementId} must remain bound to responsive runtime evidence`,
  );
}

for (const allowed of [
  "http://localhost:3000",
  "https://127.0.0.1:3443",
  "http://[::1]:3000",
]) {
  assert.equal(isLoopbackBaseUrl(allowed), true, allowed);
}
for (const rejected of [
  "https://greyhoundsiq.com.au",
  "http://localhost.evil.example",
  "http://user:password@localhost:3000",
  "http://localhost:3000/design-lab",
  "http://localhost:3000?area=overview",
]) {
  assert.equal(isLoopbackBaseUrl(rejected), false, rejected);
}

const binding = {
  headSha: "a".repeat(40),
  sourceSha256: "b".repeat(64),
  sourceFileCount: 120,
  auditScriptSha256: "c".repeat(64),
  architectureReportSha256: "d".repeat(64),
  architectureSourceSha256: "e".repeat(64),
  architectureBuildSha256: "f".repeat(64),
  now: Date.parse("2026-07-14T02:00:00.000Z"),
};

const validResults = DESIGN_LAB_RESPONSIVE_VIEWPORTS.flatMap((viewport) =>
  DESIGN_LAB_RESPONSIVE_SURFACES.map((surface) => {
    const snapshot = validSnapshot(
      surface.id,
      surface.kind,
      surface.area,
      viewport.width,
    );
    const base = {
      id: `${surface.id}@${viewport.width}`,
      surfaceId: surface.id,
      kind: surface.kind,
      area: surface.area,
      requestPath: surface.requestPath,
      width: viewport.width,
      height: viewport.height,
      httpStatus: 200,
      finalUrl: `http://localhost:3000${surface.requestPath}`,
      durationMs: 250,
      snapshot,
      runtimeExceptions: [],
      mutatingRequests: [],
    } satisfies Omit<ResponsiveCaseResult, "failures" | "passed">;
    const failures = findResponsiveCaseFailures(base);
    assert.deepEqual(failures, []);
    return { ...base, failures, passed: true };
  }),
);

const validAudit: ResponsiveAuditReport = {
  schemaVersion: 1,
  auditKind: "design-lab-responsive-workspace",
  evidenceBoundary: DESIGN_LAB_RESPONSIVE_EVIDENCE_BOUNDARY,
  generatedAt: "2026-07-14T02:00:00.000Z",
  baseUrl: "http://localhost:3000",
  browser: { product: "Chrome/150.0.0.0", protocolVersion: "1.3" },
  testedCommitSha: binding.headSha,
  sourceSha256: binding.sourceSha256,
  sourceFileCount: binding.sourceFileCount,
  sourceFiles: ["src/app/design-lab/page.tsx"],
  auditScriptSha256: binding.auditScriptSha256,
  architectureReportSha256: binding.architectureReportSha256,
  architectureSourceSha256: binding.architectureSourceSha256,
  architectureBuildSha256: binding.architectureBuildSha256,
  viewportWidths: expectedResponsiveWidths,
  expectedCases: validResults.length,
  passedCases: validResults.length,
  results: validResults,
};
assert.deepEqual(
  findDesignLabResponsiveWorkspaceAuditIssues(validAudit, binding),
  [],
);

for (const representationVariant of responsiveRepresentationVariants()) {
  const caseInput = structuredClone(
    representationVariant,
  ) as Partial<ResponsiveCaseResult>;
  delete caseInput.failures;
  delete caseInput.passed;
  assert.deepEqual(
    findResponsiveCaseFailures(
      caseInput as Omit<ResponsiveCaseResult, "failures" | "passed">,
    ),
    [],
    representationVariant.id,
  );
}

const failureCases: Array<{
  name: string;
  mutate: (value: ResponsiveCaseResult) => void;
  expected: RegExp;
}> = [
  {
    name: "document overflow",
    mutate: (value) => {
      value.snapshot.document.horizontalOverflow = true;
      value.snapshot.document.scrollWidth =
        value.snapshot.document.clientWidth + 20;
    },
    expected: /document horizontal overflow/,
  },
  {
    name: "wide table",
    mutate: (value) => {
      value.snapshot.tables = [
        {
          index: 1,
          selector: "table.audit",
          visible: true,
          tableWidth: 600,
          containerWidth: 320,
          widerThanContainer: true,
          mobileCardsPresent: true,
          mobileCardsVisible: true,
          mobileCardsWidth: 320,
          mobileCardsOverflow: false,
          minimumMobileTextPx: 11,
          minimumDesktopTextPx: 0,
          bodyRowCount: 1,
          mobileRecordCount: 1,
          mobileSemanticParity: true,
          horizontalScrollAvailable: false,
          keyboardScrollable: false,
        },
      ];
    },
    expected: /table .* is 600px wide/,
  },
  {
    name: "clipped diagram",
    mutate: (value) => {
      value.snapshot.diagrams = [
        {
          index: 1,
          selector: "article.diagram",
          label: "System context",
          visible: true,
          clientWidth: 320,
          scrollWidth: 720,
          clipped: true,
          diagramViewportVisible: false,
          mobileFlowPresent: true,
          mobileFlowVisible: true,
          mobileFlowStepCount: 4,
          mobileFlowWidth: 320,
          mobileFlowOverflow: false,
          minimumMobileTextPx: 12,
          minimumDesktopLabelTextPx: 0,
          labelBoundaryFailures: 0,
          overlappingBoxPairs: 0,
          viewportClientWidth: 0,
          viewportScrollWidth: 0,
          horizontalScrollAvailable: false,
          keyboardScrollable: false,
        },
      ];
    },
    expected: /must fit the viewport in full/,
  },
  {
    name: "illegible mobile diagram",
    mutate: (value) => {
      value.surfaceId = "architecture-report";
      value.kind = "architecture-report";
      value.area = null;
      value.requestPath = "/greyhoundiq-production-architecture.html";
      value.finalUrl =
        "http://localhost:3000/greyhoundiq-production-architecture.html";
      value.snapshot.diagrams = [
        {
          index: 1,
          selector: "article.diagram",
          label: "System context",
          visible: true,
          clientWidth: 320,
          scrollWidth: 320,
          clipped: false,
          diagramViewportVisible: false,
          mobileFlowPresent: true,
          mobileFlowVisible: true,
          mobileFlowStepCount: 4,
          mobileFlowWidth: 320,
          mobileFlowOverflow: false,
          minimumMobileTextPx: 8,
          minimumDesktopLabelTextPx: 0,
          labelBoundaryFailures: 0,
          overlappingBoxPairs: 0,
          viewportClientWidth: 0,
          viewportScrollWidth: 0,
          horizontalScrollAvailable: false,
          keyboardScrollable: false,
        },
      ];
    },
    expected: /mobile text is 8px/,
  },
  {
    name: "illegible desktop diagram",
    mutate: (value) => {
      setArchitectureReportCase(value, 821);
      value.snapshot.diagrams[0].diagramViewportVisible = true;
      value.snapshot.diagrams[0].mobileFlowVisible = false;
      value.snapshot.diagrams[0].minimumMobileTextPx = 0;
      value.snapshot.diagrams[0].minimumDesktopLabelTextPx = 11;
      value.snapshot.diagrams[0].viewportClientWidth = 741;
      value.snapshot.diagrams[0].viewportScrollWidth = 741;
    },
    expected: /desktop label text renders at 11px/,
  },
  {
    name: "scrolling diagram representation",
    mutate: (value) => {
      setArchitectureReportCase(value, 821);
      value.snapshot.diagrams[0].diagramViewportVisible = true;
      value.snapshot.diagrams[0].mobileFlowVisible = false;
      value.snapshot.diagrams[0].minimumMobileTextPx = 0;
      value.snapshot.diagrams[0].minimumDesktopLabelTextPx = 12;
      value.snapshot.diagrams[0].viewportClientWidth = 741;
      value.snapshot.diagrams[0].viewportScrollWidth = 1200;
    },
    expected: /requires horizontal scrolling/,
  },
  {
    name: "diagram label outside box",
    mutate: (value) => {
      setArchitectureReportCase(value, 390);
      value.snapshot.diagrams[0].labelBoundaryFailures = 1;
    },
    expected: /1 labels outside their boxes/,
  },
  {
    name: "overlapping diagram boxes",
    mutate: (value) => {
      setArchitectureReportCase(value, 390);
      value.snapshot.diagrams[0].overlappingBoxPairs = 2;
    },
    expected: /2 overlapping box pairs/,
  },
  {
    name: "duplicate table representations",
    mutate: (value) => {
      setArchitectureReportCase(value, 1440);
      value.snapshot.tables[0].mobileCardsVisible = true;
      value.snapshot.tables[0].minimumMobileTextPx = 11;
    },
    expected: /duplicate responsive representations/,
  },
  {
    name: "missing diagram representation",
    mutate: (value) => {
      setArchitectureReportCase(value, 390);
      value.snapshot.diagrams[0].diagramViewportVisible = false;
      value.snapshot.diagrams[0].mobileFlowVisible = false;
    },
    expected: /no visible responsive representation/,
  },
  {
    name: "missing mobile table records",
    mutate: (value) => {
      value.surfaceId = "architecture-report";
      value.kind = "architecture-report";
      value.area = null;
      value.requestPath = "/greyhoundiq-production-architecture.html";
      value.finalUrl =
        "http://localhost:3000/greyhoundiq-production-architecture.html";
      value.snapshot.tables = [
        {
          index: 1,
          selector: "table.audit",
          visible: false,
          tableWidth: 920,
          containerWidth: 320,
          widerThanContainer: false,
          mobileCardsPresent: false,
          mobileCardsVisible: false,
          mobileCardsWidth: 0,
          mobileCardsOverflow: false,
          minimumMobileTextPx: 0,
          minimumDesktopTextPx: 0,
          bodyRowCount: 1,
          mobileRecordCount: 0,
          mobileSemanticParity: false,
          horizontalScrollAvailable: false,
          keyboardScrollable: true,
        },
      ];
    },
    expected: /no responsive mobile record collection/,
  },
  {
    name: "overflowing mobile table records",
    mutate: (value) => {
      value.surfaceId = "architecture-report";
      value.kind = "architecture-report";
      value.area = null;
      value.requestPath = "/greyhoundiq-production-architecture.html";
      value.finalUrl =
        "http://localhost:3000/greyhoundiq-production-architecture.html";
      value.snapshot.tables = [
        {
          index: 1,
          selector: "table.audit",
          visible: false,
          tableWidth: 920,
          containerWidth: 320,
          widerThanContainer: false,
          mobileCardsPresent: true,
          mobileCardsVisible: true,
          mobileCardsWidth: 440,
          mobileCardsOverflow: true,
          minimumMobileTextPx: 11,
          minimumDesktopTextPx: 0,
          bodyRowCount: 1,
          mobileRecordCount: 1,
          mobileSemanticParity: true,
          horizontalScrollAvailable: false,
          keyboardScrollable: true,
        },
      ];
    },
    expected: /mobile records are 440px wide/,
  },
  {
    name: "illegible mobile table labels",
    mutate: (value) => {
      value.surfaceId = "architecture-report";
      value.kind = "architecture-report";
      value.area = null;
      value.requestPath = "/greyhoundiq-production-architecture.html";
      value.finalUrl =
        "http://localhost:3000/greyhoundiq-production-architecture.html";
      value.snapshot.tables = [
        {
          index: 1,
          selector: "table.audit",
          visible: false,
          tableWidth: 920,
          containerWidth: 320,
          widerThanContainer: false,
          mobileCardsPresent: true,
          mobileCardsVisible: true,
          mobileCardsWidth: 320,
          mobileCardsOverflow: false,
          minimumMobileTextPx: 8,
          minimumDesktopTextPx: 0,
          bodyRowCount: 1,
          mobileRecordCount: 1,
          mobileSemanticParity: true,
          horizontalScrollAvailable: false,
          keyboardScrollable: true,
        },
      ];
    },
    expected: /mobile labels are 8px/,
  },
  {
    name: "mobile table semantic drift",
    mutate: (value) => {
      setArchitectureReportCase(value, 360);
      value.snapshot.tables[0].mobileSemanticParity = false;
      value.snapshot.tables[0].mobileRecordCount = 0;
    },
    expected: /mobile records do not preserve 1 rows/,
  },
  {
    name: "illegible desktop table",
    mutate: (value) => {
      setArchitectureReportCase(value, 1440);
      value.snapshot.tables[0].minimumDesktopTextPx = 9;
    },
    expected: /desktop text renders at 9px/,
  },
  {
    name: "hidden embedded architecture report",
    mutate: (value) => {
      setWorkspaceArchitectureCase(value, 1024);
      value.snapshot.architectureEmbed.frameVisible = false;
    },
    expected: /iframe is hidden at 1024px/,
  },
  {
    name: "browser exception",
    mutate: (value) => {
      value.runtimeExceptions = ["Unhandled TypeError"];
    },
    expected: /browser exception/,
  },
  {
    name: "mutating request",
    mutate: (value) => {
      value.mutatingRequests = [
        { method: "POST", url: "http://localhost:3000/api/example" },
      ];
    },
    expected: /read-only boundary violated/,
  },
];

for (const failureCase of failureCases) {
  const value = structuredClone(
    validResults.find((result) => result.surfaceId === "workspace-overview")!,
  );
  failureCase.mutate(value);
  const base = structuredClone(value) as Partial<ResponsiveCaseResult>;
  delete base.failures;
  delete base.passed;
  assert.match(
    findResponsiveCaseFailures(
      base as Omit<ResponsiveCaseResult, "failures" | "passed">,
    ).join("\n"),
    failureCase.expected,
    failureCase.name,
  );
}

for (const mutate of [
  (audit: ResponsiveAuditReport) => {
    audit.sourceSha256 = "e".repeat(64);
  },
  (audit: ResponsiveAuditReport) => {
    audit.auditScriptSha256 = "e".repeat(64);
  },
  (audit: ResponsiveAuditReport) => {
    audit.architectureReportSha256 = "e".repeat(64);
  },
  (audit: ResponsiveAuditReport) => {
    audit.architectureSourceSha256 = "0".repeat(64);
  },
  (audit: ResponsiveAuditReport) => {
    audit.architectureBuildSha256 = "0".repeat(64);
  },
  (audit: ResponsiveAuditReport) => {
    audit.viewportWidths = [...expectedResponsiveWidths].reverse();
  },
  (audit: ResponsiveAuditReport) => {
    audit.results.pop();
  },
  (audit: ResponsiveAuditReport) => {
    audit.results[0].passed = false;
  },
  (audit: ResponsiveAuditReport) => {
    audit.generatedAt = "2026-07-12T00:00:00.000Z";
  },
]) {
  const invalid = structuredClone(validAudit);
  mutate(invalid);
  assert.ok(
    findDesignLabResponsiveWorkspaceAuditIssues(invalid, binding).length > 0,
  );
}
assert.ok(
  findDesignLabResponsiveWorkspaceAuditIssues(
    { ...validAudit, results: [null] },
    binding,
  ).length > 0,
);

assertAtomicWriter()
  .then(() => {
    console.log("Design Lab responsive workspace audit contracts passed");
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

function validSnapshot(
  surfaceId: string,
  kind: "workspace-area" | "architecture-report",
  area: string | null,
  width: number,
): ResponsiveSnapshot {
  const architectureReport = kind === "architecture-report";
  const embeddedReport =
    surfaceId === "workspace-architecture" &&
    width >= DESIGN_LAB_RESPONSIVE_EMBEDDED_REPORT_MIN_WIDTH;
  const hasReport = architectureReport || embeddedReport;
  const reportWidth = embeddedReport
    ? width - (width >= 1536 ? 320 : 80)
    : width;
  const compactTable =
    hasReport && reportWidth <= DESIGN_LAB_RESPONSIVE_TABLE_COMPACT_MAX_WIDTH;
  const compactDiagram = hasReport;
  const diagramViewportWidth = Math.max(reportWidth - 80, 0);
  const diagramScrollWidth = compactDiagram
    ? 0
    : Math.max(diagramViewportWidth, 1200);
  return {
    locationUrl: architectureReport
      ? "http://localhost:3000/greyhoundsiq-production-architecture.html"
      : `http://localhost:3000/design-lab?area=${area}`,
    title: architectureReport ? "Architecture report" : "Design Lab",
    activeArea: architectureReport ? null : area,
    declaredDiagramCount: hasReport ? 1 : null,
    document: {
      clientWidth: width,
      scrollWidth: width,
      bodyClientWidth: width,
      bodyScrollWidth: width,
      horizontalOverflow: false,
    },
    architectureEmbed: {
      framePresent: surfaceId === "workspace-architecture",
      frameVisible: embeddedReport,
      frameClientWidth: embeddedReport ? reportWidth : 0,
      mobileLinkPresent: surfaceId === "workspace-architecture",
      mobileLinkVisible:
        surfaceId === "workspace-architecture" && !embeddedReport,
      contentClientWidth: embeddedReport ? reportWidth : 0,
      contentScrollWidth: embeddedReport ? reportWidth : 0,
      contentHorizontalOverflow: false,
    },
    tables: hasReport
      ? [
          {
            index: 1,
            selector: "table:nth(1)",
            visible: !compactTable,
            tableWidth: 920,
            containerWidth: reportWidth - 40,
            widerThanContainer: false,
            mobileCardsPresent: true,
            mobileCardsVisible: compactTable,
            mobileCardsWidth: reportWidth - 40,
            mobileCardsOverflow: false,
            minimumMobileTextPx: compactTable ? 11 : 0,
            minimumDesktopTextPx: compactTable ? 0 : 10,
            bodyRowCount: 1,
            mobileRecordCount: 1,
            mobileSemanticParity: true,
            horizontalScrollAvailable: !compactTable,
            keyboardScrollable: true,
          },
        ]
      : [],
    diagrams: hasReport
      ? [
          {
            index: 1,
            selector: "article.diagram:nth(1)",
            label: "System context",
            visible: true,
            clientWidth: diagramViewportWidth,
            scrollWidth: diagramViewportWidth,
            clipped: false,
            diagramViewportVisible: !compactDiagram,
            mobileFlowPresent: true,
            mobileFlowVisible: compactDiagram,
            mobileFlowStepCount: 4,
            mobileFlowWidth: diagramViewportWidth,
            mobileFlowOverflow: false,
            minimumMobileTextPx: compactDiagram ? 12 : 0,
            minimumDesktopLabelTextPx: compactDiagram ? 0 : 12,
            labelBoundaryFailures: 0,
            overlappingBoxPairs: 0,
            viewportClientWidth: compactDiagram ? 0 : diagramViewportWidth,
            viewportScrollWidth: diagramScrollWidth,
            horizontalScrollAvailable: !compactDiagram,
            keyboardScrollable: !compactDiagram,
          },
        ]
      : [],
  };
}

function setArchitectureReportCase(value: ResponsiveCaseResult, width: number) {
  value.surfaceId = "architecture-report";
  value.kind = "architecture-report";
  value.area = null;
  value.requestPath = "/greyhoundiq-production-architecture.html";
  value.width = width;
  value.finalUrl =
    "http://localhost:3000/greyhoundiq-production-architecture.html";
  value.snapshot = validSnapshot(
    "architecture-report",
    "architecture-report",
    null,
    width,
  );
}

function setWorkspaceArchitectureCase(
  value: ResponsiveCaseResult,
  width: number,
) {
  value.surfaceId = "workspace-architecture";
  value.kind = "workspace-area";
  value.area = "architecture";
  value.requestPath = "/design-lab?area=architecture";
  value.width = width;
  value.finalUrl = "http://localhost:3000/design-lab?area=architecture";
  value.snapshot = validSnapshot(
    "workspace-architecture",
    "workspace-area",
    "architecture",
    width,
  );
}

function responsiveRepresentationVariants() {
  const desktopCards = structuredClone(
    validResults.find((result) => result.id === "architecture-report@1440")!,
  );
  desktopCards.id = "architecture-report@1440-cards";
  desktopCards.snapshot.tables[0].visible = false;
  desktopCards.snapshot.tables[0].minimumDesktopTextPx = 0;
  desktopCards.snapshot.tables[0].mobileCardsVisible = true;
  desktopCards.snapshot.tables[0].minimumMobileTextPx = 11;

  const compactTable = structuredClone(
    validResults.find((result) => result.id === "architecture-report@390")!,
  );
  compactTable.id = "architecture-report@390-table";
  compactTable.snapshot.tables[0].visible = true;
  compactTable.snapshot.tables[0].tableWidth = 350;
  compactTable.snapshot.tables[0].containerWidth = 350;
  compactTable.snapshot.tables[0].mobileCardsVisible = false;
  compactTable.snapshot.tables[0].minimumMobileTextPx = 0;
  compactTable.snapshot.tables[0].minimumDesktopTextPx = 10;

  const compactSvg = structuredClone(
    validResults.find((result) => result.id === "architecture-report@390")!,
  );
  compactSvg.id = "architecture-report@390-svg";
  compactSvg.snapshot.diagrams[0].diagramViewportVisible = true;
  compactSvg.snapshot.diagrams[0].mobileFlowVisible = false;
  compactSvg.snapshot.diagrams[0].minimumMobileTextPx = 0;
  compactSvg.snapshot.diagrams[0].minimumDesktopLabelTextPx = 12;
  compactSvg.snapshot.diagrams[0].viewportClientWidth = 310;
  compactSvg.snapshot.diagrams[0].viewportScrollWidth = 310;

  return [desktopCards, compactTable, compactSvg];
}

async function assertAtomicWriter() {
  const temporaryRoot = realpathSync(tmpdir());
  const testDirectory = mkdtempSync(
    path.join(temporaryRoot, "greyhoundiq-responsive-write-test-"),
  );
  try {
    const outputPath = path.join(testDirectory, "evidence.json");
    writeFileSync(outputPath, "previous\n", "utf8");
    await writeResponsiveReport(outputPath, "replacement\n");
    assert.equal(readFileSync(outputPath, "utf8"), "replacement\n");
    assert.deepEqual(temporaryFiles(testDirectory), []);

    const invalidTarget = path.join(testDirectory, "directory-target");
    mkdirSync(invalidTarget);
    await assert.rejects(() =>
      writeResponsiveReport(invalidTarget, "rejected\n"),
    );
    assert.equal(readFileSync(outputPath, "utf8"), "replacement\n");
    assert.deepEqual(temporaryFiles(testDirectory), []);
  } finally {
    const canonicalTestDirectory = realpathSync(testDirectory);
    const relativeTestDirectory = path.relative(
      temporaryRoot,
      canonicalTestDirectory,
    );
    assert.equal(path.dirname(relativeTestDirectory), ".");
    assert.match(
      path.basename(relativeTestDirectory),
      /^greyhoundiq-responsive-write-test-/,
    );
    rmSync(canonicalTestDirectory, { recursive: true, force: true });
  }
}

function temporaryFiles(directory: string) {
  return readdirSync(directory).filter((name) => name.endsWith(".tmp"));
}
