import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ADMIN_SERVER_AUTHORIZATION_EVIDENCE_FILE =
  "src/components/product-admin-server-authorization-evidence.ts" as const;
export const PRODUCT_ADMIN_SERVER_AUTHORIZATION_TEST_FILE =
  "src/components/product-admin-server-authorization-evidence.test.ts" as const;

export const PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE =
  "Focused source-static verification that every privileged mutation submitter in the 21 reviewed Admin operation screens resolves to the exhaustive Admin authorization inventory, and that all 32 registered privileged server actions plus the report-resolution route handler independently invoke their declared moderator or administrator guard. This proves server-side guard placement for the registered Admin mutation surface only; it does not prove deployed identity, request-level multi-role denial, database RLS, last-administrator concurrency, browser behavior, or all-product mutation authorization.";

export const PRODUCT_ADMIN_SERVER_AUTHORIZATION_REQUIREMENT_IDS = [
  "ROUTE.ADMIN.server-authz",
] as const;

export type ProductAdminServerAuthorizationRequirementId =
  (typeof PRODUCT_ADMIN_SERVER_AUTHORIZATION_REQUIREMENT_IDS)[number];

export const PRODUCT_ADMIN_SERVER_AUTHORIZATION_EXPECTED_GAIN =
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_REQUIREMENT_IDS.length;

type ProductAdminServerAuthorizationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_EVIDENCE_FILE,
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_TEST_FILE,
  "src/app/admin/admin-authorization-inventory.ts",
  "src/app/admin/admin-authorization-inventory.test.ts",
  "src/components/screen-contracts/production-screen-admin-operations-interactions.ts",
  "src/components/screen-contracts/production-screen-admin-operations-interactions.test.ts",
  "src/app/admin/mutations.ts",
  "src/app/actions.ts",
  "src/app/api/reports/[id]/resolve/route.ts",
] as const;

export const PRODUCT_ADMIN_SERVER_AUTHORIZATION_MASTER_EVIDENCE = {
  "ROUTE.ADMIN.server-authz": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductAdminServerAuthorizationRequirementId,
    ProductAdminServerAuthorizationEvidenceRecord
  >
>;
