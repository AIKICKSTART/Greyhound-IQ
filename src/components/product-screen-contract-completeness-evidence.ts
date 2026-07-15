import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EVIDENCE_FILE =
  "src/components/product-screen-contract-completeness-evidence.ts" as const;
export const PRODUCT_SCREEN_CONTRACT_COMPLETENESS_TEST_FILE =
  "src/components/product-screen-contract-completeness-evidence.test.ts" as const;

export const PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE =
  "Deterministic source and focused-unit verification that all 97 registered screens map their authentication mode, supported roles, supported tiers and exact screen-level permission rules; and that all 90 production-enabled screens have a unique default Design Lab fixture reachable through the screen explorer. This evidence completes the screen-level permissions output and default production-screen Design Lab representation only. It does not prove deployed identity or IAM configuration, object- or field-level authorization, cross-tenant isolation, exhaustive action-by-role enforcement, browser rendering, every state or action parity, current browser-audit artifacts, or production readiness.";

export const PRODUCT_SCREEN_CONTRACT_COMPLETENESS_REQUIREMENT_IDS = [
  "OUT.permissions-matrix",
  "COMPLETE.EVIDENCE.production-lab-coverage",
] as const;

export type ProductScreenContractCompletenessRequirementId =
  (typeof PRODUCT_SCREEN_CONTRACT_COMPLETENESS_REQUIREMENT_IDS)[number];

export const PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EXPECTED_GAIN =
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_REQUIREMENT_IDS.length;

type ProductScreenContractCompletenessEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EVIDENCE_FILE,
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductScreenContractCompletenessEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_SCREEN_CONTRACT_COMPLETENESS_MASTER_EVIDENCE = {
  "OUT.permissions-matrix": tested(
    "docs/product/permissions-matrix.md",
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/screen-permission-evidence.ts",
    "src/components/screen-contracts/screen-permission-evidence.test.ts",
    "src/components/screen-contracts/production-screen-messaging-access-state-evidence.ts",
    "src/components/screen-contracts/production-screen-messaging-access-state-evidence.test.ts",
    "src/components/screen-contracts/production-screen-member-access-state-evidence.ts",
    "src/components/screen-contracts/production-screen-member-access-state-evidence.test.ts",
    "src/components/screen-contracts/production-screen-admin-access-state-evidence.ts",
    "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts",
  ),
  "COMPLETE.EVIDENCE.production-lab-coverage": tested(
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
    "src/components/demo-experience-screen-map.tsx",
    "docs/product/design-lab-coverage.md",
  ),
} as const satisfies Readonly<
  Record<
    ProductScreenContractCompletenessRequirementId,
    ProductScreenContractCompletenessEvidenceRecord
  >
>;
