import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_STORY_CONTRACT_FIELD_EVIDENCE_FILE =
  "src/components/product-story-contract-field-evidence.ts" as const;
export const PRODUCT_STORY_CONTRACT_FIELD_TEST_FILE =
  "src/components/product-story-contract-field-evidence.test.ts" as const;

export const PRODUCT_STORY_CONTRACT_FIELD_EVIDENCE_SCOPE =
  "Source-static verification that every canonical route owns one inline or detailed user story and a matching ScreenContract record for actor, value, entry point, precondition, access, tier, feature-flag, dependency, happy-path, action, form, concrete-navigation, fixture, source, and test metadata. Explicit empty route arrays remain truthful declarations of no registered item; this evidence does not prove runtime behavior, business completeness, route-audit currency, alternative or failure paths, UI states, analytics, onboarding, accessibility, mobile behavior, or production readiness.";

export const PRODUCT_STORY_CONTRACT_FIELD_REQUIREMENT_IDS = [
  "STORY.FIELD.actor",
  "STORY.FIELD.value",
  "STORY.FIELD.entry-points",
  "STORY.FIELD.preconditions",
  "STORY.FIELD.permissions",
  "STORY.FIELD.subscription",
  "STORY.FIELD.feature-flags",
  "STORY.FIELD.required-data",
  "STORY.FIELD.happy-path",
  "STORY.FIELD.actions",
  "STORY.FIELD.forms",
  "STORY.FIELD.navigation-result",
  "STORY.FIELD.fixtures",
  "STORY.FIELD.tests",
] as const;

export type ProductStoryContractFieldRequirementId =
  (typeof PRODUCT_STORY_CONTRACT_FIELD_REQUIREMENT_IDS)[number];

export const PRODUCT_STORY_CONTRACT_FIELD_OPEN_REQUIREMENT_IDS = [
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

export const PRODUCT_STORY_CONTRACT_FIELD_EXPECTED_GAIN =
  PRODUCT_STORY_CONTRACT_FIELD_REQUIREMENT_IDS.length;

type ProductStoryContractFieldEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_STORY_CONTRACT_FIELD_EVIDENCE_FILE,
  PRODUCT_STORY_CONTRACT_FIELD_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/design-lab-user-stories.ts",
] as const;

function tested(): ProductStoryContractFieldEvidenceRecord {
  return { status: "tested", evidence: EVIDENCE };
}

export const PRODUCT_STORY_CONTRACT_FIELD_MASTER_EVIDENCE = {
  "STORY.FIELD.actor": tested(),
  "STORY.FIELD.value": tested(),
  "STORY.FIELD.entry-points": tested(),
  "STORY.FIELD.preconditions": tested(),
  "STORY.FIELD.permissions": tested(),
  "STORY.FIELD.subscription": tested(),
  "STORY.FIELD.feature-flags": tested(),
  "STORY.FIELD.required-data": tested(),
  "STORY.FIELD.happy-path": tested(),
  "STORY.FIELD.actions": tested(),
  "STORY.FIELD.forms": tested(),
  "STORY.FIELD.navigation-result": tested(),
  "STORY.FIELD.fixtures": tested(),
  "STORY.FIELD.tests": tested(),
} as const satisfies Readonly<
  Record<
    ProductStoryContractFieldRequirementId,
    ProductStoryContractFieldEvidenceRecord
  >
>;
