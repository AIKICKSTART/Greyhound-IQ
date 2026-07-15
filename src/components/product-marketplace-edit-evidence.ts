import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_EDIT_EVIDENCE_FILE =
  "src/components/product-marketplace-edit-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_EDIT_TEST_FILE =
  "src/components/product-marketplace-edit-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_EDIT_SCOPE =
  "Focused source and unit verification that PATCH /api/listings/[id] requires the current profile, applies a per-profile and per-listing rate limit, rejects empty or unknown-field bodies through a strict bounded patch schema, resolves ownership server-side, re-runs dog-listing fraud gates, returns active edits to moderation review, records status history, and audits the mutation. This proves the authenticated API editing capability only; it does not prove a browser edit screen, the separate edit-route requirement, deployed database behavior, concurrent update conflict handling, or hydrated mutation feedback.";

export const PRODUCT_MARKETPLACE_EDIT_REQUIREMENT_IDS = [
  "ROUTE.MARKET.edit",
] as const;

export type ProductMarketplaceEditRequirementId =
  (typeof PRODUCT_MARKETPLACE_EDIT_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_EDIT_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_EDIT_REQUIREMENT_IDS.length;

type ProductMarketplaceEditEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_MARKETPLACE_EDIT_MASTER_EVIDENCE = {
  "ROUTE.MARKET.edit": {
    status: "tested",
    evidence: [
      PRODUCT_MARKETPLACE_EDIT_EVIDENCE_FILE,
      PRODUCT_MARKETPLACE_EDIT_TEST_FILE,
      "src/app/api/listings/[id]/route.ts",
      "src/lib/listing-validation.ts",
      "src/lib/listing-validation.test.ts",
      "src/lib/listing-service.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceEditRequirementId,
    ProductMarketplaceEditEvidenceRecord
  >
>;
