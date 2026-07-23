import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import { TEAM_ROLES } from "@/lib/organization-team-policy";

export const PRODUCT_ACTOR_MAP_EVIDENCE_FILE =
  "src/components/product-actor-map-evidence.ts" as const;
export const PRODUCT_ACTOR_MAP_TEST_FILE =
  "src/components/product-actor-map-evidence.test.ts" as const;

export const PRODUCT_ACTOR_MAP_SUMMARY = {
  screenCount: SCREEN_CONTRACTS.length,
  actorAssignmentCount: SCREEN_CONTRACTS.reduce(
    (total, contract) => total + contract.actors.length,
    0,
  ),
  actorValueCount: new Set(SCREEN_CONTRACTS.flatMap((contract) => contract.actors))
    .size,
  roleValueCount: new Set(SCREEN_CONTRACTS.flatMap((contract) => contract.roles))
    .size,
  runtimeTeamAuthorityCount: TEAM_ROLES.length,
  designLabScreenCount: DESIGN_LAB_USER_STORY_MANIFESTS.length,
} as const;

export const PRODUCT_ACTOR_MAP_SCOPE =
  `Deterministic source-static verification that all ${PRODUCT_ACTOR_MAP_SUMMARY.screenCount} canonical screen contracts record a non-empty descriptive actor, authentication boundary, supported role set, tier set, and user-story evidence. The inventory currently contains ${PRODUCT_ACTOR_MAP_SUMMARY.actorAssignmentCount} screen-to-actor assignments, ${PRODUCT_ACTOR_MAP_SUMMARY.actorValueCount} distinct descriptive actor values, and ${PRODUCT_ACTOR_MAP_SUMMARY.roleValueCount} role identifiers; the account-team contract also reconciles all ${PRODUCT_ACTOR_MAP_SUMMARY.runtimeTeamAuthorityCount} runtime team authority actors to the tested organization policy, and the ${PRODUCT_ACTOR_MAP_SUMMARY.designLabScreenCount} Design Lab screens retain their detailed authorised-reviewer story actors. This evidence proves supported screen-actor inventory and source-static team-authority mapping only; it does not prove live identity-provider behavior, deployed authorization, tenant isolation, browser rendering, deployed parity, or production readiness.`;

export const PRODUCT_ACTOR_MAP_REQUIREMENT_IDS = [
  "COMPLETE.EVIDENCE.actors-mapped",
] as const;

export type ProductActorMapRequirementId =
  (typeof PRODUCT_ACTOR_MAP_REQUIREMENT_IDS)[number];

export const PRODUCT_ACTOR_MAP_EXPECTED_GAIN =
  PRODUCT_ACTOR_MAP_REQUIREMENT_IDS.length;

type ProductActorMapEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACTOR_MAP_EVIDENCE_FILE,
  PRODUCT_ACTOR_MAP_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "src/lib/organization-team-policy.ts",
  "src/lib/organization-team-policy.test.ts",
] as const;

export const PRODUCT_ACTOR_MAP_MASTER_EVIDENCE = {
  "COMPLETE.EVIDENCE.actors-mapped": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<ProductActorMapRequirementId, ProductActorMapEvidenceRecord>
>;
