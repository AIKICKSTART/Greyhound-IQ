import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_TEAM_INVITATION_STATE_EVIDENCE_FILE =
  "src/components/product-team-invitation-state-evidence.ts" as const;
export const PRODUCT_TEAM_INVITATION_STATE_TEST_FILE =
  "src/components/product-team-invitation-state-evidence.test.ts" as const;

export const PRODUCT_TEAM_INVITATION_STATE_SCOPE =
  "Focused source and unit verification of the account-team invitation recovery surface. Invalid token shapes, missing records and email mismatches fail to an explicit unavailable alert without changing access. Pending records past expiresAt are classified as expired, expired decisions fail before membership mutation, and expired, already-used or otherwise unavailable decisions return safe user-facing recovery copy. This proves the implemented source branches and focused contract only; it does not prove browser hydration, invitation email delivery, deployed database behavior, production clock configuration, live identity-provider synchronization or end-to-end runtime outcomes.";

export const PRODUCT_TEAM_INVITATION_STATE_REQUIREMENT_IDS = [
  "SYSTEM.invitation-expired",
  "SYSTEM.invitation-invalid",
] as const;

export type ProductTeamInvitationStateRequirementId =
  (typeof PRODUCT_TEAM_INVITATION_STATE_REQUIREMENT_IDS)[number];

export const PRODUCT_TEAM_INVITATION_STATE_EXPECTED_GAIN =
  PRODUCT_TEAM_INVITATION_STATE_REQUIREMENT_IDS.length;

type ProductTeamInvitationStateEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_TEAM_INVITATION_STATE_EVIDENCE_FILE,
  PRODUCT_TEAM_INVITATION_STATE_TEST_FILE,
  "src/app/account/team/page.tsx",
  "src/app/account/team/team-invitation-review.tsx",
  "src/app/account/team/actions.ts",
  "src/lib/organization-team-service.ts",
  "src/components/product-account-team-evidence.test.ts",
] as const;

const TESTED = {
  status: "tested",
  evidence: EVIDENCE,
} as const satisfies ProductTeamInvitationStateEvidenceRecord;

export const PRODUCT_TEAM_INVITATION_STATE_MASTER_EVIDENCE = {
  "SYSTEM.invitation-expired": TESTED,
  "SYSTEM.invitation-invalid": TESTED,
} as const satisfies Readonly<
  Record<
    ProductTeamInvitationStateRequirementId,
    ProductTeamInvitationStateEvidenceRecord
  >
>;
