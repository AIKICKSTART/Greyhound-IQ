import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EVIDENCE_FILE =
  "src/components/product-marketplace-seller-inventory-routes-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_TEST_FILE =
  "src/components/product-marketplace-seller-inventory-routes-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE =
  "Focused source and unit verification that /account/listings, /account/listings/drafts, and /account/listings/archived exist as noindex signed-in seller views, the account links to the inventory, fixed route values map to explicit lifecycle filters, the database read is current-profile scoped with an exact projection and 100-row cap, and each route has an explicit empty state. This proves read-only route source and unit behavior only; it does not prove draft creation, archive mutation, hydrated navigation, deployed row-level security, Design Lab route-registry integration, onboarding coverage, production database results, or pagination beyond the disclosed cap.";

export const PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_REQUIREMENT_IDS = [
  "ROUTE.MARKET.seller-inventory-route",
  "ROUTE.MARKET.drafts-route",
  "ROUTE.MARKET.archived-route",
] as const;

export type ProductMarketplaceSellerInventoryRoutesRequirementId =
  (typeof PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_REQUIREMENT_IDS.length;

type ProductMarketplaceSellerInventoryRoutesEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_TEST_FILE,
  "src/app/account/listings/page.tsx",
  "src/app/account/listings/drafts/page.tsx",
  "src/app/account/listings/archived/page.tsx",
  "src/app/account/listings/seller-listings-page.tsx",
  "src/app/account/page.tsx",
  "src/lib/seller-listing-view.ts",
  "src/lib/seller-listing-view.test.ts",
  "src/lib/listing-service.ts",
] as const;

export const PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_MASTER_EVIDENCE = {
  "ROUTE.MARKET.seller-inventory-route": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
  "ROUTE.MARKET.drafts-route": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
  "ROUTE.MARKET.archived-route": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceSellerInventoryRoutesRequirementId,
    ProductMarketplaceSellerInventoryRoutesEvidenceRecord
  >
>;
