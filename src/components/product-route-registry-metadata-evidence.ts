import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_FILE =
  "src/components/product-route-registry-metadata-evidence.ts" as const;
export const PRODUCT_ROUTE_REGISTRY_METADATA_TEST_FILE =
  "src/components/product-route-registry-metadata-evidence.test.ts" as const;

export const PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_SCOPE =
  "Source-static verification of eight metadata fields on the current 97 screen contracts. Tested means the registry records source-declared query parameters, entry points, primary actions, forms, supported states, relevant feature flags, Design Lab fixture IDs, and either an onboarding tour ID or a tested exclusion; it does not establish rendered or runtime behaviour, state completeness, hydrated fixtures, production parity, or release readiness.";

export const PRODUCT_ROUTE_REGISTRY_METADATA_REQUIREMENT_IDS = [
  "REG.ROUTE.field-query-parameters",
  "REG.ROUTE.field-primary-actions",
  "REG.ROUTE.field-forms",
  "REG.ROUTE.field-supported-states",
  "REG.ROUTE.field-fixtures",
  "REG.ROUTE.field-feature-flags",
  "REG.ROUTE.field-entry-points",
  "REG.ROUTE.field-tour",
] as const;

export const PRODUCT_ROUTE_REGISTRY_METADATA_OPEN_REQUIREMENTS = {
  "REG.ROUTE.drives-navigation":
    "Application navigation is not generated from the screen-contract registry.",
  "REG.ROUTE.drives-onboarding":
    "Onboarding tours are not generated from the screen-contract registry.",
  "REG.ROUTE.drives-access":
    "Runtime role and tier enforcement does not consume the screen-contract registry.",
  "REG.ROUTE.drives-fixtures":
    "The registry records fixture IDs but does not drive fixture execution.",
  "REG.ROUTE.field-secondary-actions":
    "Secondary actions remain empty even where screens expose secondary controls.",
  "REG.ROUTE.field-data-dependencies":
    "Data dependencies remain empty despite production screens reading data.",
} as const;

type ProductRouteRegistryMetadataEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  "src/components/demo-experience-registry.ts",
  "src/components/demo-experience-registry.test.ts",
  PRODUCT_ROUTE_REGISTRY_METADATA_EVIDENCE_FILE,
  PRODUCT_ROUTE_REGISTRY_METADATA_TEST_FILE,
] as const;

export const PRODUCT_ROUTE_REGISTRY_METADATA_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_ROUTE_REGISTRY_METADATA_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "tested" as const, evidence: SHARED_EVIDENCE },
    ]),
  ) as Readonly<
    Record<string, ProductRouteRegistryMetadataEvidenceRecord>
  >;
