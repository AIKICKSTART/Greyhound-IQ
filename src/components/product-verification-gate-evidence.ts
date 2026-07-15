import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import { DEMO_SCREEN_COUNT } from "./demo-experience-registry";

export const PRODUCT_VERIFICATION_GATE_EVIDENCE_FILE =
  "src/components/product-verification-gate-evidence.ts" as const;
export const PRODUCT_VERIFICATION_GATE_TEST_FILE =
  "src/components/product-verification-gate-evidence.test.ts" as const;

export const PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE =
  `Deterministic source, focused-unit and source-fingerprint-bound loopback Chrome verification that the existing test runner and CI execute route and component-interaction contracts; every local page route has one canonical screen contract, a concrete Design Lab fixture and a resolvable source file; all ${DEMO_SCREEN_COUNT} screen contracts record authentication, role, tier and permission metadata; focused access tests fail when signed-out protected reads can precede their guards; isolated Design Lab demo traffic rejects non-read HTTP methods; and representative HTTP plus hydrated Design Lab journeys execute with exact manifests and no production mutation. This evidence does not prove the 22 exhaustive production journeys, deployed configuration or roles, live provider or database behavior, exhaustive internal-link, action, field, state, tour or destructive-operation coverage, or production readiness.`;

export const PRODUCT_VERIFICATION_GATE_REQUIREMENT_IDS = [
  "VERIFY.LEVEL.existing-stack",
  "VERIFY.LEVEL.route",
  "VERIFY.LEVEL.component",
  "VERIFY.LEVEL.e2e",
  "VERIFY.GATE.app-route-in-lab",
  "VERIFY.GATE.lab-route-exists",
  "VERIFY.GATE.access-metadata",
  "VERIFY.GATE.signed-out-protected",
  "VERIFY.GATE.lab-production-mutation",
] as const;

export type ProductVerificationGateRequirementId =
  (typeof PRODUCT_VERIFICATION_GATE_REQUIREMENT_IDS)[number];

export const PRODUCT_VERIFICATION_GATE_OPEN_REQUIREMENT_IDS = [
  "VERIFY.GATE.field-label",
  "VERIFY.GATE.state-fixture",
  "VERIFY.GATE.tour-target",
  "VERIFY.GATE.tour-keyboard",
  "VERIFY.GATE.unauthorised-destructive",
] as const;

export type ProductVerificationGateOpenRequirementId =
  (typeof PRODUCT_VERIFICATION_GATE_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_VERIFICATION_GATE_OPEN_GAPS = {
  "VERIFY.GATE.field-label":
    "No exhaustive form-control inventory currently parses every rendered field and proves its accessible label association. Selected semantic tests are insufficient for this whole-product claim.",
  "VERIFY.GATE.state-fixture":
    "All registered screens have a default Design Lab fixture, but the registry does not yet require a distinct reproducible fixture for every declared loading, empty, error, denied and populated state.",
  "VERIFY.GATE.tour-target":
    "Tour contracts are being completed in the separate onboarding lane. This batch does not prove that every tour target exists in the final browser DOM for every responsive layout.",
  "VERIFY.GATE.tour-keyboard":
    "Source tour metadata cannot prove keyboard completion, focus movement or escape behavior. This remains open pending focused browser accessibility journeys in the onboarding lane.",
  "VERIFY.GATE.unauthorised-destructive":
    "Focused administration and member access tests cover protected reads and selected mutations, but no exhaustive registry yet maps every destructive control to every denied role and server-side guard.",
} as const satisfies Readonly<
  Record<ProductVerificationGateOpenRequirementId, string>
>;

export const PRODUCT_VERIFICATION_GATE_EXPECTED_GAIN =
  PRODUCT_VERIFICATION_GATE_REQUIREMENT_IDS.length;

type ProductVerificationGateEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_VERIFICATION_GATE_EVIDENCE_FILE,
  PRODUCT_VERIFICATION_GATE_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductVerificationGateEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE = {
  "VERIFY.LEVEL.existing-stack": tested(
    "package.json",
    "scripts/run-unit-tests.ts",
    ".github/workflows/ci.yml",
  ),
  "VERIFY.LEVEL.route": tested(
    "src/app/api/health/ready/route.test.ts",
    "src/app/api/internal/live-sync/route.test.ts",
    "src/app/api/replay/stream/route.test.ts",
  ),
  "VERIFY.LEVEL.component": tested(
    "src/components/marketplace-card-gesture.test.ts",
    "src/components/site-header-mobile-navigation.test.ts",
    "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  ),
  "VERIFY.LEVEL.e2e": tested(
    "scripts/audit-design-lab-user-stories.ts",
    "scripts/audit-design-lab-user-stories.test.ts",
    "scripts/audit-design-lab-hydrated-stories.ts",
    "scripts/audit-design-lab-hydrated-stories.test.ts",
    "scripts/audit-design-lab-hydrated-wave2.ts",
    "scripts/audit-design-lab-hydrated-wave2.test.ts",
    "output/demo-route-audit/design-lab-user-stories.json",
    "output/demo-route-audit/design-lab-hydrated-stories.json",
    "output/demo-route-audit/design-lab-hydrated-wave2.json",
  ),
  "VERIFY.GATE.app-route-in-lab": tested(
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-screen-map.tsx",
  ),
  "VERIFY.GATE.lab-route-exists": tested(
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-screen-map.tsx",
  ),
  "VERIFY.GATE.access-metadata": tested(
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/screen-permission-evidence.ts",
    "src/components/screen-contracts/production-screen-messaging-access-state-evidence.ts",
    "src/components/screen-contracts/production-screen-member-access-state-evidence.ts",
    "src/components/screen-contracts/production-screen-admin-access-state-evidence.ts",
  ),
  "VERIFY.GATE.signed-out-protected": tested(
    "src/components/screen-contracts/screen-permission-evidence.test.ts",
    "src/components/screen-contracts/production-screen-messaging-access-state-evidence.test.ts",
    "src/components/screen-contracts/production-screen-member-access-state-evidence.test.ts",
    "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts",
  ),
  "VERIFY.GATE.lab-production-mutation": tested(
    "src/lib/demo-access.ts",
    "src/lib/demo-access.test.ts",
    "src/lib/demo-production-isolation.test.ts",
    "src/proxy.ts",
    "security/design-lab-isolation-evidence.test.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductVerificationGateRequirementId,
    ProductVerificationGateEvidenceRecord
  >
>;
