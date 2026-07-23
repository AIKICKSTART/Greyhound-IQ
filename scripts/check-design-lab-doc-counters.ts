import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import { isDesignLabDatabaseOperationComplete } from "../src/components/design-lab-database-contracts";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  isDesignLabPreproductionRequirementComplete,
} from "../src/components/design-lab-preproduction-requirements";
import { DESIGN_LAB_RELEASE_GATE } from "../src/components/design-lab-release-gate";
import { SCREEN_CONTRACT_CHECKLIST } from "../src/components/demo-experience-registry";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";

const PRODUCT_REPORTS = [
  "docs/product/design-lab-coverage.md",
  "docs/product/final-audit-report.md",
] as const;
const SECURITY_REPORT = "docs/security/release-security-report.md";
const SCREEN_REPORTS = {
  route: "docs/product/route-inventory.md",
  userStories: "docs/product/user-story-matrix.md",
  actions: "docs/product/action-inventory.md",
  forms: "docs/product/form-field-registry.md",
  permissions: "docs/product/permissions-matrix.md",
  states: "docs/product/state-matrix.md",
  onboarding: "docs/product/onboarding-map.md",
} as const;

const productRequirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) => requirement.prompt === "product",
);
const securityRequirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) => requirement.prompt === "security",
);
const completedProductRequirements = productRequirements.filter(
  isMasterRequirementComplete,
).length;
const completedSecurityRequirements = securityRequirements.filter(
  isMasterRequirementComplete,
).length;
const completedScreenChecks = SCREEN_CONTRACT_CHECKLIST.reduce(
  (total, item) => total + item.completed,
  0,
);
const totalScreenChecks = SCREEN_CONTRACT_CHECKLIST.reduce(
  (total, item) => total + item.total,
  0,
);
const completedPreproductionRequirements =
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    isDesignLabPreproductionRequirementComplete,
  ).length;
const completedDatabaseOperations = DATABASE_OPERATIONS.filter(
  isDesignLabDatabaseOperationComplete,
).length;

/** Canonical aggregate block rendered in both product completion reports. */
export const DESIGN_LAB_DOCUMENTATION_COUNTER_BLOCK = [
  "<!-- design-lab-live-counters:start -->",
  "| Gate slice | Complete | Total | Open |",
  "| --- | ---: | ---: | ---: |",
  counterRow(
    "Aggregate production gate",
    DESIGN_LAB_RELEASE_GATE.completedChecks,
    DESIGN_LAB_RELEASE_GATE.totalChecks,
  ),
  counterRow("Screen contracts", completedScreenChecks, totalScreenChecks),
  counterRow(
    "Master requirements",
    completedProductRequirements + completedSecurityRequirements,
    productRequirements.length + securityRequirements.length,
  ),
  counterRow(
    "Product master requirements",
    completedProductRequirements,
    productRequirements.length,
  ),
  counterRow(
    "Security master requirements",
    completedSecurityRequirements,
    securityRequirements.length,
  ),
  counterRow(
    "Pre-production requirements",
    completedPreproductionRequirements,
    DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.length,
  ),
  counterRow(
    "Database operation contracts",
    completedDatabaseOperations,
    DATABASE_OPERATIONS.length,
  ),
  "<!-- design-lab-live-counters:end -->",
].join("\n");

/** Canonical nine-area screen-coverage block rendered in the coverage report. */
export const DESIGN_LAB_SCREEN_COUNTER_BLOCK = [
  "<!-- design-lab-screen-counters:start -->",
  "| Coverage area | Total | Complete | Captured only | Blocked | Open |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...SCREEN_CONTRACT_CHECKLIST.map(
    (item) =>
      `| ${formatCoverageArea(item.area)} | ${item.total} | ${item.completed} | ${item.captured} | ${item.blocked} | ${item.remaining} |`,
  ),
  "<!-- design-lab-screen-counters:end -->",
].join("\n");

/** Route-area counter blocks rendered in their owning product audit reports. */
export const DESIGN_LAB_SCREEN_REPORT_COUNTER_BLOCKS = Object.fromEntries(
  Object.keys(SCREEN_REPORTS).map((area) => {
    const checklistItem = SCREEN_CONTRACT_CHECKLIST.find(
      (item) => item.area === area,
    );
    if (!checklistItem) {
      throw new Error(`Missing screen checklist area: ${area}`);
    }
    return [
      area,
      [
        `<!-- design-lab-${area}-counter:start -->`,
        "| Registry state | Count |",
        "| --- | ---: |",
        `| Complete | ${checklistItem.completed} |`,
        `| Captured only | ${checklistItem.captured} |`,
        `| Explicitly blocked | ${checklistItem.blocked} |`,
        `| Open | ${checklistItem.remaining} |`,
        `| Total | ${checklistItem.total} |`,
        `<!-- design-lab-${area}-counter:end -->`,
      ].join("\n"),
    ];
  }),
) as Record<keyof typeof SCREEN_REPORTS, string>;

/** Canonical status distribution rendered in the release security report. */
export const DESIGN_LAB_SECURITY_STATUS_BLOCK = [
  "<!-- design-lab-security-status:start -->",
  "| Master security status | Count |",
  "| --- | ---: |",
  ...["verified", "partially-verified", "not-assessed"].map(
    (status) =>
      `| ${formatStatus(status)} | ${securityRequirements.filter((requirement) => requirement.status === status).length} |`,
  ),
  "<!-- design-lab-security-status:end -->",
].join("\n");

/**
 * Compares every managed Markdown counter block with the current registries.
 * The optional root exists only for isolated negative tests.
 */
export function collectDesignLabDocumentationCounterIssues(
  documentationRoot = process.cwd(),
) {
  const issues: string[] = [];

  for (const report of PRODUCT_REPORTS) {
    const source = normalize(
      readFileSync(join(documentationRoot, report), "utf8"),
    );
    requireExactBlock(
      report,
      source,
      "<!-- design-lab-live-counters:start -->",
      "<!-- design-lab-live-counters:end -->",
      DESIGN_LAB_DOCUMENTATION_COUNTER_BLOCK,
      issues,
    );
  }

  const coverageSource = normalize(
    readFileSync(
      join(documentationRoot, "docs/product/design-lab-coverage.md"),
      "utf8",
    ),
  );
  requireExactBlock(
    "docs/product/design-lab-coverage.md",
    coverageSource,
    "<!-- design-lab-screen-counters:start -->",
    "<!-- design-lab-screen-counters:end -->",
    DESIGN_LAB_SCREEN_COUNTER_BLOCK,
    issues,
  );

  for (const [area, report] of Object.entries(SCREEN_REPORTS)) {
    const source = normalize(
      readFileSync(join(documentationRoot, report), "utf8"),
    );
    requireExactBlock(
      report,
      source,
      `<!-- design-lab-${area}-counter:start -->`,
      `<!-- design-lab-${area}-counter:end -->`,
      DESIGN_LAB_SCREEN_REPORT_COUNTER_BLOCKS[
        area as keyof typeof SCREEN_REPORTS
      ],
      issues,
    );
  }

  const securitySource = normalize(
    readFileSync(join(documentationRoot, SECURITY_REPORT), "utf8"),
  );
  requireExactBlock(
    SECURITY_REPORT,
    securitySource,
    "<!-- design-lab-security-status:start -->",
    "<!-- design-lab-security-status:end -->",
    DESIGN_LAB_SECURITY_STATUS_BLOCK,
    issues,
  );

  return issues;
}

/** Replaces only managed counter blocks and leaves report prose untouched. */
export function writeDesignLabDocumentationCounters(
  documentationRoot = process.cwd(),
) {
  const replacements = new Map<
    string,
    Array<{ start: string; end: string; expected: string }>
  >();

  for (const report of PRODUCT_REPORTS) {
    addReplacement(
      report,
      "<!-- design-lab-live-counters:start -->",
      "<!-- design-lab-live-counters:end -->",
      DESIGN_LAB_DOCUMENTATION_COUNTER_BLOCK,
    );
  }
  addReplacement(
    "docs/product/design-lab-coverage.md",
    "<!-- design-lab-screen-counters:start -->",
    "<!-- design-lab-screen-counters:end -->",
    DESIGN_LAB_SCREEN_COUNTER_BLOCK,
  );
  for (const [area, report] of Object.entries(SCREEN_REPORTS)) {
    addReplacement(
      report,
      `<!-- design-lab-${area}-counter:start -->`,
      `<!-- design-lab-${area}-counter:end -->`,
      DESIGN_LAB_SCREEN_REPORT_COUNTER_BLOCKS[
        area as keyof typeof SCREEN_REPORTS
      ],
    );
  }
  addReplacement(
    SECURITY_REPORT,
    "<!-- design-lab-security-status:start -->",
    "<!-- design-lab-security-status:end -->",
    DESIGN_LAB_SECURITY_STATUS_BLOCK,
  );

  const updates = [...replacements].flatMap(([report, blocks]) => {
    const path = join(documentationRoot, report);
    const source = readFileSync(path, "utf8");
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const updated = blocks.reduce(
      (value, block) =>
        replaceManagedBlock(
          report,
          value,
          block.start,
          block.end,
          block.expected.replace(/\n/g, newline),
        ),
      source,
    );
    return updated === source ? [] : [{ path, report, updated }];
  });

  for (const update of updates) {
    writeFileSync(update.path, update.updated);
  }

  return updates.map((update) => update.report);

  function addReplacement(
    report: string,
    start: string,
    end: string,
    expected: string,
  ) {
    const reportReplacements = replacements.get(report) ?? [];
    reportReplacements.push({ start, end, expected });
    replacements.set(report, reportReplacements);
  }
}

const rootArgument = process.argv.slice(2).find((argument) =>
  argument.startsWith("--root="),
);
const writeMode = process.argv.slice(2).includes("--write");
const unknownArguments = process.argv
  .slice(2)
  .filter(
    (argument) => argument !== "--write" && !argument.startsWith("--root="),
  );
if (unknownArguments.length > 0) {
  console.error(`Unknown argument: ${unknownArguments[0]}`);
  process.exit(1);
}

const documentationRoot = resolve(rootArgument?.slice("--root=".length) || ".");
if (writeMode) {
  const updatedReports = writeDesignLabDocumentationCounters(documentationRoot);
  console.log(
    updatedReports.length > 0
      ? `Updated Design Lab documentation counters:\n${updatedReports.map((report) => `- ${report}`).join("\n")}`
      : "Design Lab documentation counters were already current.",
  );
}
const issues = collectDesignLabDocumentationCounterIssues(documentationRoot);
if (issues.length > 0) {
  console.error("Design Lab documentation counters are out of sync:");
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log("Design Lab documentation counters match the live registries.");

function counterRow(label: string, completed: number, total: number) {
  return `| ${label} | ${completed} | ${total} | ${total - completed} |`;
}

function formatCoverageArea(area: string) {
  return area
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatStatus(status: string) {
  return status
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function normalize(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function requireExactBlock(
  report: string,
  source: string,
  startMarker: string,
  endMarker: string,
  expected: string,
  issues: string[],
) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    issues.push(`${report} is missing the managed counter block ${startMarker}`);
    return;
  }

  const actual = source.slice(start, end + endMarker.length);
  if (actual !== expected) {
    issues.push(`${report} does not match the current machine registries`);
  }
}

function replaceManagedBlock(
  report: string,
  source: string,
  startMarker: string,
  endMarker: string,
  expected: string,
) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `${report} is missing the managed counter block ${startMarker}`,
    );
  }
  return `${source.slice(0, start)}${expected}${source.slice(end + endMarker.length)}`;
}
