import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";

export const PRODUCT_AUTOMATED_SOURCE_GATE_EVIDENCE_FILE =
  "src/components/product-automated-source-gate-evidence.ts" as const;
export const PRODUCT_AUTOMATED_SOURCE_GATE_TEST_FILE =
  "src/components/product-automated-source-gate-evidence.test.ts" as const;
export const PRODUCT_AUTOMATED_SOURCE_GATE_REGISTRY_FILE =
  "src/components/product-automated-source-gate-registry.ts" as const;

const stateRules = SCREEN_CONTRACTS.flatMap((screen) => screen.stateRules);

export const PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY = {
  screenCount: SCREEN_CONTRACTS.length,
  primaryActionCount: SCREEN_CONTRACTS.reduce(
    (total, screen) => total + screen.primaryActions.length,
    0,
  ),
  stateCount: stateRules.length,
  stateFixtureCount: stateRules.filter((state) => state.fixtureId).length,
  missingStateFixtureCount: stateRules.filter((state) => !state.fixtureId).length,
  recoveryActionCount: stateRules.filter((state) => state.recoveryActionId).length,
} as const;

export const PRODUCT_AUTOMATED_SOURCE_GATE_SCOPE =
  `Deterministic source-static gates over all ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.screenCount} registered screens. The internal-link gate parses source-resolvable JSX hrefs, href catalogue properties and redirect/router navigation calls from every registered route's recursive local source closure, then requires all current source-resolvable internal targets to match an actual page or route-handler pattern. The primary-action evaluator checks all ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.primaryActionCount} route-scoped actions separately: implementation evidence must bind the exact action ID to an implementing handler token or destination control, and focused-test evidence must contain the exact action ID plus one of that action's declared test IDs. Unrelated source signals or route-level test files cannot satisfy another action. VERIFY.GATE.primary-action remains blocked while any per-action binding is absent. Synthetic missing-route, unrelated-action, missing-handler and missing-destination fixtures prove the checks fail closed. This source gate does not claim browser rendering, click execution, server authorisation, persistence, deployment parity or production readiness. VERIFY.GATE.state-fixture remains open because only ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateFixtureCount} of ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateCount} declared states currently have fixture IDs; the other ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.missingStateFixtureCount} are reported without fabricated fixtures.`;

export const PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS = [
  "VERIFY.GATE.internal-link",
  "VERIFY.GATE.primary-action",
] as const;

export type ProductAutomatedSourceGateRequirementId =
  (typeof PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS)[number];

export const PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_REQUIREMENT_IDS = [
  "VERIFY.GATE.primary-action",
  "VERIFY.GATE.state-fixture",
] as const;

export type ProductAutomatedSourceGateOpenRequirementId =
  (typeof PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_AUTOMATED_SOURCE_GATE_OPEN_GAPS = {
  "VERIFY.GATE.primary-action":
    "The per-action registry reports every exact implementation or focused-test binding that is missing. The requirement remains blocked until every route-scoped action is independently source-backed and test-backed; route-level evidence is not accepted.",
  "VERIFY.GATE.state-fixture":
    `The exact state registry contains ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.stateCount} route-scoped states, but ${PRODUCT_AUTOMATED_SOURCE_GATE_SUMMARY.missingStateFixtureCount} do not have a reproducible fixtureId. The negative fixture test detects this gap; no placeholder fixture IDs are accepted as completion evidence.`,
} as const satisfies Readonly<
  Record<ProductAutomatedSourceGateOpenRequirementId, string>
>;

export const PRODUCT_AUTOMATED_SOURCE_GATE_EXPECTED_GAIN =
  1;

type ProductAutomatedSourceGateEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_AUTOMATED_SOURCE_GATE_EVIDENCE_FILE,
  PRODUCT_AUTOMATED_SOURCE_GATE_TEST_FILE,
  PRODUCT_AUTOMATED_SOURCE_GATE_REGISTRY_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
  "security/endpoints.ts",
] as const;

function tested(): ProductAutomatedSourceGateEvidenceRecord {
  return { status: "tested", evidence: EVIDENCE };
}

function blocked(): ProductAutomatedSourceGateEvidenceRecord {
  return { status: "blocked", evidence: EVIDENCE };
}

export const PRODUCT_AUTOMATED_SOURCE_GATE_MASTER_EVIDENCE = {
  "VERIFY.GATE.internal-link": tested(),
  "VERIFY.GATE.primary-action": blocked(),
} as const satisfies Readonly<
  Record<
    ProductAutomatedSourceGateRequirementId,
    ProductAutomatedSourceGateEvidenceRecord
  >
>;
