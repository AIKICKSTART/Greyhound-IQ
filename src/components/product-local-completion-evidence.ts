import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_LOCAL_COMPLETION_EVIDENCE_FILE =
  "src/components/product-local-completion-evidence.ts" as const;
export const PRODUCT_LOCAL_COMPLETION_TEST_FILE =
  "src/components/product-local-completion-evidence.test.ts" as const;

export const PRODUCT_LOCAL_COMPLETION_SCOPE =
  "Focused source and unit verification of three current completion claims: all 87 canonical onboarding tours and 435 steps resolve through the same synthetic preview resolver used by Design Lab; the normal product shell exposes a clearly labelled Help launcher for every toured page and signed-in role plus persistent support and contact destinations; and the derived product requirement registry currently contains zero excluded requirements, so there is no remaining exclusion requiring an owner and reason. This proves current local source contracts only; it does not prove browser rendering, user comprehension, provider behavior, deployed parity, production readiness, or that open requirements are exclusions.";

export const PRODUCT_LOCAL_COMPLETION_REQUIREMENT_IDS = [
  "COMPLETE.EVIDENCE.tour-lab-coverage",
  "COMPLETE.EVIDENCE.exclusions",
  "COMPLETE.UNDERSTAND.help",
] as const;

export type ProductLocalCompletionRequirementId =
  (typeof PRODUCT_LOCAL_COMPLETION_REQUIREMENT_IDS)[number];

export const PRODUCT_LOCAL_COMPLETION_EXPECTED_GAIN =
  PRODUCT_LOCAL_COMPLETION_REQUIREMENT_IDS.length;

type ProductLocalCompletionEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_LOCAL_COMPLETION_EVIDENCE_FILE,
  PRODUCT_LOCAL_COMPLETION_TEST_FILE,
] as const;

export const PRODUCT_LOCAL_COMPLETION_MASTER_EVIDENCE = {
  "COMPLETE.EVIDENCE.tour-lab-coverage": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/components/onboarding-tour-registry.ts",
      "src/components/design-lab-scenario-controls.tsx",
      "src/components/product-onboarding-capability-evidence.test.ts",
    ],
  },
  "COMPLETE.EVIDENCE.exclusions": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/components/master-audit-requirements.ts",
    ],
  },
  "COMPLETE.UNDERSTAND.help": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/layout.tsx",
      "src/components/interactive-help.tsx",
      "src/components/site-header.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductLocalCompletionRequirementId,
    ProductLocalCompletionEvidenceRecord
  >
>;
