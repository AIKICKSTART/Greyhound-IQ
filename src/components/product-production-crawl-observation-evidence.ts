import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PRODUCTION_CRAWL_OBSERVATION_EVIDENCE_FILE =
  "src/components/product-production-crawl-observation-evidence.ts" as const;
export const PRODUCT_PRODUCTION_CRAWL_OBSERVATION_TEST_FILE =
  "src/components/product-production-crawl-observation-evidence.test.ts" as const;

export const PRODUCT_PRODUCTION_CRAWL_OBSERVATION_SCOPE =
  "Deterministic verification of five fields recorded for every route pattern in the immutable 2026-07-13 anonymous production crawl: observed HTTP status, observed authentication posture, dynamic parameters, query parameters, and target context. The target-context conclusion applies to all 2,448 observed internal edges because every observed target used the current tab. This proves only what the dated read-only public crawl recorded; it does not prove current production behavior, authenticated or privileged routes, authorization enforcement, parameter validation, action results, redirects, labels, breakpoint completeness, deployed parity, or production readiness.";

export const PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS = [
  "DISC.CRAWL.http-status",
  "DISC.CRAWL.authentication",
  "DISC.CRAWL.dynamic-parameters",
  "DISC.CRAWL.query-parameters",
  "DISC.CRAWL.target-context",
] as const;

export type ProductProductionCrawlObservationRequirementId =
  (typeof PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS)[number];

export const PRODUCT_PRODUCTION_CRAWL_OBSERVATION_EXPECTED_GAIN =
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS.length;

type ProductProductionCrawlObservationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_EVIDENCE_FILE,
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_TEST_FILE,
  "output/product-audit/production-link-audit.json",
] as const;

export const PRODUCT_PRODUCTION_CRAWL_OBSERVATION_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        { status: "tested" as const, evidence: EVIDENCE },
      ],
    ),
  ) as unknown as Readonly<
    Record<
      ProductProductionCrawlObservationRequirementId,
      ProductProductionCrawlObservationEvidenceRecord
    >
  >;
