import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_ACCESS_SAFETY_EVIDENCE_FILE =
  "src/components/product-marketplace-access-safety-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_ACCESS_SAFETY_TEST_FILE =
  "src/components/product-marketplace-access-safety-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_ACCESS_SAFETY_SCOPE =
  "Focused source-static verification of the marketplace create, edit, save and enquiry authentication/ownership chains; owner-only listing controls; and the exact listing API method surface that keeps destructive operations out of GET handlers. This proves reviewed source ordering and UI gating only. It does not prove deployed identity, database RLS, cross-account runtime denial, hydrated browser behavior, production traffic, or every marketplace requirement.";

export const PRODUCT_MARKETPLACE_ACCESS_SAFETY_REQUIREMENT_IDS = [
  "ROUTE.MARKET.auth-ownership",
  "ROUTE.MARKET.hide-seller-controls",
  "ROUTE.MARKET.no-get-mutation",
] as const;

export type ProductMarketplaceAccessSafetyRequirementId =
  (typeof PRODUCT_MARKETPLACE_ACCESS_SAFETY_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_ACCESS_SAFETY_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_REQUIREMENT_IDS.length;

type ProductMarketplaceAccessSafetyEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_TEST_FILE,
  "src/lib/listing-service.ts",
  "src/app/api/listings/route.ts",
  "src/app/api/listings/[id]/route.ts",
] as const;

function tested(
  ...evidence: readonly string[]
): ProductMarketplaceAccessSafetyEvidenceRecord {
  return {
    status: "tested",
    evidence: [...COMMON_EVIDENCE, ...evidence],
  };
}

export const PRODUCT_MARKETPLACE_ACCESS_SAFETY_MASTER_EVIDENCE = {
  "ROUTE.MARKET.auth-ownership": tested(
    "src/app/api/listings/[id]/save/route.ts",
    "src/app/api/listings/[id]/enquiry/route.ts",
  ),
  "ROUTE.MARKET.hide-seller-controls": tested(
    "src/app/listings/[id]/page.tsx",
    "src/app/actions.ts",
  ),
  "ROUTE.MARKET.no-get-mutation": tested(
    "src/app/api/listings/[id]/renew/route.ts",
    "src/app/api/listings/[id]/sold/route.ts",
    "src/app/api/listings/[id]/withdraw/route.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductMarketplaceAccessSafetyRequirementId,
    ProductMarketplaceAccessSafetyEvidenceRecord
  >
>;
