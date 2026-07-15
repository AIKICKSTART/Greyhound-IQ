import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_EVIDENCE_FILE =
  "src/components/product-design-lab-route-selector-evidence.ts" as const;
export const PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_TEST_FILE =
  "src/components/product-design-lab-route-selector-evidence.test.ts" as const;

export const PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_REQUIREMENT_IDS = [
  "DL.SELECT.route",
  "DL.URL.route",
] as const;

export const PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_SCOPE =
  "The protected Design Lab contract inspector selects one of the 90 allowlisted route contracts, writes that exact route to the current same-origin URL while preserving non-sensitive categorical query state, strips transient free-text audit and work searches, restores a copied or reloaded selection through the server page input, and follows browser history changes. It does not claim selectors or URL persistence for any other scenario dimension.";

type RouteSelectorEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_TEST_FILE,
  "src/components/design-lab-contract-inspector.tsx",
  "src/components/design-lab-contract-inspector-model.ts",
  "src/components/design-lab-contract-inspector.test.tsx",
  "src/app/design-lab/page.tsx",
  "src/app/design-lab/demo-experience/page.tsx",
] as const;

export const PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "tested" as const, evidence: SHARED_EVIDENCE },
    ]),
  ) as Readonly<Record<string, RouteSelectorEvidenceRecord>>;
