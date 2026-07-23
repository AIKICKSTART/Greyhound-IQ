import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import {
  PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE,
  PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE,
} from "./product-field-contract-source-evidence";

export const PRODUCT_FORM_OPERATIONAL_CONTRACT_EVIDENCE_FILE =
  "src/components/product-form-operational-contract-evidence.ts" as const;
export const PRODUCT_FORM_OPERATIONAL_CONTRACT_TEST_FILE =
  "src/components/product-form-operational-contract-evidence.test.ts" as const;

export const PRODUCT_FORM_OPERATIONAL_CONTRACT_SCOPE =
  "Deterministic source-static operational register for every route-scoped form in all 103 screen contracts. Each record captures the source-declared route story, actors, purpose, destination, mutation transport, authentication, route permission rules, roles, tiers, transport-derived update strategy and exact route-source signals observed for pending, duplicate prevention, success, failure, audit and analytics. An empty signal list is an explicit recorded absence and remains visible as implementation work; it is not evidence that the behaviour exists. Route permission metadata is not proof of server-side function or object-level authorisation. This batch proves operational record completeness only and does not prove hydrated submission, cross-account denial, database persistence, idempotency, analytics delivery, audit durability, deployed parity or production readiness.";

export const PRODUCT_FORM_OPERATIONAL_CONTRACT_REQUIREMENT_IDS = [
  "FORM.FIELD.story",
  "FORM.FIELD.actor",
  "FORM.FIELD.purpose",
  "FORM.FIELD.mutation",
  "FORM.FIELD.authentication",
  "FORM.FIELD.ownership",
  "FORM.FIELD.role",
  "FORM.FIELD.tier",
  "FORM.FIELD.update-strategy",
  "FORM.FIELD.pending",
  "FORM.FIELD.duplicate-prevention",
  "FORM.FIELD.success",
  "FORM.FIELD.failure",
  "FORM.FIELD.audit",
  "FORM.FIELD.analytics",
] as const;

export const PRODUCT_FORM_MAPPING_COMPLETION_REQUIREMENT_IDS = [
  "COMPLETE.EVIDENCE.forms-mapped",
] as const;

export type ProductFormOperationalContractRequirementId =
  (typeof PRODUCT_FORM_OPERATIONAL_CONTRACT_REQUIREMENT_IDS)[number];

type ProductFormOperationalContractMasterRequirementId =
  | ProductFormOperationalContractRequirementId
  | (typeof PRODUCT_FORM_MAPPING_COMPLETION_REQUIREMENT_IDS)[number];

export const PRODUCT_FORM_OPERATIONAL_CONTRACT_EXPECTED_GAIN =
  PRODUCT_FORM_OPERATIONAL_CONTRACT_REQUIREMENT_IDS.length +
  PRODUCT_FORM_MAPPING_COMPLETION_REQUIREMENT_IDS.length;

type ProductFormOperationalContractEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_FORM_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
  PRODUCT_FORM_OPERATIONAL_CONTRACT_TEST_FILE,
  "src/components/product-form-operational-contract-registry.ts",
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/types.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
] as const;

const FORM_AND_FIELD_MAPPING_EVIDENCE = [
  ...EVIDENCE,
  PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE,
  PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE,
  "src/components/product-field-contract-source-registry.ts",
] as const;

function tested(): ProductFormOperationalContractEvidenceRecord {
  return { status: "tested", evidence: EVIDENCE };
}

export const PRODUCT_FORM_OPERATIONAL_CONTRACT_MASTER_EVIDENCE = {
  "FORM.FIELD.story": tested(),
  "FORM.FIELD.actor": tested(),
  "FORM.FIELD.purpose": tested(),
  "FORM.FIELD.mutation": tested(),
  "FORM.FIELD.authentication": tested(),
  "FORM.FIELD.ownership": tested(),
  "FORM.FIELD.role": tested(),
  "FORM.FIELD.tier": tested(),
  "FORM.FIELD.update-strategy": tested(),
  "FORM.FIELD.pending": tested(),
  "FORM.FIELD.duplicate-prevention": tested(),
  "FORM.FIELD.success": tested(),
  "FORM.FIELD.failure": tested(),
  "FORM.FIELD.audit": tested(),
  "FORM.FIELD.analytics": tested(),
  "COMPLETE.EVIDENCE.forms-mapped": {
    status: "tested",
    evidence: FORM_AND_FIELD_MAPPING_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductFormOperationalContractMasterRequirementId,
    ProductFormOperationalContractEvidenceRecord
  >
>;
