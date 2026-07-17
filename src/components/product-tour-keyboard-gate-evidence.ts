import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_TOUR_KEYBOARD_GATE_EVIDENCE_FILE =
  "src/components/product-tour-keyboard-gate-evidence.ts" as const;
export const PRODUCT_TOUR_KEYBOARD_GATE_TEST_FILE =
  "src/components/product-tour-keyboard-gate-evidence.test.ts" as const;

export const PRODUCT_TOUR_KEYBOARD_GATE_SCOPE =
  "Deterministic source-static verification that all 87 registered onboarding tours and 435 steps use the shared InteractiveHelp keyboard path. The runnable gate checks native Back, Skip, Next and Finish controls, bounded step transitions, focus capture and restoration, the shared Base UI dialog primitive, the exhaustive application interaction scan, and negative broken-control fixtures. This proves the current local source contract only; it does not prove rendered focus traversal, assistive-technology behavior, deployed parity, or production readiness.";

export const PRODUCT_TOUR_KEYBOARD_GATE_REQUIREMENT_IDS = [
  "VERIFY.GATE.tour-keyboard",
] as const;

export type ProductTourKeyboardGateRequirementId =
  (typeof PRODUCT_TOUR_KEYBOARD_GATE_REQUIREMENT_IDS)[number];

type ProductTourKeyboardGateEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_TOUR_KEYBOARD_GATE_EVIDENCE_FILE,
  PRODUCT_TOUR_KEYBOARD_GATE_TEST_FILE,
  "src/components/interactive-help.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/global-accessibility-interaction.test.ts",
  "src/components/onboarding-tour-registry.ts",
  "src/components/public-onboarding-tour-registry.ts",
  "src/components/racing-onboarding-tour-registry.ts",
  "src/components/community-onboarding-tour-registry.ts",
  "src/components/marketplace-onboarding-tour-registry.ts",
  "src/components/agents-onboarding-tour-registry.ts",
  "src/components/design-lab-onboarding-tour-registry.ts",
] as const;

export const PRODUCT_TOUR_KEYBOARD_GATE_MASTER_EVIDENCE = {
  "VERIFY.GATE.tour-keyboard": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductTourKeyboardGateRequirementId,
    ProductTourKeyboardGateEvidenceRecord
  >
>;
