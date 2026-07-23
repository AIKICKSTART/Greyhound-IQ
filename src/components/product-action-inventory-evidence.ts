import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
} from "./screen-contracts/production-screen-coverage";

export const PRODUCT_ACTION_INVENTORY_EVIDENCE_FILE =
  "src/components/product-action-inventory-evidence.ts" as const;
export const PRODUCT_ACTION_INVENTORY_TEST_FILE =
  "src/components/product-action-inventory-evidence.test.ts" as const;

export const PRODUCT_ACTION_INVENTORY_SUMMARY = {
  screenCount: SCREEN_CONTRACTS.length,
  productionContractCount: Object.keys(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).length,
  exclusionCount: PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES.length,
  designLabManifestCount: DESIGN_LAB_USER_STORY_MANIFESTS.length,
  actionCount:
    Object.values(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).reduce(
      (total, contract) => total + contract.actions.length,
      0,
    ) +
    DESIGN_LAB_USER_STORY_MANIFESTS.reduce(
      (total, manifest) => total + manifest.actions.length,
      0,
    ),
} as const;

export const PRODUCT_ACTION_INVENTORY_SCOPE =
  `Deterministic source and focused-unit verification that all ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} registered screens have a route-scoped action inventory: ${PRODUCT_ACTION_INVENTORY_SUMMARY.productionContractCount} production screens map their recursive source action surface to structured contracts, ${PRODUCT_ACTION_INVENTORY_SUMMARY.exclusionCount} production screens have tested zero-action exclusions with an owner and reason, and ${PRODUCT_ACTION_INVENTORY_SUMMARY.designLabManifestCount} Design Lab screens map source-detected action surfaces to structured manifests. The registry currently contains ${PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount} route-scoped action entries with stable ids, declared results, enforcement notes and test references. This evidence proves inventory and source mapping only. It does not prove hydrated execution, pending, success, failure or permission-denied behavior, server authorization, mutation results, analytics or audit events, accessibility, current browser-audit freshness, deployed parity, or production readiness.`;

export const PRODUCT_ACTION_INVENTORY_REQUIREMENT_IDS = [
  "OUT.action-inventory",
  "COMPLETE.EVIDENCE.actions-mapped",
] as const;

export type ProductActionInventoryRequirementId =
  (typeof PRODUCT_ACTION_INVENTORY_REQUIREMENT_IDS)[number];

export const PRODUCT_ACTION_INVENTORY_EXPECTED_GAIN =
  PRODUCT_ACTION_INVENTORY_REQUIREMENT_IDS.length;

type ProductActionInventoryEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_ACTION_INVENTORY_EVIDENCE_FILE,
  PRODUCT_ACTION_INVENTORY_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductActionInventoryEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_ACTION_INVENTORY_MASTER_EVIDENCE = {
  "OUT.action-inventory": tested(
    "docs/product/action-inventory.md",
    "docs/product/missing-action-report.md",
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/production-screen-coverage.ts",
    "src/components/screen-contracts/design-lab-user-stories.ts",
    "src/components/screen-contracts/screen-contract-source-audit.ts",
  ),
  "COMPLETE.EVIDENCE.actions-mapped": tested(
    "docs/product/action-inventory.md",
    "docs/product/missing-action-report.md",
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/production-screen-coverage.ts",
    "src/components/screen-contracts/design-lab-user-stories.ts",
    "src/components/screen-contracts/screen-contract-source-audit.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductActionInventoryRequirementId,
    ProductActionInventoryEvidenceRecord
  >
>;
