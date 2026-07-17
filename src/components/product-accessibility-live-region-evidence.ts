import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCESSIBILITY_LIVE_REGION_EVIDENCE_FILE =
  "src/components/product-accessibility-live-region-evidence.ts" as const;
export const PRODUCT_ACCESSIBILITY_LIVE_REGION_TEST_FILE =
  "src/components/product-accessibility-live-region-evidence.test.ts" as const;

export const PRODUCT_ACCESSIBILITY_LIVE_REGION_SCOPE =
  "Deterministic source-static verification of every non-test TSX file in src/app and src/components: explicit aria-live values are valid, and each rendered error-state expression whose error value reaches the JSX subtree is contained by an assertive alert, status role, or enabled live region. This proves the current source announcement contract only; it does not prove hydration timing, browser or assistive-technology delivery, third-party content, or production readiness.";

export const PRODUCT_ACCESSIBILITY_LIVE_REGION_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.live-regions",
] as const;

type ProductAccessibilityLiveRegionEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACCESSIBILITY_LIVE_REGION_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_LIVE_REGION_TEST_FILE,
] as const;

export const PRODUCT_ACCESSIBILITY_LIVE_REGION_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.live-regions": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_ACCESSIBILITY_LIVE_REGION_REQUIREMENT_IDS)[number],
    ProductAccessibilityLiveRegionEvidenceRecord
  >
>;
