import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_FORM_CONTRACT_CORE_EVIDENCE_FILE =
  "src/components/product-form-contract-core-evidence.ts" as const;
export const PRODUCT_FORM_CONTRACT_CORE_TEST_FILE =
  "src/components/product-form-contract-core-evidence.test.ts" as const;

export const PRODUCT_FORM_CONTRACT_CORE_SCOPE =
  "Deterministic source-static verification that all 97 registered screens map their recursive form surface to 145 route-scoped form contracts or one explicit zero-form exclusion. Every mapped form records a stable route-scoped id, containing route, non-empty submission destination, validation schema, and focused test reference. This evidence proves core form inventory metadata and source mapping only; it does not prove complete field-level mapping, hydrated submission, authentication, ownership, role or tier policy, pending/success/failure behavior, duplicate prevention, analytics, audit emission, deployed parity, or production readiness.";

export const PRODUCT_FORM_CONTRACT_CORE_REQUIREMENT_IDS = [
  "FORM.FIELD.id",
  "FORM.FIELD.route",
  "FORM.FIELD.destination",
] as const;

export type ProductFormContractCoreRequirementId =
  (typeof PRODUCT_FORM_CONTRACT_CORE_REQUIREMENT_IDS)[number];

export const PRODUCT_FORM_CONTRACT_CORE_EXPECTED_GAIN =
  PRODUCT_FORM_CONTRACT_CORE_REQUIREMENT_IDS.length;

type ProductFormContractCoreEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_FORM_CONTRACT_CORE_EVIDENCE_FILE,
  PRODUCT_FORM_CONTRACT_CORE_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
] as const;

function tested(): ProductFormContractCoreEvidenceRecord {
  return { status: "tested", evidence: EVIDENCE };
}

export const PRODUCT_FORM_CONTRACT_CORE_MASTER_EVIDENCE = {
  "FORM.FIELD.id": tested(),
  "FORM.FIELD.route": tested(),
  "FORM.FIELD.destination": tested(),
} as const satisfies Readonly<
  Record<
    ProductFormContractCoreRequirementId,
    ProductFormContractCoreEvidenceRecord
  >
>;
