import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_FILE =
  "src/components/product-source-crawl-provenance-evidence.ts" as const;
export const PRODUCT_SOURCE_CRAWL_PROVENANCE_TEST_FILE =
  "src/components/product-source-crawl-provenance-evidence.test.ts" as const;

export const PRODUCT_SOURCE_CRAWL_PROVENANCE_REQUIREMENT_IDS = [
  "DISC.CRAWL.source-route",
  "DISC.CRAWL.source-component",
] as const;

export const PRODUCT_SOURCE_CRAWL_PROVENANCE_EXPECTED_GAIN =
  PRODUCT_SOURCE_CRAWL_PROVENANCE_REQUIREMENT_IDS.length;

export const PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE =
  "Deterministic local source-crawl proof for 5,467 production-owned discovery rows: 2,345 internal-link rows and 3,122 interactive-action rows across the 89 production routes that contain a discovered link or action. Each row records its production owner route, source file, exact line and column, and nearest enclosing named source symbol (with an explicit module fallback). The /statistics route contains no discovered link or action and therefore contributes no provenance row. This closes only source-route and source-component provenance for the current static registry crawl; it does not claim visible or accessible labels, destination or redirect validity, action behavior, permissions, browser rendering, deployed crawling, external-provider behavior, or production readiness.";

export type ProductSourceCrawlProvenanceRecord = {
  id: string;
  kind: "link" | "action";
  sourceRoute: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  sourceComponent: string;
};

export type ProductSourceCrawlProvenanceIssue = {
  code:
    | "DUPLICATE_OBSERVATION"
    | "INVALID_KIND"
    | "OBSERVATION_ID_MISSING"
    | "SOURCE_COMPONENT_MISSING"
    | "SOURCE_FILE_INVALID"
    | "SOURCE_POSITION_INVALID"
    | "SOURCE_ROUTE_INVALID";
  recordId: string;
};

export function findSourceCrawlProvenanceIssues(
  records: readonly ProductSourceCrawlProvenanceRecord[],
): ProductSourceCrawlProvenanceIssue[] {
  const issues: ProductSourceCrawlProvenanceIssue[] = [];
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
    if (!record.sourceComponent.trim()) {
      issues.push({ code: "SOURCE_COMPONENT_MISSING", recordId: record.id });
    }
  }

  return issues;
}

type ProductSourceCrawlProvenanceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_PATHS = [
  PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_FILE,
  PRODUCT_SOURCE_CRAWL_PROVENANCE_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/product-automated-source-gate-registry.ts",
] as const;

export const PRODUCT_SOURCE_CRAWL_PROVENANCE_MASTER_EVIDENCE = {
  "DISC.CRAWL.source-route": {
    status: "tested",
    evidence: PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_PATHS,
  },
  "DISC.CRAWL.source-component": {
    status: "tested",
    evidence: PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_PATHS,
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_SOURCE_CRAWL_PROVENANCE_REQUIREMENT_IDS)[number],
    ProductSourceCrawlProvenanceEvidenceRecord
  >
>;
