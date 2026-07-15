import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ADMIN_SECRET_SAFETY_EVIDENCE_FILE =
  "src/components/product-admin-secret-safety-evidence.ts" as const;
export const PRODUCT_ADMIN_SECRET_SAFETY_TEST_FILE =
  "src/components/product-admin-secret-safety-evidence.test.ts" as const;

export const PRODUCT_ADMIN_SECRET_SAFETY_SCOPE =
  "Deterministic source-static verification of the complete current src/app/admin production surface plus its report-resolution route. Provider failures render fixed recovery copy rather than error text; the Admin error boundary exposes only the framework digest; client components cannot import server provider, secret or environment access; and production Admin source does not access raw provider payload, request/response body, token, secret, metadata or stored-error fields. This proves the current repository disclosure boundary only; it does not prove deployed provider behavior, browser transport, database policy, immutable bundle scanning, or production readiness.";

export const PRODUCT_ADMIN_SECRET_SAFETY_REQUIREMENT_IDS = [
  "ROUTE.ADMIN.secret-safety",
] as const;

type ProductAdminSecretSafetyRequirementId =
  (typeof PRODUCT_ADMIN_SECRET_SAFETY_REQUIREMENT_IDS)[number];

type ProductAdminSecretSafetyEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_ADMIN_SECRET_SAFETY_MASTER_EVIDENCE = {
  "ROUTE.ADMIN.secret-safety": {
    status: "tested",
    evidence: [
      PRODUCT_ADMIN_SECRET_SAFETY_EVIDENCE_FILE,
      PRODUCT_ADMIN_SECRET_SAFETY_TEST_FILE,
      "src/app/admin/site-content/page.tsx",
      "src/app/admin/error.tsx",
      "src/app/api/reports/[id]/resolve/route.ts",
    ],
  },
} as const satisfies Readonly<
  Record<ProductAdminSecretSafetyRequirementId, ProductAdminSecretSafetyEvidenceRecord>
>;
