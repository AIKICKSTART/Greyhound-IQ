import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ADMIN_SAFE_FAILURE_EVIDENCE_FILE =
  "src/components/product-admin-safe-failure-evidence.ts" as const;
export const PRODUCT_ADMIN_SAFE_FAILURE_TEST_FILE =
  "src/components/product-admin-safe-failure-evidence.test.ts" as const;

export const PRODUCT_ADMIN_SAFE_FAILURE_SCOPE =
  "Focused source verification that the administrator route segment owns a Next.js 16.2 error boundary which emits only a safe digest reference, makes the failed outcome explicit, provides framework-supported secure retry, and provides a deterministic return to the administrator dashboard. This proves the repository's sensitive administrator failure surface; it does not prove a hydrated browser transition, deployed logging correlation, or every administrator mutation's audit behavior.";

export const PRODUCT_ADMIN_SAFE_FAILURE_REQUIREMENT_IDS = [
  "ROUTE.ADMIN.safe-failure",
] as const;

type ProductAdminSafeFailureRequirementId =
  (typeof PRODUCT_ADMIN_SAFE_FAILURE_REQUIREMENT_IDS)[number];

type ProductAdminSafeFailureEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_ADMIN_SAFE_FAILURE_MASTER_EVIDENCE = {
  "ROUTE.ADMIN.safe-failure": {
    status: "tested",
    evidence: [
      PRODUCT_ADMIN_SAFE_FAILURE_EVIDENCE_FILE,
      PRODUCT_ADMIN_SAFE_FAILURE_TEST_FILE,
      "src/app/admin/error.tsx",
      "src/app/admin/admin-premium-security-contract.test.ts",
    ],
  },
} as const satisfies Readonly<
  Record<ProductAdminSafeFailureRequirementId, ProductAdminSafeFailureEvidenceRecord>
>;
