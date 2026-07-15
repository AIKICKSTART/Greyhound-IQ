import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EVIDENCE_FILE =
  "src/components/product-account-support-ticket-detail-evidence.ts" as const;
export const PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_TEST_FILE =
  "src/components/product-account-support-ticket-detail-evidence.test.ts" as const;

export const PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_SCOPE =
  "Focused source and unit verification that /account/support links to a noindex dynamic ticket-detail route, authentication is required, the database read runs in the current request context with both ticket ID and current-user ownership filters, foreign and missing IDs share the same 404 outcome, messages use an exact non-relational projection, the latest 100 messages are bounded and restored to chronological display order, and an empty conversation state exists. This proves owner-scoped read-only route source and unit behavior only; it does not prove reply mutation, browser hydration, deployed row-level security, Design Lab route-registry integration, onboarding coverage, production database results, or administrator workflow behavior.";

export const PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_REQUIREMENT_IDS = [
  "ROUTE.ACCOUNT.ticket-detail",
] as const;

export type ProductAccountSupportTicketDetailRequirementId =
  (typeof PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_REQUIREMENT_IDS)[number];

export const PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EXPECTED_GAIN =
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_REQUIREMENT_IDS.length;

type ProductAccountSupportTicketDetailEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_TEST_FILE,
  "src/app/account/support/page.tsx",
  "src/app/account/support/[id]/page.tsx",
  "src/lib/support-ticket-service.ts",
] as const;

export const PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_MASTER_EVIDENCE = {
  "ROUTE.ACCOUNT.ticket-detail": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductAccountSupportTicketDetailRequirementId,
    ProductAccountSupportTicketDetailEvidenceRecord
  >
>;
