import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_REDUCED_MOTION_SOURCE_EVIDENCE_FILE =
  "src/components/product-reduced-motion-source-evidence.ts" as const;
export const PRODUCT_REDUCED_MOTION_SOURCE_TEST_FILE =
  "src/components/product-reduced-motion-source-evidence.test.ts" as const;

export const PRODUCT_REDUCED_MOTION_SOURCE_SCOPE =
  "Deterministic source-static verification that the root layout loads the global reduced-motion stylesheet, the operating-system preference disables smooth scrolling and collapses CSS animation and transition duration for every element and pseudo-element, every current motion/react UI consumer is wrapped by MotionConfig reducedMotion user, and onboarding programmatic scrolling switches to auto. This proves the repository source contract only; it does not prove behaviour in every browser or operating-system configuration, rendered third-party content, assistive-technology outcomes or removal of every non-motion visual change.";

export const PRODUCT_REDUCED_MOTION_SOURCE_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.motion",
] as const;

export type ProductReducedMotionSourceRequirementId =
  (typeof PRODUCT_REDUCED_MOTION_SOURCE_REQUIREMENT_IDS)[number];

export const PRODUCT_REDUCED_MOTION_SOURCE_EXPECTED_GAIN =
  PRODUCT_REDUCED_MOTION_SOURCE_REQUIREMENT_IDS.length;

type ProductReducedMotionSourceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_REDUCED_MOTION_SOURCE_EVIDENCE_FILE,
  PRODUCT_REDUCED_MOTION_SOURCE_TEST_FILE,
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/components/motion/motion-island.tsx",
  "src/components/motion/motion-features.ts",
  "src/components/agent-demo-console.tsx",
  "src/components/dog-search.tsx",
  "src/components/interactive-help.tsx",
  "src/components/onboarding-tour-registry.ts",
] as const;

const TESTED = {
  status: "tested",
  evidence: EVIDENCE,
} as const satisfies ProductReducedMotionSourceEvidenceRecord;

export const PRODUCT_REDUCED_MOTION_SOURCE_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.motion": TESTED,
} as const satisfies Readonly<
  Record<
    ProductReducedMotionSourceRequirementId,
    ProductReducedMotionSourceEvidenceRecord
  >
>;
