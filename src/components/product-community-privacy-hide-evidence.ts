import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_COMMUNITY_PRIVACY_HIDE_EVIDENCE_FILE =
  "src/components/product-community-privacy-hide-evidence.ts" as const;
export const PRODUCT_COMMUNITY_PRIVACY_HIDE_TEST_FILE =
  "src/components/product-community-privacy-hide-evidence.test.ts" as const;

export const PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE =
  "Focused source and unit verification that a private member profile is resolved before protected relations are read, renders a noindex non-leaking state, and that Feed exposes a retryable mute control backed by an authenticated, pair-rate-limited, strictly validated API mutation which resolves the muting actor server-side and persists the ActorMute relationship. This proves the implemented private-profile and hide/mute product paths in the repository; it does not prove deployed database behavior, browser interaction, cross-region realtime propagation, or every wider community privacy boundary.";

export const PRODUCT_COMMUNITY_PRIVACY_HIDE_REQUIREMENT_IDS = [
  "ROUTE.COMMUNITY.private-profile",
  "ROUTE.COMMUNITY.hide",
] as const;

export type ProductCommunityPrivacyHideRequirementId =
  (typeof PRODUCT_COMMUNITY_PRIVACY_HIDE_REQUIREMENT_IDS)[number];

export const PRODUCT_COMMUNITY_PRIVACY_HIDE_EXPECTED_GAIN =
  PRODUCT_COMMUNITY_PRIVACY_HIDE_REQUIREMENT_IDS.length;

type ProductCommunityPrivacyHideEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_COMMUNITY_PRIVACY_HIDE_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_PRIVACY_HIDE_TEST_FILE,
] as const;

export const PRODUCT_COMMUNITY_PRIVACY_HIDE_MASTER_EVIDENCE = {
  "ROUTE.COMMUNITY.private-profile": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/social-actor-service.ts",
      "src/lib/social-actor-visibility.test.ts",
      "src/app/p/[handle]/page.tsx",
    ],
  },
  "ROUTE.COMMUNITY.hide": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/components/instant-feed-controls.tsx",
      "src/components/feed-post-card.tsx",
      "src/app/api/actors/[actorId]/mute/route.ts",
      "src/lib/feed-validation.ts",
      "src/lib/feed-service.ts",
      "security/endpoint-validation-evidence.test.ts",
      "security/property-authorization-evidence.test.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductCommunityPrivacyHideRequirementId,
    ProductCommunityPrivacyHideEvidenceRecord
  >
>;
