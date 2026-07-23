import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EVIDENCE_FILE =
  "src/components/product-account-mutation-feedback-evidence.ts" as const;
export const PRODUCT_ACCOUNT_MUTATION_FEEDBACK_TEST_FILE =
  "src/components/product-account-mutation-feedback-evidence.test.ts" as const;

export const PRODUCT_ACCOUNT_MUTATION_FEEDBACK_SCOPE =
  "Focused source-static verification of all four registered /account mutations: profile update and account deletion use shared pending controls plus fragment-targeted success and recoverable-failure notices; data export exposes client pending, downloaded, and retryable failure states; and checkout exposes pending state, successful Stripe handoff, and local failure or rate-limit recovery. This proves reviewed source behavior and exact inventory coverage only. It does not prove hydrated browser announcements, a real file download, provider availability, payment completion, deployed identity, database persistence, or production runtime recovery.";

export const PRODUCT_ACCOUNT_MUTATION_FEEDBACK_REQUIREMENT_IDS = [
  "ROUTE.ACCOUNT.mutation-feedback",
] as const;

export type ProductAccountMutationFeedbackRequirementId =
  (typeof PRODUCT_ACCOUNT_MUTATION_FEEDBACK_REQUIREMENT_IDS)[number];

export const PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EXPECTED_GAIN =
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_REQUIREMENT_IDS.length;

export const PRODUCT_ACCOUNT_MUTATION_FEEDBACK_FORMS = [
  {
    route: "/account",
    formId: "ACCOUNT.FORM.PROFILE",
    submitsTo: "SERVER ACTION updateProfile",
  },
  {
    route: "/account",
    formId: "ACCOUNT.FORM.DATA-EXPORT",
    submitsTo: "POST /api/users/me/export",
  },
  {
    route: "/account",
    formId: "ACCOUNT.FORM.DELETION",
    submitsTo: "SERVER ACTION requestAccountDeletion",
  },
  {
    route: "/account",
    formId: "ACCOUNT.FORM.CHECKOUT",
    submitsTo: "POST /api/billing/checkout",
  },
] as const;

type ProductAccountMutationFeedbackEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_ACCOUNT_MUTATION_FEEDBACK_MASTER_EVIDENCE = {
  "ROUTE.ACCOUNT.mutation-feedback": {
    status: "tested",
    evidence: [
      PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EVIDENCE_FILE,
      PRODUCT_ACCOUNT_MUTATION_FEEDBACK_TEST_FILE,
      "src/components/screen-contracts/production-screen-coverage.ts",
      "src/app/account/page.tsx",
      "src/app/actions.ts",
      "src/components/submit-button.tsx",
      "src/components/user-data-export-form.tsx",
      "src/app/api/users/me/export/route.ts",
      "src/app/api/users/me/export/route.test.ts",
      "src/app/api/billing/checkout/route.ts",
      "src/app/pricing/page.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductAccountMutationFeedbackRequirementId,
    ProductAccountMutationFeedbackEvidenceRecord
  >
>;
