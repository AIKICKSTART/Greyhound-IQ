import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_COVERAGE_AREAS,
} from "./demo-experience-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";

export const REQUIRED_INPUT_REGISTRY_EVIDENCE_TEST =
  "src/components/security-required-input-evidence.test.ts";

export const REQUIRED_INPUT_REGISTRY_REQUIREMENT_IDS = {
  product: "security.required-input-registry.product",
  userStory: "security.required-input-registry.user-story",
  route: "security.required-input-registry.route",
  action: "security.required-input-registry.action",
  form: "security.required-input-registry.form",
  field: "security.required-input-registry.field",
  designLab: "security.required-input-registry.design-lab",
} as const;

export type RequiredInputRegistrySnapshot = {
  productIds: readonly string[];
  userStoryIds: readonly string[];
  routeIds: readonly string[];
  actionIds: readonly string[];
  formIds: readonly string[];
  fieldSchemas: readonly string[];
  designLabRoutes: readonly string[];
  releaseGateAreas: readonly string[];
};

const interactionContracts = Object.values(
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
);
const registeredActionIds = SCREEN_CONTRACTS.flatMap(
  ({ primaryActions, secondaryActions }) => [
    ...primaryActions,
    ...secondaryActions,
  ],
);
const registeredFormIds = SCREEN_CONTRACTS.flatMap(({ forms }) =>
  forms.map((form) => form.split(" -> ", 1)[0]),
);

export const REQUIRED_INPUT_REGISTRY_SNAPSHOT: RequiredInputRegistrySnapshot = {
  productIds: PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
  userStoryIds: [
    ...DEMO_SCREEN_FAMILIES.flatMap(({ screens }) =>
      screens.flatMap(({ userStory }) => (userStory ? [userStory.id] : [])),
    ),
    ...DESIGN_LAB_USER_STORY_MANIFESTS.flatMap(({ userStories }) =>
      userStories.map(({ id }) => id),
    ),
  ],
  routeIds: SCREEN_CONTRACTS.map(({ route }) => route),
  actionIds: uniqueSorted(registeredActionIds),
  formIds: uniqueSorted(registeredFormIds),
  fieldSchemas: [
    ...new Set(
      interactionContracts.flatMap(({ forms }) =>
        forms.flatMap(({ schema }) => (schema ? [schema] : [])),
      ),
    ),
  ],
  designLabRoutes: DESIGN_LAB_USER_STORY_MANIFESTS.map(({ route }) => route),
  releaseGateAreas: SCREEN_CONTRACT_COVERAGE_AREAS,
};

export function evaluateRequiredInputRegistrySnapshot(
  snapshot: RequiredInputRegistrySnapshot,
) {
  const routes = new Set(snapshot.routeIds);
  const gateAreas = new Set(snapshot.releaseGateAreas);

  return {
    product: isNonEmptyUnique(snapshot.productIds),
    userStory:
      isNonEmptyUnique(snapshot.userStoryIds) && gateAreas.has("userStories"),
    route: isNonEmptyUnique(snapshot.routeIds) && gateAreas.has("route"),
    action: isNonEmptyUnique(snapshot.actionIds) && gateAreas.has("actions"),
    form: isNonEmptyUnique(snapshot.formIds) && gateAreas.has("forms"),
    field: isNonEmptyUnique(snapshot.fieldSchemas) && gateAreas.has("forms"),
    designLab:
      isNonEmptyUnique(snapshot.designLabRoutes) &&
      snapshot.designLabRoutes.every((route) => routes.has(route)) &&
      gateAreas.has("designLab"),
  } as const;
}

const evidenceSources = {
  product: ["src/components/product-master-requirements.ts"],
  userStory: [
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/design-lab-user-stories.ts",
  ],
  route: ["src/components/demo-experience-registry.ts"],
  action: [
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/production-screen-coverage.ts",
    "src/components/screen-contracts/design-lab-user-stories.ts",
  ],
  form: [
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/production-screen-coverage.ts",
  ],
  field: [
    "src/components/screen-contracts/production-screen-coverage.ts",
  ],
  designLab: [
    "src/components/screen-contracts/design-lab-user-stories.ts",
    "src/components/design-lab-release-gate.ts",
  ],
} as const;

export function buildRequiredInputRegistryMasterEvidence(
  snapshot: RequiredInputRegistrySnapshot,
) {
  const evaluation = evaluateRequiredInputRegistrySnapshot(snapshot);

  return Object.fromEntries(
    Object.entries(REQUIRED_INPUT_REGISTRY_REQUIREMENT_IDS).flatMap(
      ([key, requirementId]) =>
        evaluation[key as keyof typeof evaluation]
          ? [
              [
                requirementId,
                {
                  status: "verified" as const,
                  evidence: [
                    ...evidenceSources[key as keyof typeof evidenceSources],
                    REQUIRED_INPUT_REGISTRY_EVIDENCE_TEST,
                  ],
                },
              ],
            ]
          : [],
    ),
  );
}

export const REQUIRED_INPUT_REGISTRY_MASTER_EVIDENCE =
  buildRequiredInputRegistryMasterEvidence(REQUIRED_INPUT_REGISTRY_SNAPSHOT);

function isNonEmptyUnique(values: readonly string[]) {
  return (
    values.length > 0 &&
    values.every((value) => value.trim().length > 0) &&
    new Set(values).size === values.length
  );
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].toSorted();
}
