import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_SORT_PAGINATION_EVIDENCE_FILE =
  "src/components/product-marketplace-sort-pagination-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_SORT_PAGINATION_TEST_FILE =
  "src/components/product-marketplace-sort-pagination-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE =
  "Focused source and unit verification that the marketplace exposes three allowlisted sort orders plus its default order, parses and caps page input, applies a bounded database offset, fetches one look-ahead record, uses deterministic tie-breakers, and preserves active search, category, and sort state in previous and next links. This does not prove hydrated browser navigation, production database performance at the page cap, exact total-result counts, or deployed concurrency behavior.";

export const PRODUCT_MARKETPLACE_SORT_PAGINATION_REQUIREMENT_IDS = [
  "ROUTE.MARKET.sort",
  "ROUTE.MARKET.pagination",
] as const;

export type ProductMarketplaceSortPaginationRequirementId =
  (typeof PRODUCT_MARKETPLACE_SORT_PAGINATION_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_SORT_PAGINATION_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_SORT_PAGINATION_REQUIREMENT_IDS.length;

type ProductMarketplaceSortPaginationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_MARKETPLACE_SORT_PAGINATION_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SORT_PAGINATION_TEST_FILE,
  "src/lib/marketplace-navigation.ts",
  "src/lib/marketplace-navigation.test.ts",
  "src/app/listings/page.tsx",
  "src/lib/queries.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/production-screen-marketplace-interactions.test.ts",
] as const;

export const PRODUCT_MARKETPLACE_SORT_PAGINATION_MASTER_EVIDENCE = {
  "ROUTE.MARKET.sort": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
  "ROUTE.MARKET.pagination": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceSortPaginationRequirementId,
    ProductMarketplaceSortPaginationEvidenceRecord
  >
>;
