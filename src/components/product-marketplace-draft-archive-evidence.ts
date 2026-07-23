import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EVIDENCE_FILE =
  "src/components/product-marketplace-draft-archive-evidence.ts" as const;
export const PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_TEST_FILE =
  "src/components/product-marketplace-draft-archive-evidence.test.ts" as const;

export const PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_SCOPE =
  "Focused source and unit verification that authenticated listing owners can create a private draft, submit that draft into moderator review, and explicitly confirm an owner-scoped archive transition that removes the listing from active inventory. The service enforces allowlisted lifecycle transitions, durable status history, and audit events. This proves local source contracts and runnable regression coverage only; it does not prove a deployed database mutation, moderator response time, production row-level security, or browser hydration.";

export const PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_REQUIREMENT_IDS = [
  "ROUTE.MARKET.draft",
  "ROUTE.MARKET.archive",
] as const;

export type ProductMarketplaceDraftArchiveRequirementId =
  (typeof PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_REQUIREMENT_IDS)[number];

export const PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EXPECTED_GAIN =
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_REQUIREMENT_IDS.length;

type ProductMarketplaceDraftArchiveEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_TEST_FILE,
  "src/app/actions.ts",
  "src/app/listings/new/page.tsx",
  "src/app/listings/[id]/page.tsx",
  "src/app/account/listings/drafts/page.tsx",
  "src/app/account/listings/archived/page.tsx",
  "src/lib/listing-service.ts",
  "src/components/screen-contracts/production-screen-commerce-interactions.ts",
  "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
  "src/components/screen-contracts/production-screen-marketplace-interactions.test.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
] as const;

export const PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_MASTER_EVIDENCE = {
  "ROUTE.MARKET.draft": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
  "ROUTE.MARKET.archive": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductMarketplaceDraftArchiveRequirementId,
    ProductMarketplaceDraftArchiveEvidenceRecord
  >
>;
