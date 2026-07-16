import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_STORY_OPERATIONAL_CONTRACT_EVIDENCE_FILE =
  "src/components/product-story-operational-contract-evidence.ts" as const;
export const PRODUCT_STORY_OPERATIONAL_CONTRACT_TEST_FILE =
  "src/components/product-story-operational-contract-evidence.test.ts" as const;

export const PRODUCT_STORY_OPERATIONAL_CONTRACT_SCOPE =
  "Deterministic source-static operational register for all 97 canonical route stories. Each record joins the source-declared family goal and route outcome to alternative entry paths, expected and represented failure/private/loading/empty/success/recovery paths, exact route field and HTML-validation metadata, route-source analytics/audit signals, onboarding tour declaration or explicit absence, and family-level accessibility/mobile acceptance requirements. Empty field, signal or state lists are explicit recorded gaps, not claims that behaviour exists. HTML validation metadata does not prove server validation, permission metadata does not prove function or object-level authorisation, and source signal presence does not prove delivery. This batch proves story-record completeness only; it does not prove hydrated behavior, accessibility conformance, mobile rendering, deployed parity or production readiness.";

export const PRODUCT_STORY_OPERATIONAL_CONTRACT_REQUIREMENT_IDS = [
  "STORY.FIELD.goal",
  "STORY.FIELD.alternative-paths",
  "STORY.FIELD.failure-paths",
  "STORY.FIELD.blocked-private-paths",
  "STORY.FIELD.fields",
  "STORY.FIELD.validation",
  "STORY.FIELD.loading",
  "STORY.FIELD.empty",
  "STORY.FIELD.success",
  "STORY.FIELD.recoverable-error",
  "STORY.FIELD.analytics-audit",
  "STORY.FIELD.onboarding",
  "STORY.FIELD.accessibility",
  "STORY.FIELD.mobile",
] as const;

export type ProductStoryOperationalContractRequirementId =
  (typeof PRODUCT_STORY_OPERATIONAL_CONTRACT_REQUIREMENT_IDS)[number];

export const PRODUCT_STORY_OPERATIONAL_CONTRACT_EXPECTED_GAIN =
  PRODUCT_STORY_OPERATIONAL_CONTRACT_REQUIREMENT_IDS.length;

type ProductStoryOperationalContractEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_STORY_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
  PRODUCT_STORY_OPERATIONAL_CONTRACT_TEST_FILE,
  "src/components/product-story-operational-contract-registry.ts",
  "src/components/demo-experience-registry.ts",
  "src/components/product-field-contract-source-registry.ts",
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
] as const;

function tested(): ProductStoryOperationalContractEvidenceRecord {
  return { status: "tested", evidence: EVIDENCE };
}

export const PRODUCT_STORY_OPERATIONAL_CONTRACT_MASTER_EVIDENCE = {
  "STORY.FIELD.goal": tested(),
  "STORY.FIELD.alternative-paths": tested(),
  "STORY.FIELD.failure-paths": tested(),
  "STORY.FIELD.blocked-private-paths": tested(),
  "STORY.FIELD.fields": tested(),
  "STORY.FIELD.validation": tested(),
  "STORY.FIELD.loading": tested(),
  "STORY.FIELD.empty": tested(),
  "STORY.FIELD.success": tested(),
  "STORY.FIELD.recoverable-error": tested(),
  "STORY.FIELD.analytics-audit": tested(),
  "STORY.FIELD.onboarding": tested(),
  "STORY.FIELD.accessibility": tested(),
  "STORY.FIELD.mobile": tested(),
} as const satisfies Readonly<
  Record<
    ProductStoryOperationalContractRequirementId,
    ProductStoryOperationalContractEvidenceRecord
  >
>;
