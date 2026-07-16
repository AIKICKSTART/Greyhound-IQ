import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_CRAWL_ACCESSIBLE_LABEL_EVIDENCE_FILE =
  "src/components/product-crawl-accessible-label-evidence.ts" as const;
export const PRODUCT_CRAWL_ACCESSIBLE_LABEL_TEST_FILE =
  "src/components/product-crawl-accessible-label-evidence.test.ts" as const;

export const PRODUCT_CRAWL_ACCESSIBLE_LABEL_REQUIREMENT_ID =
  "DISC.CRAWL.accessible-label" as const;

export const PRODUCT_CRAWL_ACCESSIBLE_LABEL_SCOPE =
  "Deterministic local source-crawl inventory for all 5,279 production-owned discovery rows: 2,242 internal-link rows and 3,037 interactive-action rows across the 89 production routes with a discovered link or action. Each row records one or more source-level accessible-name candidates or one explicit absence reason. Candidate provenance covers explicit ARIA naming attributes, accessible descendant content, associated labels, component label properties, and HTML naming attributes. This closes only accessible-label recording for the current static source crawl; it does not prove the browser-computed accessible name, referenced-element resolution, runtime values, assistive-technology output, rendered visibility, action behavior, deployed crawling, or production readiness.";

export type ProductCrawlAccessibleLabelSource = {
  kind:
    | "aria-label"
    | "aria-labelledby"
    | "associated-label"
    | "content"
    | "html-naming-attribute"
    | "label-property";
  value: string;
};

export type ProductCrawlAccessibleLabelRecord = {
  id: string;
  kind: "action" | "link";
  sourceRoute: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  accessibleLabelSources: readonly ProductCrawlAccessibleLabelSource[];
  absenceReason: string | null;
};

export type ProductCrawlAccessibleLabelIssue = {
  code:
    | "ABSENCE_REASON_CONFLICT"
    | "ABSENCE_REASON_MISSING"
    | "DUPLICATE_LABEL_SOURCE"
    | "DUPLICATE_OBSERVATION"
    | "INVALID_KIND"
    | "INVALID_LABEL_SOURCE_KIND"
    | "LABEL_SOURCE_BLANK"
    | "OBSERVATION_ID_MISSING"
    | "SOURCE_FILE_INVALID"
    | "SOURCE_POSITION_INVALID"
    | "SOURCE_ROUTE_INVALID";
  recordId: string;
};

const LABEL_SOURCE_KINDS = new Set<ProductCrawlAccessibleLabelSource["kind"]>([
  "aria-label",
  "aria-labelledby",
  "associated-label",
  "content",
  "html-naming-attribute",
  "label-property",
]);

export function findCrawlAccessibleLabelIssues(
  records: readonly ProductCrawlAccessibleLabelRecord[],
): ProductCrawlAccessibleLabelIssue[] {
  const issues: ProductCrawlAccessibleLabelIssue[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    const recordId = record.id.trim();
    if (!recordId) {
      issues.push({ code: "OBSERVATION_ID_MISSING", recordId: record.id });
    } else if (seenIds.has(recordId)) {
      issues.push({ code: "DUPLICATE_OBSERVATION", recordId });
    }
    seenIds.add(recordId);

    if (record.kind !== "link" && record.kind !== "action") {
      issues.push({ code: "INVALID_KIND", recordId: record.id });
    }
    if (!record.sourceRoute.startsWith("/")) {
      issues.push({ code: "SOURCE_ROUTE_INVALID", recordId: record.id });
    }
    if (!record.sourceFile.startsWith("src/")) {
      issues.push({ code: "SOURCE_FILE_INVALID", recordId: record.id });
    }
    if (
      !Number.isInteger(record.sourceLine) ||
      record.sourceLine < 1 ||
      !Number.isInteger(record.sourceColumn) ||
      record.sourceColumn < 1
    ) {
      issues.push({ code: "SOURCE_POSITION_INVALID", recordId: record.id });
    }

    if (record.accessibleLabelSources.length === 0) {
      if (!record.absenceReason?.trim()) {
        issues.push({ code: "ABSENCE_REASON_MISSING", recordId: record.id });
      }
      continue;
    }
    if (record.absenceReason !== null) {
      issues.push({ code: "ABSENCE_REASON_CONFLICT", recordId: record.id });
    }

    const seenSources = new Set<string>();
    for (const source of record.accessibleLabelSources) {
      if (!LABEL_SOURCE_KINDS.has(source.kind)) {
        issues.push({ code: "INVALID_LABEL_SOURCE_KIND", recordId: record.id });
      }
      if (!source.value.trim() || source.value !== source.value.trim()) {
        issues.push({ code: "LABEL_SOURCE_BLANK", recordId: record.id });
      }
      const key = `${source.kind}:${source.value}`;
      if (seenSources.has(key)) {
        issues.push({ code: "DUPLICATE_LABEL_SOURCE", recordId: record.id });
      }
      seenSources.add(key);
    }
  }

  return issues;
}

type ProductCrawlAccessibleLabelEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_CRAWL_ACCESSIBLE_LABEL_MASTER_EVIDENCE = {
  [PRODUCT_CRAWL_ACCESSIBLE_LABEL_REQUIREMENT_ID]: {
    status: "tested",
    evidence: [
      PRODUCT_CRAWL_ACCESSIBLE_LABEL_EVIDENCE_FILE,
      PRODUCT_CRAWL_ACCESSIBLE_LABEL_TEST_FILE,
      "src/components/product-automated-source-gate-registry.ts",
      "src/components/demo-experience-registry.ts",
    ],
  },
} as const satisfies Readonly<
  Record<string, ProductCrawlAccessibleLabelEvidenceRecord>
>;
