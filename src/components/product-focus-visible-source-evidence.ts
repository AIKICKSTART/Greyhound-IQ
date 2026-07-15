import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_FOCUS_VISIBLE_SOURCE_EVIDENCE_FILE =
  "src/components/product-focus-visible-source-evidence.ts" as const;
export const PRODUCT_FOCUS_VISIBLE_SOURCE_TEST_FILE =
  "src/components/product-focus-visible-source-evidence.test.ts" as const;

export const PRODUCT_FOCUS_VISIBLE_SOURCE_SCOPE =
  "Deterministic source-static verification that the global stylesheet supplies a visible focus indicator, and that each audited reachable source string which removes outlines supplies an explicit focus-visible indicator. This proves the current source contract only; it does not prove keyboard order, actual browser focus traversal, contrast in every theme, third-party content, assistive-technology outcomes, browser rendering, or production readiness.";

export const PRODUCT_FOCUS_VISIBLE_SOURCE_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.focus-visible",
] as const;

export type ProductFocusVisibleSourceRequirementId =
  (typeof PRODUCT_FOCUS_VISIBLE_SOURCE_REQUIREMENT_IDS)[number];

type ProductFocusVisibleSourceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_FOCUS_VISIBLE_SOURCE_EVIDENCE_FILE,
  PRODUCT_FOCUS_VISIBLE_SOURCE_TEST_FILE,
  "src/app/globals.css",
  "src/components/feed-system-prototype.tsx",
  "src/components/product-automated-source-gate-registry.ts",
] as const;

export const PRODUCT_FOCUS_VISIBLE_SOURCE_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.focus-visible": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductFocusVisibleSourceRequirementId,
    ProductFocusVisibleSourceEvidenceRecord
  >
>;
