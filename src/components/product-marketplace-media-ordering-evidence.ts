import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_MEDIA_ORDERING_EVIDENCE_FILE =
  "src/components/product-marketplace-media-ordering-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_MEDIA_ORDERING_TEST_FILE =
  "src/components/product-marketplace-media-ordering-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_MEDIA_ORDERING_SCOPE =
  "Focused source and unit verification that listing uploads expose explicit primary-image promotion and earlier/later ordering controls, submit only completed media IDs in visible order, preserve that order through schema parsing, and persist it as listing-media positions during creation. This does not prove hydrated pointer or keyboard interaction, completed object-storage uploads, malware-scan outcomes, database integration, or media reordering on an existing listing edit screen.";

export const PRODUCT_MARKETPLACE_MEDIA_ORDERING_REQUIREMENT_IDS = [
  "ROUTE.MARKET.primary-image",
  "ROUTE.MARKET.reorder-media",
] as const;

export type ProductMarketplaceMediaOrderingRequirementId =
  (typeof PRODUCT_MARKETPLACE_MEDIA_ORDERING_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_MEDIA_ORDERING_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_REQUIREMENT_IDS.length;

type ProductMarketplaceMediaOrderingEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_TEST_FILE,
  "src/components/media-attachment-fields.tsx",
  "src/components/listing-media-ordering.test.ts",
  "src/app/listings/new/page.tsx",
  "src/app/actions.ts",
  "src/lib/media-service.ts",
] as const;

export const PRODUCT_MARKETPLACE_MEDIA_ORDERING_MASTER_EVIDENCE = {
  "ROUTE.MARKET.primary-image": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
  "ROUTE.MARKET.reorder-media": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceMediaOrderingRequirementId,
    ProductMarketplaceMediaOrderingEvidenceRecord
  >
>;
