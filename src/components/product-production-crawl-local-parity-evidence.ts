import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_EVIDENCE_FILE =
  "src/components/product-production-crawl-local-parity-evidence.ts" as const;
export const PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_TEST_FILE =
  "src/components/product-production-crawl-local-parity-evidence.test.ts" as const;

export const PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_SCOPE =
  "Deterministic verification that every one of the 26 public route patterns captured by the dated 2026-07-13 read-only production crawl is currently registered in the local application. This proves local route-pattern parity for that immutable anonymous snapshot only. It does not prove current production behavior, individual dynamic-record availability, local browser rendering, Design Lab parity, action destinations, labels, target context, redirects, authentication or authorization enforcement, subscriptions, breakpoint-only links, or production readiness.";

export const PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_REQUIREMENT_IDS = [
  "DISC.CRAWL.local-parity",
] as const;

export type ProductProductionCrawlLocalParityRequirementId =
  (typeof PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_REQUIREMENT_IDS)[number];

type ProductProductionCrawlLocalParityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_EVIDENCE_FILE,
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_TEST_FILE,
  "output/product-audit/production-link-audit.json",
  "src/components/product-automated-source-gate-registry.ts",
] as const;

export const PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_MASTER_EVIDENCE = {
  "DISC.CRAWL.local-parity": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductProductionCrawlLocalParityRequirementId,
    ProductProductionCrawlLocalParityEvidenceRecord
  >
>;
