import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_CRAWL_DESIGN_LAB_PARITY_EVIDENCE_FILE =
  "src/components/product-crawl-design-lab-parity-evidence.ts" as const;
export const PRODUCT_CRAWL_DESIGN_LAB_PARITY_TEST_FILE =
  "src/components/product-crawl-design-lab-parity-evidence.test.ts" as const;

export const PRODUCT_CRAWL_DESIGN_LAB_PARITY_REQUIREMENT_IDS = [
  "DISC.CRAWL.design-lab-parity",
] as const;

export const PRODUCT_CRAWL_DESIGN_LAB_PARITY_EXPECTED_GAIN =
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_REQUIREMENT_IDS.length;

export const PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE =
  "Deterministic source-static recording for all 2,292 source-resolvable internal-link observations owned by the 89 production screen routes that contain a discovered link. Each observation records its normalized destination, matched application route pattern, and whether that destination has a registered Design Lab screen fixture. The 2,244 page-destination observations record one or more fixture IDs; 41 /sign-in authentication Route Handler observations and seven /api/media/[id]/blob Route Handler observations truthfully record that no Design Lab screen exists and explain why. This closes recording only. It does not claim browser rendering, destination HTTP behavior, redirect-chain behavior, state parity, action parity, deployed parity, external-provider behavior, or production readiness.";

export type ProductCrawlDesignLabParityRecord = {
  id: string;
  sourceRoute: string;
  sourceFile: string;
  normalizedDestination: string;
  matchedRoutePattern: string;
  designLabExists: boolean;
  designLabFixtureIds: readonly string[];
  classification: "design-lab-screen" | "non-screen-route-handler";
  absenceReason: string | null;
};

export type ProductCrawlDesignLabParityIssueCode =
  | "DUPLICATE_OBSERVATION"
  | "SOURCE_ROUTE_INVALID"
  | "SOURCE_FILE_INVALID"
  | "DESTINATION_INVALID"
  | "MATCHED_ROUTE_INVALID"
  | "PARITY_METADATA_INCONSISTENT"
  | "EXPECTED_OBSERVATION_MISSING"
  | "UNEXPECTED_OBSERVATION";

export type ProductCrawlDesignLabParityIssue = {
  code: ProductCrawlDesignLabParityIssueCode;
  recordId: string;
};

export function findProductCrawlDesignLabParityIssues(
  records: readonly ProductCrawlDesignLabParityRecord[],
  expectedObservationIds: readonly string[],
): ProductCrawlDesignLabParityIssue[] {
  const issues: ProductCrawlDesignLabParityIssue[] = [];
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

    const fixtureIds = record.designLabFixtureIds.map((fixtureId) =>
      fixtureId.trim(),
    );
    const validScreenParity =
      record.designLabExists &&
      record.classification === "design-lab-screen" &&
      fixtureIds.length > 0 &&
      fixtureIds.every(Boolean) &&
      new Set(fixtureIds).size === fixtureIds.length &&
      record.absenceReason === null;
    const validRouteHandlerAbsence =
      !record.designLabExists &&
      record.classification === "non-screen-route-handler" &&
      fixtureIds.length === 0 &&
      Boolean(record.absenceReason?.trim());

    if (!validScreenParity && !validRouteHandlerAbsence) {
      issues.push({ code: "PARITY_METADATA_INCONSISTENT", recordId });
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

type ProductCrawlDesignLabParityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_CRAWL_DESIGN_LAB_PARITY_MASTER_EVIDENCE = {
  "DISC.CRAWL.design-lab-parity": {
    status: "tested",
    evidence: [
      PRODUCT_CRAWL_DESIGN_LAB_PARITY_EVIDENCE_FILE,
      PRODUCT_CRAWL_DESIGN_LAB_PARITY_TEST_FILE,
      "src/components/product-automated-source-gate-registry.ts",
      "src/components/demo-experience-registry.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_CRAWL_DESIGN_LAB_PARITY_REQUIREMENT_IDS)[number],
    ProductCrawlDesignLabParityEvidenceRecord
  >
>;
