import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE =
  "src/components/product-field-contract-source-evidence.ts" as const;
export const PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE =
  "src/components/product-field-contract-source-evidence.test.ts" as const;

export const PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE =
  "Deterministic source-static field inventory across all 97 registered screen routes and their complete reachable local source closures, with an exact one-to-one record for every discovered route/source/control identifier. Every record explicitly captures registry name, submitted name or absence, visible and accessible label source or absence, input and inferred data type, required/default/placeholder/help metadata, character and numeric constraints, native source-declared validation attributes, file type and tier-owned file-size policy, source classification, source-visible persistence destination, conservative privacy classification, route or field-specific onboarding, mobile input, autofill, read-only/disabled state, conditional visibility and the hidden/generated-id/consent/media/disclosure/billing/dependent categories. Persistence distinguishes URL query, form action, caller-owned form, component state and non-submitted controls; privacy distinguishes credential, personal, user-content, identifier, billing, consent, public-racing and operational data. Combined with the separately tested exact route/form operational register, this provides the complete source-static form and field registry output. Null and false values are explicit observations, not claims that a visible label, accessible name or validation constraint exists; empty validation-rule values are likewise explicit. This batch does not promote sanitisation or per-field error requirements. It does not prove hydration, submission, browser-native validation behaviour, browser accessibility or deployed parity. It also does not prove downstream database storage or runtime data values.";

export const PRODUCT_FIELD_CONTRACT_SOURCE_REQUIREMENT_IDS = [
  "FIELD.FIELD.name",
  "FIELD.FIELD.visible-label",
  "FIELD.FIELD.accessible-label",
  "FIELD.FIELD.input-type",
  "FIELD.FIELD.data-type",
  "FIELD.FIELD.required",
  "FIELD.FIELD.default",
  "FIELD.FIELD.placeholder",
  "FIELD.FIELD.help",
  "FIELD.FIELD.character-limits",
  "FIELD.FIELD.numeric-limits",
  "FIELD.FIELD.file-types",
  "FIELD.FIELD.file-sizes",
  "FIELD.FIELD.validation",
  "FIELD.FIELD.source",
  "FIELD.FIELD.onboarding",
  "FIELD.FIELD.mobile-input",
  "FIELD.FIELD.autofill",
  "FIELD.FIELD.read-only-disabled",
  "FIELD.FIELD.conditional-visibility",
  "FIELD.FIELD.hidden",
  "FIELD.FIELD.generated-ids",
  "FIELD.FIELD.consent",
  "FIELD.FIELD.media-metadata",
  "FIELD.FIELD.disclosures",
  "FIELD.FIELD.billing-intent",
  "FIELD.FIELD.dependent-fields",
  "FIELD.FIELD.persistence",
  "FIELD.FIELD.privacy",
] as const;

export const PRODUCT_FIELD_CONTRACT_SOURCE_OPEN_REQUIREMENT_IDS = [
  "FIELD.FIELD.sanitisation",
  "FIELD.FIELD.error",
] as const;

export const PRODUCT_FORM_FIELD_REGISTRY_OUTPUT_REQUIREMENT_IDS = [
  "OUT.form-field-registry",
] as const;

export type ProductFieldContractSourceRequirementId =
  (typeof PRODUCT_FIELD_CONTRACT_SOURCE_REQUIREMENT_IDS)[number];

type ProductFieldContractSourceMasterRequirementId =
  | ProductFieldContractSourceRequirementId
  | (typeof PRODUCT_FORM_FIELD_REGISTRY_OUTPUT_REQUIREMENT_IDS)[number];

export const PRODUCT_FIELD_CONTRACT_SOURCE_EXPECTED_GAIN =
  PRODUCT_FIELD_CONTRACT_SOURCE_REQUIREMENT_IDS.length +
  PRODUCT_FORM_FIELD_REGISTRY_OUTPUT_REQUIREMENT_IDS.length;

type ProductFieldContractSourceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE,
  PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE,
  "src/components/product-field-contract-source-registry.ts",
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/media-attachment-fields.tsx",
  "src/lib/billing/entitlements.ts",
] as const;

const FORM_FIELD_REGISTRY_OUTPUT_EVIDENCE = [
  ...EVIDENCE,
  "src/components/product-form-operational-contract-evidence.ts",
  "src/components/product-form-operational-contract-evidence.test.ts",
  "src/components/product-form-operational-contract-registry.ts",
  "docs/product/form-field-registry.md",
] as const;

function tested(): ProductFieldContractSourceEvidenceRecord {
  return { status: "tested", evidence: EVIDENCE };
}

export const PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE = {
  "FIELD.FIELD.name": tested(),
  "FIELD.FIELD.visible-label": tested(),
  "FIELD.FIELD.accessible-label": tested(),
  "FIELD.FIELD.input-type": tested(),
  "FIELD.FIELD.data-type": tested(),
  "FIELD.FIELD.required": tested(),
  "FIELD.FIELD.default": tested(),
  "FIELD.FIELD.placeholder": tested(),
  "FIELD.FIELD.help": tested(),
  "FIELD.FIELD.character-limits": tested(),
  "FIELD.FIELD.numeric-limits": tested(),
  "FIELD.FIELD.file-types": tested(),
  "FIELD.FIELD.file-sizes": tested(),
  "FIELD.FIELD.validation": tested(),
  "FIELD.FIELD.source": tested(),
  "FIELD.FIELD.onboarding": tested(),
  "FIELD.FIELD.mobile-input": tested(),
  "FIELD.FIELD.autofill": tested(),
  "FIELD.FIELD.read-only-disabled": tested(),
  "FIELD.FIELD.conditional-visibility": tested(),
  "FIELD.FIELD.hidden": tested(),
  "FIELD.FIELD.generated-ids": tested(),
  "FIELD.FIELD.consent": tested(),
  "FIELD.FIELD.media-metadata": tested(),
  "FIELD.FIELD.disclosures": tested(),
  "FIELD.FIELD.billing-intent": tested(),
  "FIELD.FIELD.dependent-fields": tested(),
  "FIELD.FIELD.persistence": tested(),
  "FIELD.FIELD.privacy": tested(),
  "OUT.form-field-registry": {
    status: "tested",
    evidence: FORM_FIELD_REGISTRY_OUTPUT_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductFieldContractSourceMasterRequirementId,
    ProductFieldContractSourceEvidenceRecord
  >
>;
