import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_NON_NAVIGATION_LINK_EVIDENCE_FILE =
  "src/components/product-non-navigation-link-inclusion-evidence.ts" as const;
export const PRODUCT_NON_NAVIGATION_LINK_TEST_FILE =
  "src/components/product-non-navigation-link-inclusion-evidence.test.ts" as const;

export const PRODUCT_NON_NAVIGATION_LINK_REQUIREMENT_IDS = [
  "DISC.CRAWL.non-nav-links",
] as const;

export const PRODUCT_NON_NAVIGATION_LINK_EXPECTED_GAIN =
  PRODUCT_NON_NAVIGATION_LINK_REQUIREMENT_IDS.length;

export const PRODUCT_NON_NAVIGATION_LINK_CATEGORIES = [
  "footer",
  "legal",
  "login-return",
  "dynamic-record",
  "email",
  "notification",
] as const;

export type ProductNonNavigationLinkCategory =
  (typeof PRODUCT_NON_NAVIGATION_LINK_CATEGORIES)[number];

export const PRODUCT_NON_NAVIGATION_LINK_SCOPE =
  "Deterministic local source-static proof that the production-reachable crawl includes all six non-navigation categories required by DISC.CRAWL.non-nav-links. The focused inventory records 144 category-tagged exact source rows: 18 footer target declarations, the six legal declarations within that footer set, seven login-return crawl rows, 111 dynamic-record route rows across 43 source files, one production mailto link, and one rendered notification-record link; the latter categories also retain their existing non-empty production-reachable interaction inventory checks. These rows come from footer, route, profile, account and feature components rather than a sitemap or top-navigation-only list. This closes only source inclusion for these six categories; it does not claim browser visibility, clickability, accessibility, destination HTTP status, redirect behavior, authentication-provider behavior, notification delivery, deployed crawling, or production readiness.";

export type ProductNonNavigationLinkRecord = {
  id: string;
  category: ProductNonNavigationLinkCategory;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  sourceComponent: string;
  targetSignal: string;
};

export type ProductNonNavigationLinkIssue = {
  code:
    | "DUPLICATE_OBSERVATION"
    | "INVALID_CATEGORY"
    | "OBSERVATION_ID_MISSING"
    | "REQUIRED_CATEGORY_MISSING"
    | "SOURCE_COMPONENT_MISSING"
    | "SOURCE_FILE_INVALID"
    | "SOURCE_POSITION_INVALID"
    | "TARGET_SIGNAL_MISSING";
  recordId: string;
};

export function findNonNavigationLinkIssues(
  records: readonly ProductNonNavigationLinkRecord[],
): ProductNonNavigationLinkIssue[] {
  const issues: ProductNonNavigationLinkIssue[] = [];
  const seenIds = new Set<string>();
  const seenCategories = new Set<ProductNonNavigationLinkCategory>();

  for (const record of records) {
    const recordId = record.id.trim();
    if (!recordId) {
      issues.push({ code: "OBSERVATION_ID_MISSING", recordId: record.id });
    } else if (seenIds.has(recordId)) {
      issues.push({ code: "DUPLICATE_OBSERVATION", recordId });
    }
    seenIds.add(recordId);

    if (
      !PRODUCT_NON_NAVIGATION_LINK_CATEGORIES.includes(
        record.category as ProductNonNavigationLinkCategory,
      )
    ) {
      issues.push({ code: "INVALID_CATEGORY", recordId: record.id });
    } else {
      seenCategories.add(record.category);
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
    if (!record.targetSignal.trim()) {
      issues.push({ code: "TARGET_SIGNAL_MISSING", recordId: record.id });
    }
  }

  for (const category of PRODUCT_NON_NAVIGATION_LINK_CATEGORIES) {
    if (!seenCategories.has(category)) {
      issues.push({ code: "REQUIRED_CATEGORY_MISSING", recordId: category });
    }
  }

  return issues;
}

type ProductNonNavigationLinkEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_NON_NAVIGATION_LINK_MASTER_EVIDENCE = {
  "DISC.CRAWL.non-nav-links": {
    status: "tested",
    evidence: [
      PRODUCT_NON_NAVIGATION_LINK_EVIDENCE_FILE,
      PRODUCT_NON_NAVIGATION_LINK_TEST_FILE,
      "src/components/product-automated-source-gate-registry.ts",
      "src/components/product-source-interaction-evidence.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_NON_NAVIGATION_LINK_REQUIREMENT_IDS)[number],
    ProductNonNavigationLinkEvidenceRecord
  >
>;
