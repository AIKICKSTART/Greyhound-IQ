import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_MISSING_PRIVACY_EVIDENCE_FILE =
  "src/components/product-marketplace-missing-privacy-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_MISSING_PRIVACY_TEST_FILE =
  "src/components/product-marketplace-missing-privacy-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_MISSING_PRIVACY_SCOPE =
  "Focused source-static verification that missing and unauthorized non-public marketplace listing identifiers collapse to the same listing.not_found result before seller details render, that both public listing aliases share that guarded detail implementation, and that the page returns the common not-found screen without exposing a separate seller lookup. This proves the reviewed listing/seller detail boundary only; it does not prove deployed database RLS, cross-account runtime denial, malformed-data recovery, browser behavior, or every marketplace privacy path.";

export const PRODUCT_MARKETPLACE_MISSING_PRIVACY_REQUIREMENT_IDS = [
  "ROUTE.MARKET.safe-missing",
] as const;

export type ProductMarketplaceMissingPrivacyRequirementId =
  (typeof PRODUCT_MARKETPLACE_MISSING_PRIVACY_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_MISSING_PRIVACY_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_REQUIREMENT_IDS.length;

type ProductMarketplaceMissingPrivacyEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_TEST_FILE,
  "src/lib/listing-service.ts",
  "src/app/listings/[id]/page.tsx",
  "src/app/marketplace/[id]/page.tsx",
  "src/app/api/listings/[id]/route.ts",
] as const;

export const PRODUCT_MARKETPLACE_MISSING_PRIVACY_MASTER_EVIDENCE = {
  "ROUTE.MARKET.safe-missing": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceMissingPrivacyRequirementId,
    ProductMarketplaceMissingPrivacyEvidenceRecord
  >
>;
