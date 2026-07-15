import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import { DESIGN_LAB_INSPECTOR_DIMENSIONS } from "./design-lab-contract-inspector-model";
import { DEMO_SCREEN_COUNT } from "./demo-experience-registry";

export const PRODUCT_DESIGN_LAB_INSPECTOR_EVIDENCE_FILE =
  "src/components/product-design-lab-inspector-evidence.ts" as const;
export const PRODUCT_DESIGN_LAB_INSPECTOR_TEST_FILE =
  "src/components/product-design-lab-inspector-evidence.test.ts" as const;

export const PRODUCT_DESIGN_LAB_INSPECTOR_EVIDENCE_SCOPE =
  `Source and server-render verification that the standard Design Lab Screen Library exposes every one of the 19 required contract-inspector dimensions for all ${DEMO_SCREEN_COUNT} registered contracts. Missing metadata is rendered as an explicit gap; this evidence does not promote the underlying screen behavior, prove hydrated route selection, or replace production/runtime evidence.`;

export const PRODUCT_DESIGN_LAB_INSPECTOR_REQUIREMENT_IDS =
  DESIGN_LAB_INSPECTOR_DIMENSIONS.map((dimension) => dimension.id);

export type ProductDesignLabInspectorEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_DESIGN_LAB_INSPECTOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_INSPECTOR_TEST_FILE,
  "src/components/design-lab-contract-inspector.tsx",
  "src/components/design-lab-contract-inspector-model.ts",
  "src/components/design-lab-contract-inspector.test.tsx",
  "src/components/demo-experience-screen-map.tsx",
  "src/components/demo-experience-registry.ts",
] as const;

export const PRODUCT_DESIGN_LAB_INSPECTOR_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_DESIGN_LAB_INSPECTOR_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "tested" as const, evidence: SHARED_EVIDENCE },
  ]),
) as Readonly<Record<string, ProductDesignLabInspectorEvidenceRecord>>;
