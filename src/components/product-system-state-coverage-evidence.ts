import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SYSTEM_STATE_COVERAGE_EVIDENCE_FILE =
  "src/components/product-system-state-coverage-evidence.ts" as const;
export const PRODUCT_SYSTEM_STATE_COVERAGE_TEST_FILE =
  "src/components/product-system-state-coverage-evidence.test.ts" as const;

export const PRODUCT_SYSTEM_STATE_COVERAGE_REQUIREMENT_IDS = [
  "SYSTEM.design-lab",
  "SYSTEM.automated-tests",
] as const;

export const PRODUCT_SYSTEM_STATE_COVERAGE_SCOPE =
  "Deterministic source-static proof that every concrete SYSTEM state has one distinct, URL-selectable synthetic Design Lab presentation with its own recovery direction, and an executable contract verifies the complete mapping. This does not prove browser rendering, production route execution, a compatibility policy, provider callbacks, deployed dependencies, or production readiness.";

type ProductSystemStateCoverageEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_SYSTEM_STATE_COVERAGE_EVIDENCE_FILE,
  PRODUCT_SYSTEM_STATE_COVERAGE_TEST_FILE,
  "src/components/design-lab-scenario-contract.ts",
  "src/components/design-lab-scenario-state.test.ts",
  "src/components/design-lab-scenario-controls.tsx",
] as const;

const TESTED = {
  status: "tested",
  evidence: EVIDENCE,
} as const satisfies ProductSystemStateCoverageEvidenceRecord;

export const PRODUCT_SYSTEM_STATE_COVERAGE_MASTER_EVIDENCE = {
  "SYSTEM.design-lab": TESTED,
  "SYSTEM.automated-tests": TESTED,
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_SYSTEM_STATE_COVERAGE_REQUIREMENT_IDS)[number],
    ProductSystemStateCoverageEvidenceRecord
  >
>;
