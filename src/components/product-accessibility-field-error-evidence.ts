import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCESSIBILITY_FIELD_ERROR_EVIDENCE_FILE =
  "src/components/product-accessibility-field-error-evidence.ts" as const;
export const PRODUCT_ACCESSIBILITY_FIELD_ERROR_TEST_FILE =
  "src/components/product-accessibility-field-error-evidence.test.ts" as const;

export const PRODUCT_ACCESSIBILITY_FIELD_ERROR_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.errors",
] as const;

export const PRODUCT_ACCESSIBILITY_FIELD_ERROR_SCOPE =
  "Deterministic source-static verification of 16 native controls across eight reachable client-side form, search, message, feed, invitation and call-device features that render a recoverable field or input error. While each error condition is active, its control has aria-invalid and aria-errormessage resolving to the accompanying alert identifier. This does not prove browser-native constraint messages, hidden media upload inputs, action-only alerts, server-side forms without local field-error state, third-party content, browser accessibility-tree output or production readiness.";

type ProductAccessibilityFieldErrorEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_TEST_FILE,
  "src/app/account/team/team-invite-form.tsx",
  "src/components/conversation-call-panel.tsx",
  "src/components/feed-comments-panel.tsx",
  "src/components/hub/add-friend-search.tsx",
  "src/components/hub/hub-conversation-dock.tsx",
  "src/components/instant-feed-controls.tsx",
  "src/components/instant-listing-enquiry-form.tsx",
  "src/components/instant-message-composer.tsx",
] as const;

export const PRODUCT_ACCESSIBILITY_FIELD_ERROR_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.errors": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_ACCESSIBILITY_FIELD_ERROR_REQUIREMENT_IDS)[number],
    ProductAccessibilityFieldErrorEvidenceRecord
  >
>;
