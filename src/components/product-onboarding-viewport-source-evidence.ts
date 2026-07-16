import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EVIDENCE_FILE =
  "src/components/product-onboarding-viewport-source-evidence.ts" as const;
export const PRODUCT_ONBOARDING_VIEWPORT_SOURCE_TEST_FILE =
  "src/components/product-onboarding-viewport-source-evidence.test.ts" as const;

export const PRODUCT_ONBOARDING_VIEWPORT_SOURCE_SCOPE =
  "Deterministic source-static and focused-unit verification that onboarding popover layout stays within its calculated viewport across all eight declared device classes, opposite-side target clearance and Visual Viewport keyboard conditions. The mounted component binds those calculated width, height and top values, observes viewport resize and scroll, preserves mobile-dock clearance and contains overscroll within the popup content. This proves repository source and layout calculations only; it does not prove browser rendering, zoom behaviour, operating-system keyboard geometry, assistive-technology outcomes, deployed viewport containment or any other global responsive requirement.";

export const PRODUCT_ONBOARDING_VIEWPORT_SOURCE_REQUIREMENT_IDS = [
  "GLOBAL.RESP.tour",
] as const;

export type ProductOnboardingViewportSourceRequirementId =
  (typeof PRODUCT_ONBOARDING_VIEWPORT_SOURCE_REQUIREMENT_IDS)[number];

export const PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EXPECTED_GAIN =
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_REQUIREMENT_IDS.length;

type ProductOnboardingViewportSourceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EVIDENCE_FILE,
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_TEST_FILE,
  "src/components/interactive-help.tsx",
  "src/components/interactive-help.module.css",
  "src/components/interactive-help-layout.ts",
  "src/components/interactive-help-responsive.test.ts",
  "src/components/product-onboarding-capability-evidence.ts",
  "src/components/product-onboarding-capability-evidence.test.ts",
] as const;

const TESTED = {
  status: "tested",
  evidence: EVIDENCE,
} as const satisfies ProductOnboardingViewportSourceEvidenceRecord;

export const PRODUCT_ONBOARDING_VIEWPORT_SOURCE_MASTER_EVIDENCE = {
  "GLOBAL.RESP.tour": TESTED,
} as const satisfies Readonly<
  Record<
    ProductOnboardingViewportSourceRequirementId,
    ProductOnboardingViewportSourceEvidenceRecord
  >
>;
