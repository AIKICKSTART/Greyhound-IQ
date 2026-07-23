import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_SELLER_PROFILE_EVIDENCE_FILE =
  "src/components/product-marketplace-seller-profile-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_SELLER_PROFILE_TEST_FILE =
  "src/components/product-marketplace-seller-profile-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_SELLER_PROFILE_SCOPE =
  "Focused source-static verification that a marketplace listing detail loads only the seller actor's handle and publication flag, exposes a same-origin seller-profile link only for a published actor, and renders an unlinked private fallback otherwise. This proves source routing and disclosure gating only. It does not prove hydrated browser navigation, deployed profile visibility policy, cross-account runtime denial, database RLS, or every seller-profile state.";

export const PRODUCT_MARKETPLACE_SELLER_PROFILE_REQUIREMENT_IDS = [
  "ROUTE.MARKET.seller-profile",
] as const;

export type ProductMarketplaceSellerProfileRequirementId =
  (typeof PRODUCT_MARKETPLACE_SELLER_PROFILE_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_SELLER_PROFILE_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_SELLER_PROFILE_REQUIREMENT_IDS.length;

type ProductMarketplaceSellerProfileEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_MARKETPLACE_SELLER_PROFILE_MASTER_EVIDENCE = {
  "ROUTE.MARKET.seller-profile": {
    status: "tested",
    evidence: [
      PRODUCT_MARKETPLACE_SELLER_PROFILE_EVIDENCE_FILE,
      PRODUCT_MARKETPLACE_SELLER_PROFILE_TEST_FILE,
      "src/lib/listing-service.ts",
      "src/app/listings/[id]/page.tsx",
      "src/app/p/[handle]/page.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceSellerProfileRequirementId,
    ProductMarketplaceSellerProfileEvidenceRecord
  >
>;
