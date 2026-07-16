import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MESSAGING_ACCESS_STATE_EVIDENCE_FILE =
  "src/components/product-messaging-access-state-evidence.ts" as const;
export const PRODUCT_MESSAGING_ACCESS_STATE_TEST_FILE =
  "src/components/screen-contracts/production-screen-messaging-access-state-evidence.test.ts" as const;

export const PRODUCT_MESSAGING_ACCESS_STATE_EVIDENCE_SCOPE =
  "Deterministic source and registry verification for the six canonical and alias Pulse permission surfaces, five newly completed state surfaces, participant-scoped thread lookup, metadata-safe not-found handling, and blocked message/call enforcement. This evidence does not prove all-product signed-out protection, blocked-user content policy, safe errors for every mutation, server-side authorization outside messaging, production runtime availability, or route-audit currency.";

export const PRODUCT_MESSAGING_ACCESS_STATE_REQUIREMENT_IDS = [
  "ROUTE.COMMUNITY.participant-block",
  "GLOBAL.SEC.thread-metadata",
] as const;

export const PRODUCT_MESSAGING_ACCESS_STATE_OPEN_REQUIREMENT_IDS = [
  "ROUTE.COMMUNITY.privacy-boundaries",
  "GLOBAL.SEC.signed-out",
  "GLOBAL.SEC.blocked",
  "GLOBAL.SEC.safe-errors",
  "GLOBAL.SEC.server-authority",
] as const;

export type ProductMessagingAccessStateRequirementId =
  (typeof PRODUCT_MESSAGING_ACCESS_STATE_REQUIREMENT_IDS)[number];

export type ProductMessagingAccessStateEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_MESSAGING_ACCESS_STATE_EVIDENCE_FILE,
  PRODUCT_MESSAGING_ACCESS_STATE_TEST_FILE,
  "src/components/screen-contracts/production-screen-messaging-access-state-evidence.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
] as const;

export const PRODUCT_MESSAGING_ACCESS_STATE_MASTER_EVIDENCE = {
  "ROUTE.COMMUNITY.participant-block": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/messages/[id]/page.tsx",
      "src/app/actions.ts",
      "src/lib/conversation-service.ts",
      "src/lib/call-service.ts",
    ],
  },
  "GLOBAL.SEC.thread-metadata": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/messages/[id]/page.tsx",
      "src/lib/conversation-service.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductMessagingAccessStateRequirementId,
    ProductMessagingAccessStateEvidenceRecord
  >
>;
