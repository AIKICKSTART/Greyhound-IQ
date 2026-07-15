import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_CRAWL_VISIBLE_LABEL_EVIDENCE_FILE =
  "src/components/product-crawl-visible-label-evidence.ts" as const;
export const PRODUCT_CRAWL_VISIBLE_LABEL_TEST_FILE =
  "src/components/product-crawl-visible-label-evidence.test.ts" as const;

export const PRODUCT_CRAWL_VISIBLE_LABEL_REQUIREMENT_ID =
  "DISC.CRAWL.visible-label" as const;

export const PRODUCT_CRAWL_VISIBLE_LABEL_SCOPE =
  "Deterministic local source-crawl inventory for all 5,408 production-owned discovery rows: 2,292 internal-link rows and 3,116 interactive-action rows across the 89 production routes with a discovered link or action. Exactly 3,172 rows record directly source-visible static text, dynamic expression, visible label/title/placeholder attribute, or navigation-object label property; the other 2,236 rows record one explicit source-visible absence reason. Accessible-only names are deliberately not counted as visible labels. This closes only visible-label recording for the current static source crawl; it does not prove rendered text, dynamic runtime values, responsive visibility, accessible naming, action behavior, deployed crawling, or production readiness.";

export type ProductCrawlVisibleLabelSource = {
  kind:
    | "dynamic-expression"
    | "label-property"
    | "static-text"
    | "visible-attribute";
  value: string;
};

export type ProductCrawlVisibleLabelRecord = {
  id: string;
  kind: "action" | "link";
  sourceRoute: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  visibleLabelSources: readonly ProductCrawlVisibleLabelSource[];
  absenceReason: string | null;
};

export type ProductCrawlVisibleLabelIssue = {
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

const LABEL_SOURCE_KINDS = new Set<ProductCrawlVisibleLabelSource["kind"]>([
  "dynamic-expression",
  "label-property",
  "static-text",
  "visible-attribute",
]);

export function findCrawlVisibleLabelIssues(
  records: readonly ProductCrawlVisibleLabelRecord[],
): ProductCrawlVisibleLabelIssue[] {
  const issues: ProductCrawlVisibleLabelIssue[] = [];
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

    if (record.visibleLabelSources.length === 0) {
      if (!record.absenceReason?.trim()) {
        issues.push({ code: "ABSENCE_REASON_MISSING", recordId: record.id });
      }
      continue;
    }
    if (record.absenceReason !== null) {
      issues.push({ code: "ABSENCE_REASON_CONFLICT", recordId: record.id });
    }

    const seenSources = new Set<string>();
    for (const source of record.visibleLabelSources) {
      if (!LABEL_SOURCE_KINDS.has(source.kind)) {
        issues.push({
          code: "INVALID_LABEL_SOURCE_KIND",
          recordId: record.id,
        });
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

type ProductCrawlVisibleLabelEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_CRAWL_VISIBLE_LABEL_MASTER_EVIDENCE = {
  [PRODUCT_CRAWL_VISIBLE_LABEL_REQUIREMENT_ID]: {
    status: "tested",
    evidence: [
      PRODUCT_CRAWL_VISIBLE_LABEL_EVIDENCE_FILE,
      PRODUCT_CRAWL_VISIBLE_LABEL_TEST_FILE,
      "src/components/product-automated-source-gate-registry.ts",
      "src/components/demo-experience-registry.ts",
    ],
  },
} as const satisfies Readonly<
  Record<string, ProductCrawlVisibleLabelEvidenceRecord>
>;
