import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SYSTEM_STATE_EVIDENCE_FILE =
  "src/components/product-system-state-evidence.ts" as const;
export const PRODUCT_SYSTEM_STATE_TEST_FILE =
  "src/components/product-system-state-evidence.test.ts" as const;

export const PRODUCT_SYSTEM_STATE_EVIDENCE_SCOPE =
  "Source-static verification of eleven implemented system-state recovery and access experiences; browser execution, production runtime behaviour and unresolved system-state gaps remain separate gates.";

export type ProductSystemStateEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_SYSTEM_STATE_REQUIREMENT_IDS = [
  "SYSTEM.forbidden",
  "SYSTEM.auth-required",
  "SYSTEM.subscription-required",
  "SYSTEM.feature-unavailable",
  "SYSTEM.private",
  "SYSTEM.blocked",
  "SYSTEM.deleted",
  "SYSTEM.recoverable-error",
  "SYSTEM.auth-callback-failure",
  "SYSTEM.billing-loading",
  "SYSTEM.upload-failure",
] as const;

const COMMON_EVIDENCE = [
  PRODUCT_SYSTEM_STATE_EVIDENCE_FILE,
  PRODUCT_SYSTEM_STATE_TEST_FILE,
] as const;

export const PRODUCT_SYSTEM_STATE_MASTER_EVIDENCE: Readonly<
  Record<string, ProductSystemStateEvidenceRecord>
> = {
  "SYSTEM.forbidden": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/forbidden.tsx",
      "src/app/forbidden-contract.test.ts",
      "src/app/admin/layout.tsx",
      "next.config.ts",
    ],
  },
  "SYSTEM.auth-required": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/messages/page.tsx",
      "src/app/messages/[id]/page.tsx",
      "src/components/screen-contracts/screen-state-evidence.test.ts",
      "src/components/screen-contracts/community-user-stories.test.ts",
    ],
  },
  "SYSTEM.subscription-required": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/listings/new/page.tsx",
      "src/app/listings/[id]/page.tsx",
      "src/components/screen-contracts/marketplace-account-user-stories.test.ts",
    ],
  },
  "SYSTEM.feature-unavailable": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/components/pro-gate.tsx",
      "src/app/pricing/page.tsx",
      "src/lib/site-content.ts",
    ],
  },
  "SYSTEM.private": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/messages/[id]/page.tsx",
      "src/lib/conversation-service.ts",
      "src/components/screen-contracts/community-user-stories.test.ts",
    ],
  },
  "SYSTEM.blocked": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/messages/[id]/page.tsx",
      "src/components/screen-contracts/community-user-stories.test.ts",
    ],
  },
  "SYSTEM.deleted": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/account-service.ts",
      "src/app/messages/[id]/page.tsx",
      "src/lib/account-deletion.test.ts",
    ],
  },
  "SYSTEM.recoverable-error": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/error.tsx",
      "src/app/races/error.tsx",
      "src/app/messages/error.tsx",
      "src/components/screen-contracts/screen-state-evidence.test.ts",
    ],
  },
  "SYSTEM.auth-callback-failure": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/callback/route.ts",
      "src/app/auth/error/page.tsx",
      "src/lib/auth-callback-recovery.test.ts",
      "src/lib/auth-callback-route-contract.test.ts",
    ],
  },
  "SYSTEM.billing-loading": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/billing/stripe-service.ts",
      "src/app/account/billing/page.tsx",
      "src/lib/billing/stripe-readiness.test.ts",
    ],
  },
  "SYSTEM.upload-failure": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/components/media-attachment-fields.tsx",
      "src/components/media-attachment-fields.test.ts",
    ],
  },
};
