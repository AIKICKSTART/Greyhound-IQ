import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_FILE =
  "src/components/product-crawl-access-metadata-evidence.ts" as const;
export const PRODUCT_CRAWL_ACCESS_METADATA_TEST_FILE =
  "src/components/product-crawl-access-metadata-evidence.test.ts" as const;

export const PRODUCT_CRAWL_ACCESS_METADATA_REQUIREMENT_IDS = [
  "DISC.CRAWL.role",
  "DISC.CRAWL.subscription",
] as const;

export const PRODUCT_CRAWL_ACCESS_METADATA_EXPECTED_GAIN =
  PRODUCT_CRAWL_ACCESS_METADATA_REQUIREMENT_IDS.length;

export const PRODUCT_CRAWL_ACCESS_METADATA_SCOPE =
  "Deterministic local source-static proof that all 5,279 production-owned discovery rows (2,242 links and 3,037 interactive actions) record their canonical source-screen role and subscription-tier requirements. The exact join covers the 89 production routes containing a discovered row, resolves with no missing or fallback access metadata, preserves nine distinct role sets, and includes 134 paid-only pro/pro_plus rows rather than applying one global default. The /statistics route contains no discovered link or action and therefore contributes no access-metadata row. This closes only recorded source-screen eligibility metadata; it does not claim action-specific server authorization, runtime session state, billing-provider state, browser visibility, deployed crawling, destination access, or production readiness.";

export type ProductCrawlAccessMetadataRecord = {
  id: string;
  kind: "link" | "action";
  sourceRoute: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  roleRequirements: readonly string[];
  canonicalRoles: readonly string[];
  subscriptionRequirements: readonly string[];
  canonicalSubscriptions: readonly string[];
};

export type ProductCrawlAccessMetadataIssue = {
  code:
    | "DUPLICATE_OBSERVATION"
    | "INVALID_KIND"
    | "OBSERVATION_ID_MISSING"
    | "ROLE_METADATA_INVALID"
    | "ROLE_METADATA_MISMATCH"
    | "SOURCE_FILE_INVALID"
    | "SOURCE_POSITION_INVALID"
    | "SOURCE_ROUTE_INVALID"
    | "SUBSCRIPTION_METADATA_INVALID"
    | "SUBSCRIPTION_METADATA_MISMATCH";
  recordId: string;
};

function invalidValues(values: readonly string[]) {
  return (
    values.length === 0 ||
    values.some((value) => !value.trim()) ||
    new Set(values).size !== values.length
  );
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function findCrawlAccessMetadataIssues(
  records: readonly ProductCrawlAccessMetadataRecord[],
): ProductCrawlAccessMetadataIssue[] {
  const issues: ProductCrawlAccessMetadataIssue[] = [];
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
    if (
      invalidValues(record.roleRequirements) ||
      invalidValues(record.canonicalRoles)
    ) {
      issues.push({ code: "ROLE_METADATA_INVALID", recordId: record.id });
    } else if (!sameValues(record.roleRequirements, record.canonicalRoles)) {
      issues.push({ code: "ROLE_METADATA_MISMATCH", recordId: record.id });
    }
    if (
      invalidValues(record.subscriptionRequirements) ||
      invalidValues(record.canonicalSubscriptions)
    ) {
      issues.push({
        code: "SUBSCRIPTION_METADATA_INVALID",
        recordId: record.id,
      });
    } else if (
      !sameValues(
        record.subscriptionRequirements,
        record.canonicalSubscriptions,
      )
    ) {
      issues.push({
        code: "SUBSCRIPTION_METADATA_MISMATCH",
        recordId: record.id,
      });
    }
  }

  return issues;
}

type ProductCrawlAccessMetadataEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_PATHS = [
  PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_FILE,
  PRODUCT_CRAWL_ACCESS_METADATA_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/product-automated-source-gate-registry.ts",
] as const;

export const PRODUCT_CRAWL_ACCESS_METADATA_MASTER_EVIDENCE = {
  "DISC.CRAWL.role": {
    status: "tested",
    evidence: PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_PATHS,
  },
  "DISC.CRAWL.subscription": {
    status: "tested",
    evidence: PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_PATHS,
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_CRAWL_ACCESS_METADATA_REQUIREMENT_IDS)[number],
    ProductCrawlAccessMetadataEvidenceRecord
  >
>;
