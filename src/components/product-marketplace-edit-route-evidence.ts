import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_EDIT_ROUTE_EVIDENCE_FILE =
  "src/components/product-marketplace-edit-route-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_EDIT_ROUTE_TEST_FILE =
  "src/components/product-marketplace-edit-route-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_EDIT_ROUTE_SCOPE =
  "Focused source and unit verification that canonical /marketplace/[id]/edit and legacy /listings/[id]/edit route sources exist, the owner-only listing detail exposes the canonical entry link, the edit page requires a signed-in paid profile before a request-context owner read, missing or foreign listings become a non-indexed not-found response, and a bounded client form submits through the separately tested authenticated PATCH API with pending, success, safe failure, and duplicate-click controls. This does not prove hydrated browser submission, deployed database reads or writes, concurrent-edit conflict resolution, media replacement, Design Lab route-registry integration, onboarding coverage, or production navigation.";

export const PRODUCT_MARKETPLACE_EDIT_ROUTE_REQUIREMENT_IDS = [
  "ROUTE.MARKET.edit-route",
] as const;

export type ProductMarketplaceEditRouteRequirementId =
  (typeof PRODUCT_MARKETPLACE_EDIT_ROUTE_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_EDIT_ROUTE_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_EDIT_ROUTE_REQUIREMENT_IDS.length;

type ProductMarketplaceEditRouteEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_MARKETPLACE_EDIT_ROUTE_MASTER_EVIDENCE = {
  "ROUTE.MARKET.edit-route": {
    status: "tested",
    evidence: [
      PRODUCT_MARKETPLACE_EDIT_ROUTE_EVIDENCE_FILE,
      PRODUCT_MARKETPLACE_EDIT_ROUTE_TEST_FILE,
      "src/app/listings/[id]/edit/page.tsx",
      "src/app/marketplace/[id]/edit/page.tsx",
      "src/app/listings/[id]/page.tsx",
      "src/components/listing-edit-form.tsx",
      "src/components/listing-edit-form.test.ts",
      "src/lib/listing-service.ts",
      "src/app/api/listings/[id]/route.ts",
      "src/lib/listing-validation.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceEditRouteRequirementId,
    ProductMarketplaceEditRouteEvidenceRecord
  >
>;
