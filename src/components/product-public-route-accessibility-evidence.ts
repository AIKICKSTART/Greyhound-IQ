import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_EVIDENCE_FILE =
  "src/components/product-public-route-accessibility-evidence.ts" as const;
export const PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_TEST_FILE =
  "src/components/product-public-route-accessibility-evidence.test.ts" as const;

export const PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_SCOPE =
  "Deterministic source-static verification of the seven public route source closures plus the shared application layout. The runnable gate exhaustively rejects unreviewed non-native activation, positive tab indices, outline removal without focus-visible treatment, unnamed links and controls, unlabeled public fields, and undersized declared primary actions; focused negative fixtures prove each failure path. This proves current local source conditions only. It does not establish rendered focus traversal, computed accessible names, assistive-technology outcomes, browser geometry, deployed parity, or production readiness.";

export const PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_REQUIREMENT_IDS = [
  "ROUTE.PUBLIC.a11y",
] as const;

export type ProductPublicRouteAccessibilityRequirementId =
  (typeof PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_REQUIREMENT_IDS)[number];

type ProductPublicRouteAccessibilityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_EVIDENCE_FILE,
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_TEST_FILE,
  "src/components/global-accessibility-interaction.test.ts",
  "src/components/product-action-accessibility-behaviour-evidence.test.ts",
  "src/components/product-field-contract-source-registry.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
] as const;

export const PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_MASTER_EVIDENCE = {
  "ROUTE.PUBLIC.a11y": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductPublicRouteAccessibilityRequirementId,
    ProductPublicRouteAccessibilityEvidenceRecord
  >
>;
