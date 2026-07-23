export const PRODUCT_UNAUTHORISED_DESTRUCTIVE_GATE_EVIDENCE_FILE =
  "src/components/product-unauthorised-destructive-gate.ts" as const;
export const PRODUCT_UNAUTHORISED_DESTRUCTIVE_GATE_TEST_FILE =
  "src/components/product-unauthorised-destructive-gate.test.ts" as const;

export const PRODUCT_UNAUTHORISED_DESTRUCTIVE_GATE_SCOPE =
  "Fail-closed source audit of every production interaction form explicitly classified as deletion, withdrawal, archive, team departure, ownership transfer, or member removal. Each control is bound to an authenticated server action, a resource- or role-level policy function, at least one denied actor, and the focused interaction contract that proves the control binding. This is source-static authorization evidence; it does not claim deployed identity-provider behavior, database RLS, or runtime cross-account denial.";

export type ProductDestructiveControlContract = {
  id: string;
  route: string;
  formId: string;
  action: string;
  authorisedActors: readonly string[];
  deniedActors: readonly string[];
  actionFile: string;
  actionGuard: string;
  actionAuthorityToken: string;
  policyFile: string;
  policySymbol: string;
  policyAuthorityToken: string;
  testFile: string;
  testId: string;
};

const contract = (
  value: Omit<ProductDestructiveControlContract, "id">,
): ProductDestructiveControlContract => ({
  ...value,
  id: `${value.route}::${value.formId}`,
});

const messageDelete = (route: "/pulse/[id]" | "/messages/[id]") =>
  contract({
    route,
    formId:
      route === "/pulse/[id]"
        ? "PULSE-THREAD.FORM.DELETE"
        : "MESSAGE-THREAD.FORM.DELETE",
    action: "deleteConversationMessage",
    authorisedActors: ["conversation-participant"],
    deniedActors: ["signed-out", "conversation-non-participant"],
    actionFile: "src/app/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "softDeleteConversationMessage",
    policyFile: "src/lib/conversation-service.ts",
    policySymbol: "softDeleteConversationMessage",
    policyAuthorityToken: "getConversationForProfile",
    testFile:
      route === "/pulse/[id]"
        ? "src/components/screen-contracts/production-screen-community-interactions.test.ts"
        : "src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts",
    testId:
      route === "/pulse/[id]"
        ? "PRODUCTION-SCREEN-COMMUNITY-INTERACTIONS"
        : "PRODUCTION-SCREEN-PROFILE-MESSAGING-INTERACTIONS",
  });

const listingWithdraw = (route: "/marketplace/[id]" | "/listings/[id]") =>
  contract({
    route,
    formId: "MARKETPLACE-DETAIL.FORM.WITHDRAW",
    action: "withdrawListing",
    authorisedActors: ["listing-owner"],
    deniedActors: ["signed-out", "listing-non-owner"],
    actionFile: "src/app/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "withdrawListingForCurrentUser",
    policyFile: "src/lib/listing-service.ts",
    policySymbol: "withdrawListingForCurrentUser",
    policyAuthorityToken: "getOwnedListing",
    testFile:
      route === "/marketplace/[id]"
        ? "src/components/screen-contracts/production-screen-marketplace-interactions.test.ts"
        : "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
    testId:
      route === "/marketplace/[id]"
        ? "PRODUCTION-SCREEN-MARKETPLACE-INTERACTIONS"
        : "PRODUCTION-SCREEN-COMMERCE-INTERACTIONS",
  });

const listingArchive = (route: "/marketplace/[id]" | "/listings/[id]") =>
  contract({
    route,
    formId: "MARKETPLACE-DETAIL.FORM.ARCHIVE",
    action: "archiveListing",
    authorisedActors: ["listing-owner"],
    deniedActors: ["signed-out", "listing-non-owner"],
    actionFile: "src/app/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "archiveListingForCurrentUser",
    policyFile: "src/lib/listing-service.ts",
    policySymbol: "archiveListingForCurrentUser",
    policyAuthorityToken: "getOwnedListing",
    testFile:
      route === "/marketplace/[id]"
        ? "src/components/screen-contracts/production-screen-marketplace-interactions.test.ts"
        : "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
    testId:
      route === "/marketplace/[id]"
        ? "PRODUCTION-SCREEN-MARKETPLACE-INTERACTIONS"
        : "PRODUCTION-SCREEN-COMMERCE-INTERACTIONS",
  });

export const PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS = [
  messageDelete("/pulse/[id]"),
  listingWithdraw("/marketplace/[id]"),
  listingArchive("/marketplace/[id]"),
  contract({
    route: "/account",
    formId: "ACCOUNT.FORM.DELETION",
    action: "requestAccountDeletion",
    authorisedActors: ["current-account-owner"],
    deniedActors: ["signed-out", "other-account-member"],
    actionFile: "src/app/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "requestAccountDeletionForUser",
    policyFile: "src/lib/account-service.ts",
    policySymbol: "requestAccountDeletion",
    policyAuthorityToken: "current.dbUserId",
    testFile:
      "src/components/screen-contracts/production-screen-account-interactions.test.ts",
    testId: "PRODUCTION-SCREEN-ACCOUNT-INTERACTIONS",
  }),
  contract({
    route: "/account/pages/[id]",
    formId: "ACCOUNT-PAGE.FORM.DELETE",
    action: "deleteCustomPageAction",
    authorisedActors: ["managed-page-owner"],
    deniedActors: ["signed-out", "managed-page-non-owner"],
    actionFile: "src/app/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "deleteCustomPage",
    policyFile: "src/lib/custom-page-service.ts",
    policySymbol: "deleteCustomPage",
    policyAuthorityToken: "requireOwnedPage",
    testFile:
      "src/components/screen-contracts/production-screen-account-interactions.test.ts",
    testId: "PRODUCTION-SCREEN-ACCOUNT-INTERACTIONS",
  }),
  contract({
    route: "/admin/listings",
    formId: "ADMIN-LISTINGS.FORM.REMOVE",
    action: "removeListing",
    authorisedActors: ["moderator", "administrator"],
    deniedActors: ["signed-out", "member"],
    actionFile: "src/app/actions.ts",
    actionGuard: "requireModeratorProfile",
    actionAuthorityToken: "removeListingForModerator",
    policyFile: "src/lib/listing-service.ts",
    policySymbol: "removeListingForModerator",
    policyAuthorityToken: "assertModerator",
    testFile:
      "src/components/screen-contracts/production-screen-admin-moderation-interactions.test.ts",
    testId: "PRODUCTION-SCREEN-ADMIN-MODERATION-INTERACTIONS",
  }),
  messageDelete("/messages/[id]"),
  listingWithdraw("/listings/[id]"),
  listingArchive("/listings/[id]"),
  contract({
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.LEAVE",
    action: "leaveTeamAction",
    authorisedActors: ["active-team-member"],
    deniedActors: ["signed-out", "non-member", "sole-owner"],
    actionFile: "src/app/account/team/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "leaveOrganizationTeam",
    policyFile: "src/lib/organization-team-service.ts",
    policySymbol: "leaveOrganizationTeam",
    policyAuthorityToken: "canLeaveTeam",
    testFile:
      "src/components/screen-contracts/production-screen-member-support-interactions.test.ts",
    testId: "PRODUCTION-SCREEN-MEMBER-SUPPORT-INTERACTIONS",
  }),
  contract({
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.OWNER.TRANSFER",
    action: "changeTeamMemberRoleAction",
    authorisedActors: ["organisation-owner"],
    deniedActors: ["signed-out", "team-member", "team-admin"],
    actionFile: "src/app/account/team/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "changeOrganizationTeamMemberRole",
    policyFile: "src/lib/organization-team-service.ts",
    policySymbol: "changeOrganizationTeamMemberRole",
    policyAuthorityToken: "canChangeTeamMemberRole",
    testFile:
      "src/components/screen-contracts/production-screen-member-support-interactions.test.ts",
    testId: "PRODUCTION-SCREEN-MEMBER-SUPPORT-INTERACTIONS",
  }),
  contract({
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.MEMBER.REMOVE",
    action: "removeTeamMemberAction",
    authorisedActors: ["organisation-owner"],
    deniedActors: ["signed-out", "team-member", "team-admin"],
    actionFile: "src/app/account/team/actions.ts",
    actionGuard: "requireCurrentUserProfile",
    actionAuthorityToken: "removeOrganizationTeamMember",
    policyFile: "src/lib/organization-team-service.ts",
    policySymbol: "removeOrganizationTeamMember",
    policyAuthorityToken: "canRemoveTeamMember",
    testFile:
      "src/components/screen-contracts/production-screen-member-support-interactions.test.ts",
    testId: "PRODUCTION-SCREEN-MEMBER-SUPPORT-INTERACTIONS",
  }),
] as const satisfies readonly ProductDestructiveControlContract[];

export function findUnauthorisedDestructiveIssues(
  contracts: readonly ProductDestructiveControlContract[],
) {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const item of contracts) {
    if (item.id !== `${item.route}::${item.formId}`) {
      issues.push(`${item.id}:INVALID_ID`);
    }
    if (seen.has(item.id)) issues.push(`${item.id}:DUPLICATE`);
    seen.add(item.id);
    if (item.authorisedActors.length === 0) {
      issues.push(`${item.id}:AUTHORISED_ACTOR_MISSING`);
    }
    if (item.deniedActors.length === 0) {
      issues.push(`${item.id}:DENIED_ACTOR_MISSING`);
    }
    if (item.authorisedActors.some((actor) => item.deniedActors.includes(actor))) {
      issues.push(`${item.id}:ACTOR_POLICY_OVERLAP`);
    }
    if (!item.actionGuard || !item.actionAuthorityToken) {
      issues.push(`${item.id}:ACTION_AUTHORITY_MISSING`);
    }
    if (!item.policySymbol || !item.policyAuthorityToken) {
      issues.push(`${item.id}:RESOURCE_POLICY_MISSING`);
    }
  }

  return issues.toSorted();
}
