import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_SHARE_EVIDENCE_FILE =
  "src/components/product-marketplace-share-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_SHARE_TEST_FILE =
  "src/components/product-marketplace-share-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_SHARE_SCOPE =
  "Focused source and unit verification that marketplace listing details expose one share control, build a same-origin canonical marketplace URL, prefer the native share sheet, preserve explicit user cancellation, fall back to clipboard copy, and announce success or recoverable failure. This does not prove hydrated behavior in every browser, operating-system share-sheet availability, clipboard permission, analytics delivery, or production navigation.";

export const PRODUCT_MARKETPLACE_SHARE_REQUIREMENT_IDS = [
  "ROUTE.MARKET.share",
] as const;

export type ProductMarketplaceShareRequirementId =
  (typeof PRODUCT_MARKETPLACE_SHARE_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_SHARE_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_SHARE_REQUIREMENT_IDS.length;

type ProductMarketplaceShareEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_MARKETPLACE_SHARE_MASTER_EVIDENCE = {
  "ROUTE.MARKET.share": {
    status: "tested",
    evidence: [
      PRODUCT_MARKETPLACE_SHARE_EVIDENCE_FILE,
      PRODUCT_MARKETPLACE_SHARE_TEST_FILE,
      "src/components/listing-share-button.tsx",
      "src/components/listing-share-button.test.ts",
      "src/app/listings/[id]/page.tsx",
      "src/app/marketplace/[id]/page.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceShareRequirementId,
    ProductMarketplaceShareEvidenceRecord
  >
>;
