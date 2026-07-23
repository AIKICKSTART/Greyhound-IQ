import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EVIDENCE_FILE =
  "src/components/product-account-sensitive-confirmation-evidence.ts" as const;
export const PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_TEST_FILE =
  "src/components/product-account-sensitive-confirmation-evidence.test.ts" as const;

export const PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE =
  "Focused source-static verification of the two destructive account-form operations currently registered: account deletion and permanent managed-page deletion. Both require a visible typed DELETE value, HTML constraint validation, strict server-side literal parsing after authentication, and current-user or owned-page scoping before mutation. This proves reviewed source behavior only. It does not prove hydrated browser interaction, deployed identity, database RLS, reauthentication, runtime cross-account denial, or future destructive forms that are not yet registered.";

export const PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_REQUIREMENT_IDS = [
  "ROUTE.ACCOUNT.sensitive-confirmation",
] as const;

export type ProductAccountSensitiveConfirmationRequirementId =
  (typeof PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_REQUIREMENT_IDS)[number];

export const PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EXPECTED_GAIN =
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_REQUIREMENT_IDS.length;

export const PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_FORMS = [
  {
    route: "/account",
    formId: "ACCOUNT.FORM.DELETION",
    action: "requestAccountDeletion",
  },
  {
    route: "/account/pages/[id]",
    formId: "ACCOUNT-PAGE.FORM.DELETE",
    action: "deleteCustomPageAction",
  },
] as const;

type ProductAccountSensitiveConfirmationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_MASTER_EVIDENCE = {
  "ROUTE.ACCOUNT.sensitive-confirmation": {
    status: "tested",
    evidence: [
      PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EVIDENCE_FILE,
      PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_TEST_FILE,
      "src/app/actions.ts",
      "src/app/account/page.tsx",
      "src/app/account/pages/[id]/page.tsx",
      "src/lib/account-service.ts",
      "src/lib/custom-page-service.ts",
      "src/components/screen-contracts/production-screen-coverage.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductAccountSensitiveConfirmationRequirementId,
    ProductAccountSensitiveConfirmationEvidenceRecord
  >
>;
