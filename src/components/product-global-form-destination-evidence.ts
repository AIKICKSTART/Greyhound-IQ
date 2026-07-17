import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_GLOBAL_FORM_DESTINATION_EVIDENCE_FILE =
  "src/components/product-global-form-destination-evidence.ts" as const;
export const PRODUCT_GLOBAL_FORM_DESTINATION_TEST_FILE =
  "src/components/product-global-form-destination-evidence.test.ts" as const;

export const PRODUCT_GLOBAL_FORM_DESTINATION_SCOPE =
  "Deterministic source-static verification of all 145 registered route-scoped forms. Every declared destination resolves to an existing page, matching HTTP route-handler method, or exported server action. This proves the current repository destination contract only; it does not prove hydrated submission, database persistence, external-provider delivery, deployed parity, or production readiness.";

export const PRODUCT_GLOBAL_FORM_DESTINATION_REQUIREMENT_IDS = [
  "GLOBAL.FUNC.forms",
] as const;

type ProductGlobalFormDestinationRequirementId =
  (typeof PRODUCT_GLOBAL_FORM_DESTINATION_REQUIREMENT_IDS)[number];

type ProductGlobalFormDestinationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_GLOBAL_FORM_DESTINATION_MASTER_EVIDENCE = {
  "GLOBAL.FUNC.forms": {
    status: "tested",
    evidence: [
      PRODUCT_GLOBAL_FORM_DESTINATION_EVIDENCE_FILE,
      PRODUCT_GLOBAL_FORM_DESTINATION_TEST_FILE,
      "src/components/product-form-operational-contract-registry.ts",
      "src/components/demo-experience-registry.ts",
      "security/endpoints.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductGlobalFormDestinationRequirementId,
    ProductGlobalFormDestinationEvidenceRecord
  >
>;
