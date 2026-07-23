import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_COMMUNITY_FRIEND_REMOVAL_EVIDENCE_FILE =
  "src/components/product-community-friend-removal-evidence.ts" as const;
export const PRODUCT_COMMUNITY_FRIEND_REMOVAL_TEST_FILE =
  "src/components/product-community-friend-removal-evidence.test.ts" as const;

export const PRODUCT_COMMUNITY_FRIEND_REMOVAL_SCOPE =
  "Focused source and unit verification that the production member profile binds outgoing pending friendships to cancellation and accepted friendships to removal, both operations require explicit inline confirmation and expose pending, success, and recoverable-failure feedback, the shared server action authenticates and rate-limits the caller, and the service deletes only a friendship containing the current profile inside request-scoped database context before writing an audit event and broadcasting relationship refresh. This proves the two existing-profile mutation paths at source and unit level only; it does not prove browser hydration, deployed row-level security, a production database result, cross-session realtime delivery, notification delivery, incoming-request response behavior, or relationship consistency across unimplemented group membership surfaces.";

export const PRODUCT_COMMUNITY_FRIEND_REMOVAL_REQUIREMENT_IDS = [
  "ROUTE.COMMUNITY.friend-cancel",
  "ROUTE.COMMUNITY.friend-remove",
] as const;

export type ProductCommunityFriendRemovalRequirementId =
  (typeof PRODUCT_COMMUNITY_FRIEND_REMOVAL_REQUIREMENT_IDS)[number];

export const PRODUCT_COMMUNITY_FRIEND_REMOVAL_EXPECTED_GAIN =
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_REQUIREMENT_IDS.length;

type ProductCommunityFriendRemovalEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_FRIEND_REMOVAL_TEST_FILE,
  "src/app/p/[handle]/page.tsx",
  "src/components/friendship-removal-control.tsx",
  "src/app/actions.ts",
  "src/lib/friend-service.ts",
] as const;

export const PRODUCT_COMMUNITY_FRIEND_REMOVAL_MASTER_EVIDENCE = {
  "ROUTE.COMMUNITY.friend-cancel": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
  "ROUTE.COMMUNITY.friend-remove": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductCommunityFriendRemovalRequirementId,
    ProductCommunityFriendRemovalEvidenceRecord
  >
>;
