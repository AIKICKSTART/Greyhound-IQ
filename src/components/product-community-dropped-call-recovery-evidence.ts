import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EVIDENCE_FILE =
  "src/components/product-community-dropped-call-recovery-evidence.ts" as const;
export const PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_TEST_FILE =
  "src/components/product-community-dropped-call-recovery-evidence.test.ts" as const;

export const PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_SCOPE =
  "Focused source and unit verification that an unexpected LiveKit terminal disconnect clears local media state, enters an explicit error state, explains that the call connection dropped, retains a bounded rejoin target, exposes Try again and Dismiss recovery controls, and does not misclassify the local Leave control or component cleanup as a dropped call. The Leave control also verifies the call-end response and surfaces failure. This proves client recovery source and unit behavior only; it does not prove browser media behavior, LiveKit service availability, a real network transition, deployed realtime delivery, production database state, or successful rejoin under an upstream outage.";

export const PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_REQUIREMENT_IDS = [
  "ROUTE.COMMUNITY.connection-dropped",
] as const;

export type ProductCommunityDroppedCallRecoveryRequirementId =
  (typeof PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_REQUIREMENT_IDS)[number];

export const PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EXPECTED_GAIN =
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_REQUIREMENT_IDS.length;

type ProductCommunityDroppedCallRecoveryEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_TEST_FILE,
  "src/components/conversation-call-panel.tsx",
  "src/components/product-community-capability-evidence.ts",
  "src/components/product-community-capability-evidence.test.ts",
] as const;

export const PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_MASTER_EVIDENCE = {
  "ROUTE.COMMUNITY.connection-dropped": {
    status: "tested",
    evidence: SHARED_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductCommunityDroppedCallRecoveryRequirementId,
    ProductCommunityDroppedCallRecoveryEvidenceRecord
  >
>;
