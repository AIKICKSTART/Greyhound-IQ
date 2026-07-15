import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_CRAWL_STATE_COVERAGE_EVIDENCE_FILE =
  "src/components/product-crawl-state-coverage-evidence.ts" as const;
export const PRODUCT_CRAWL_STATE_COVERAGE_TEST_FILE =
  "src/components/product-crawl-state-coverage-evidence.test.ts" as const;

export const PRODUCT_CRAWL_STATE_COVERAGE_REQUIREMENT_IDS = [
  "DISC.CRAWL.state-coverage",
] as const;

export const PRODUCT_CRAWL_STATE_COVERAGE_EXPECTED_GAIN =
  PRODUCT_CRAWL_STATE_COVERAGE_REQUIREMENT_IDS.length;

export const PRODUCT_CRAWL_STATE_COVERAGE_SCOPE =
  "Deterministic source-static recording for all 2,292 source-resolvable internal-link observations owned by the 89 production screen routes that contain a discovered link. Each observation records its matched destination, every canonical registered state ID, the exact loading, empty and error state subsets, the missing state families, and whether all three families are present. Thirty-three observations across three destination patterns record complete loading, empty and error coverage; the other 2,259 observations truthfully record the missing families, including 48 non-screen Route Handler destinations with no screen-state contract. State families use explicit canonical ID suffixes only: LOADING; EMPTY, EMPTY-* or NO-MATCHES; and ERROR, RECOVERABLE-ERROR or UNAVAILABLE. This closes recording only. It does not claim that incomplete destinations are complete, distinct reproducible fixtures, browser rendering, state transitions, deployed behavior, provider behavior, action behavior, or production readiness.";

export type ProductCrawlStateFamily = "loading" | "empty" | "error";

export type ProductCrawlStateCoverageRecord = {
  id: string;
  sourceRoute: string;
  sourceFile: string;
  normalizedDestination: string;
  matchedRoutePattern: string;
  destinationKind: "screen" | "route-handler";
  stateIds: readonly string[];
  loadingStateIds: readonly string[];
  emptyStateIds: readonly string[];
  errorStateIds: readonly string[];
  missingStateFamilies: readonly ProductCrawlStateFamily[];
  complete: boolean;
};

export type ProductCrawlStateCoverageIssueCode =
  | "DUPLICATE_OBSERVATION"
  | "SOURCE_ROUTE_INVALID"
  | "SOURCE_FILE_INVALID"
  | "DESTINATION_INVALID"
  | "MATCHED_ROUTE_INVALID"
  | "STATE_IDS_INVALID"
  | "DESTINATION_KIND_INCONSISTENT"
  | "STATE_CLASSIFICATION_INCONSISTENT"
  | "COMPLETENESS_INCONSISTENT"
  | "EXPECTED_OBSERVATION_MISSING"
  | "UNEXPECTED_OBSERVATION";

export type ProductCrawlStateCoverageIssue = {
  code: ProductCrawlStateCoverageIssueCode;
  recordId: string;
};

export function classifyProductCrawlStateIds(stateIds: readonly string[]) {
  const loadingStateIds = stateIds.filter((stateId) =>
    stateId.endsWith(".LOADING"),
  );
  const emptyStateIds = stateIds.filter((stateId) =>
    /\.(?:EMPTY(?:-[A-Z0-9-]+)?|NO-MATCHES)$/.test(stateId),
  );
  const errorStateIds = stateIds.filter((stateId) =>
    /\.(?:ERROR|RECOVERABLE-ERROR|UNAVAILABLE)$/.test(stateId),
  );
  const missingStateFamilies: ProductCrawlStateFamily[] = [];
  if (loadingStateIds.length === 0) missingStateFamilies.push("loading");
  if (emptyStateIds.length === 0) missingStateFamilies.push("empty");
  if (errorStateIds.length === 0) missingStateFamilies.push("error");

  return {
    loadingStateIds,
    emptyStateIds,
    errorStateIds,
    missingStateFamilies,
    complete: missingStateFamilies.length === 0,
  } as const;
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function findProductCrawlStateCoverageIssues(
  records: readonly ProductCrawlStateCoverageRecord[],
  expectedObservationIds: readonly string[],
): ProductCrawlStateCoverageIssue[] {
  const issues: ProductCrawlStateCoverageIssue[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    const recordId = record.id.trim();
    if (seenIds.has(recordId)) {
      issues.push({ code: "DUPLICATE_OBSERVATION", recordId });
    }
    seenIds.add(recordId);

    if (!record.sourceRoute.startsWith("/")) {
      issues.push({ code: "SOURCE_ROUTE_INVALID", recordId });
    }
    if (!record.sourceFile.startsWith("src/")) {
      issues.push({ code: "SOURCE_FILE_INVALID", recordId });
    }
    if (!record.normalizedDestination.startsWith("/")) {
      issues.push({ code: "DESTINATION_INVALID", recordId });
    }
    if (!record.matchedRoutePattern.startsWith("/")) {
      issues.push({ code: "MATCHED_ROUTE_INVALID", recordId });
    }

    const stateIds = record.stateIds.map((stateId) => stateId.trim());
    if (
      stateIds.some((stateId) => !stateId) ||
      new Set(stateIds).size !== stateIds.length
    ) {
      issues.push({ code: "STATE_IDS_INVALID", recordId });
    }
    if (
      (record.destinationKind === "screen" && stateIds.length === 0) ||
      (record.destinationKind === "route-handler" && stateIds.length !== 0)
    ) {
      issues.push({ code: "DESTINATION_KIND_INCONSISTENT", recordId });
    }

    const expected = classifyProductCrawlStateIds(stateIds);
    if (
      !sameValues(record.loadingStateIds, expected.loadingStateIds) ||
      !sameValues(record.emptyStateIds, expected.emptyStateIds) ||
      !sameValues(record.errorStateIds, expected.errorStateIds)
    ) {
      issues.push({ code: "STATE_CLASSIFICATION_INCONSISTENT", recordId });
    }
    if (
      !sameValues(record.missingStateFamilies, expected.missingStateFamilies) ||
      record.complete !== expected.complete
    ) {
      issues.push({ code: "COMPLETENESS_INCONSISTENT", recordId });
    }
  }

  const expectedIds = new Set(expectedObservationIds);
  for (const expectedId of expectedIds) {
    if (!seenIds.has(expectedId)) {
      issues.push({
        code: "EXPECTED_OBSERVATION_MISSING",
        recordId: expectedId,
      });
    }
  }
  for (const recordId of seenIds) {
    if (!expectedIds.has(recordId)) {
      issues.push({ code: "UNEXPECTED_OBSERVATION", recordId });
    }
  }

  return issues;
}

type ProductCrawlStateCoverageEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_CRAWL_STATE_COVERAGE_MASTER_EVIDENCE = {
  "DISC.CRAWL.state-coverage": {
    status: "tested",
    evidence: [
      PRODUCT_CRAWL_STATE_COVERAGE_EVIDENCE_FILE,
      PRODUCT_CRAWL_STATE_COVERAGE_TEST_FILE,
      "src/components/product-automated-source-gate-registry.ts",
      "src/components/demo-experience-registry.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_CRAWL_STATE_COVERAGE_REQUIREMENT_IDS)[number],
    ProductCrawlStateCoverageEvidenceRecord
  >
>;
