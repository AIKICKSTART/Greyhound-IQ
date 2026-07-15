import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_EVIDENCE_FILE =
  "src/components/product-design-lab-scenario-simulator-evidence.ts" as const;
export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_TEST_FILE =
  "src/components/product-design-lab-scenario-simulator-evidence.test.ts" as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SELECTOR_IDS = [
  "DL.SELECT.record",
  "DL.SELECT.tier",
  "DL.SELECT.auth",
  "DL.SELECT.permissions",
  "DL.SELECT.feature-flags",
  "DL.SELECT.orientation",
  "DL.SELECT.navigation",
  "DL.SELECT.data-state",
  "DL.SELECT.network-state",
  "DL.SELECT.error-state",
  "DL.SELECT.tour",
  "DL.SELECT.tour-step",
  "DL.SELECT.reduced-motion",
  "DL.SELECT.high-contrast",
  "DL.SELECT.long-content",
  "DL.SELECT.missing-image",
  "DL.SELECT.slow-network",
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_URL_IDS = [
  "DL.URL.fixture",
  "DL.URL.tier",
  "DL.URL.auth",
  "DL.URL.permissions",
  "DL.URL.orientation",
  "DL.URL.theme",
  "DL.URL.state",
  "DL.URL.tour",
  "DL.URL.tour-step",
  "DL.URL.sponsored-demo",
  "DL.URL.reduced-motion",
  "DL.URL.reproduce",
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_STATE_IDS = [
  "DL.STATE.default",
  "DL.STATE.initial-loading",
  "DL.STATE.background-refresh",
  "DL.STATE.skeleton",
  "DL.STATE.empty",
  "DL.STATE.no-results",
  "DL.STATE.partial",
  "DL.STATE.stale",
  "DL.STATE.delayed",
  "DL.STATE.recoverable-error",
  "DL.STATE.permission-denied",
  "DL.STATE.auth-required",
  "DL.STATE.subscription-required",
  "DL.STATE.feature-disabled",
  "DL.STATE.private",
  "DL.STATE.blocked",
  "DL.STATE.deleted",
  "DL.STATE.archived",
  "DL.STATE.suspended",
  "DL.STATE.missing-record",
  "DL.STATE.offline",
  "DL.STATE.success",
  "DL.STATE.optimistic",
  "DL.STATE.mutation-pending",
  "DL.STATE.mutation-failed",
  "DL.STATE.long-text",
  "DL.STATE.large-volume",
  "DL.STATE.missing-media",
  "DL.STATE.broken-media",
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SAFETY_IDS = [
  "DL.SAFE.fixture-privacy",
  "DL.SAFE.no-production-mutation",
  "DL.SAFE.simulate-destructive",
  "DL.SAFE.switchable-access",
  "DL.SAFE.no-private-content",
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_REQUIREMENT_IDS = [
  ...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SELECTOR_IDS,
  ...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_URL_IDS,
  ...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_STATE_IDS,
  ...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SAFETY_IDS,
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SCOPE =
  "Current-source-bound isolated loopback evidence for an allowlisted, client-only synthetic scenario simulator. Tested means each declared selector changes review state, every required URL dimension round-trips, all 29 state fixtures render in the simulator, and the destructive control emits no mutating request. It does not prove those states on every production screen, real authorization changes, deployed-image identity or production readiness.";

type ScenarioSimulatorEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_TEST_FILE,
  "src/components/design-lab-scenario-contract.ts",
  "src/components/design-lab-scenario-state.ts",
  "src/components/design-lab-scenario-state.test.ts",
  "src/components/design-lab-scenario-controls.tsx",
  "src/components/demo-experience-screen-map.tsx",
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "scripts/audit-design-lab-hydrated-stories.ts",
  "scripts/audit-design-lab-hydrated-stories.test.ts",
  "output/demo-route-audit/design-lab-hydrated-stories.json",
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        { status: "tested" as const, evidence: SHARED_EVIDENCE },
      ],
    ),
  ) as Readonly<Record<string, ScenarioSimulatorEvidenceRecord>>;
