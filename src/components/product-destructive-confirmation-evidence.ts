import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_DESTRUCTIVE_CONFIRMATION_EVIDENCE_FILE =
  "src/components/product-destructive-confirmation-evidence.ts" as const;
export const PRODUCT_DESTRUCTIVE_CONFIRMATION_TEST_FILE =
  "src/components/product-destructive-confirmation-evidence.test.ts" as const;

export const PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE =
  "Focused source-static verification of all 12 destructive forms in the production destructive-action registry. Each form requires a visible typed or checkbox confirmation and its authenticated server action strictly parses the matching literal before the destructive mutation. This does not prove hydrated browser interaction, deployed identity-provider behavior, database RLS, or runtime cross-account denial.";

export const PRODUCT_DESTRUCTIVE_CONFIRMATION_REQUIREMENT_IDS = [
  "GLOBAL.FUNC.destructive-confirm",
] as const;

export type ProductDestructiveConfirmationRequirementId =
  (typeof PRODUCT_DESTRUCTIVE_CONFIRMATION_REQUIREMENT_IDS)[number];

export const PRODUCT_DESTRUCTIVE_CONFIRMATION_EXPECTED_GAIN =
  PRODUCT_DESTRUCTIVE_CONFIRMATION_REQUIREMENT_IDS.length;

export type ProductDestructiveConfirmationContract = {
  id: string;
  route: string;
  formId: string;
  action: string;
  uiFile: string;
  uiAction: string;
  controlKind: "required-checkbox" | "typed-text";
  confirmationValue: string;
  visibleConfirmationText: string;
  actionFile: string;
  schemaSymbol: string;
  confirmationFieldToken: string;
  mutationToken: string;
};

const contract = (
  value: Omit<ProductDestructiveConfirmationContract, "id">,
): ProductDestructiveConfirmationContract => ({
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
    uiFile: "src/app/messages/[id]/page.tsx",
    uiAction: "deleteAction",
    controlKind: "required-checkbox",
    confirmationValue: "delete",
    visibleConfirmationText: "Confirm delete",
    actionFile: "src/app/actions.ts",
    schemaSymbol: "messageDeleteConfirmationSchema",
    confirmationFieldToken: 'field(formData, "confirmation")',
    mutationToken: "softDeleteConversationMessage",
  });

const listingWithdraw = (route: "/marketplace/[id]" | "/listings/[id]") =>
  contract({
    route,
    formId: "MARKETPLACE-DETAIL.FORM.WITHDRAW",
    action: "withdrawListing",
    uiFile: "src/app/listings/[id]/page.tsx",
    uiAction: "withdrawAction",
    controlKind: "required-checkbox",
    confirmationValue: "withdraw",
    visibleConfirmationText:
      "Confirm this listing should be withdrawn from review or active inventory.",
    actionFile: "src/app/actions.ts",
    schemaSymbol: "listingWithdrawConfirmationSchema",
    confirmationFieldToken: 'field(formData, "confirmation")',
    mutationToken: "withdrawListingForCurrentUser",
  });

const listingArchive = (route: "/marketplace/[id]" | "/listings/[id]") =>
  contract({
    route,
    formId: "MARKETPLACE-DETAIL.FORM.ARCHIVE",
    action: "archiveListing",
    uiFile: "src/app/listings/[id]/page.tsx",
    uiAction: "archiveAction",
    controlKind: "required-checkbox",
    confirmationValue: "archive",
    visibleConfirmationText:
      "Confirm this listing should leave active inventory.",
    actionFile: "src/app/actions.ts",
    schemaSymbol: "listingArchiveSchema",
    confirmationFieldToken: 'field(formData, "confirmation")',
    mutationToken: "archiveListingForCurrentUser",
  });

export const PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS = [
  messageDelete("/pulse/[id]"),
  listingWithdraw("/marketplace/[id]"),
  listingArchive("/marketplace/[id]"),
  contract({
    route: "/account",
    formId: "ACCOUNT.FORM.DELETION",
    action: "requestAccountDeletion",
    uiFile: "src/app/account/page.tsx",
    uiAction: "requestAccountDeletion",
    controlKind: "typed-text",
    confirmationValue: "DELETE",
    visibleConfirmationText: "Type DELETE to confirm",
    actionFile: "src/app/actions.ts",
    schemaSymbol: "destructiveConfirmationSchema",
    confirmationFieldToken: 'field(formData, "confirmation")',
    mutationToken: "requestAccountDeletionForUser",
  }),
  contract({
    route: "/account/pages/[id]",
    formId: "ACCOUNT-PAGE.FORM.DELETE",
    action: "deleteCustomPageAction",
    uiFile: "src/app/account/pages/[id]/page.tsx",
    uiAction: "deleteAction",
    controlKind: "typed-text",
    confirmationValue: "DELETE",
    visibleConfirmationText: "Type DELETE to confirm",
    actionFile: "src/app/actions.ts",
    schemaSymbol: "destructiveConfirmationSchema",
    confirmationFieldToken: 'field(formData, "confirmation")',
    mutationToken: "deleteCustomPage",
  }),
  contract({
    route: "/admin/listings",
    formId: "ADMIN-LISTINGS.FORM.REMOVE",
    action: "removeListing",
    uiFile: "src/app/admin/listings/page.tsx",
    uiAction: "removeAction",
    controlKind: "required-checkbox",
    confirmationValue: "remove",
    visibleConfirmationText:
      "Confirm this listing should be removed from the marketplace.",
    actionFile: "src/app/actions.ts",
    schemaSymbol: "listingRemovalConfirmationSchema",
    confirmationFieldToken: 'field(formData, "confirmation")',
    mutationToken: "removeListingForModerator",
  }),
  messageDelete("/messages/[id]"),
  listingWithdraw("/listings/[id]"),
  listingArchive("/listings/[id]"),
  contract({
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.LEAVE",
    action: "leaveTeamAction",
    uiFile: "src/app/account/team/team-management.tsx",
    uiAction: "leaveTeamAction",
    controlKind: "required-checkbox",
    confirmationValue: "LEAVE",
    visibleConfirmationText: "Confirm",
    actionFile: "src/app/account/team/actions.ts",
    schemaSymbol: "leaveSchema",
    confirmationFieldToken: 'formData.get("confirmation")',
    mutationToken: "leaveOrganizationTeam",
  }),
  contract({
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.OWNER.TRANSFER",
    action: "changeTeamMemberRoleAction",
    uiFile: "src/app/account/team/team-management.tsx",
    uiAction: "changeTeamMemberRoleAction",
    controlKind: "required-checkbox",
    confirmationValue: "TRANSFER",
    visibleConfirmationText:
      "I understand this member becomes the owner and I become an administrator.",
    actionFile: "src/app/account/team/actions.ts",
    schemaSymbol: "membershipRoleSchema",
    confirmationFieldToken: 'formData.get("confirmation")',
    mutationToken: "changeOrganizationTeamMemberRole",
  }),
  contract({
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.MEMBER.REMOVE",
    action: "removeTeamMemberAction",
    uiFile: "src/app/account/team/team-management.tsx",
    uiAction: "removeTeamMemberAction",
    controlKind: "required-checkbox",
    confirmationValue: "REMOVE",
    visibleConfirmationText: "Confirm",
    actionFile: "src/app/account/team/actions.ts",
    schemaSymbol: "memberRemovalSchema",
    confirmationFieldToken: 'formData.get("confirmation")',
    mutationToken: "removeOrganizationTeamMember",
  }),
] as const satisfies readonly ProductDestructiveConfirmationContract[];

export function findDestructiveConfirmationIssues(
  contracts: readonly ProductDestructiveConfirmationContract[],
) {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const item of contracts) {
    if (item.id !== `${item.route}::${item.formId}`) {
      issues.push(`${item.id}:INVALID_ID`);
    }
    if (seen.has(item.id)) issues.push(`${item.id}:DUPLICATE`);
    seen.add(item.id);
    if (!item.visibleConfirmationText.trim()) {
      issues.push(`${item.id}:VISIBLE_CONFIRMATION_MISSING`);
    }
    if (!item.confirmationValue.trim()) {
      issues.push(`${item.id}:CONFIRMATION_VALUE_MISSING`);
    }
    if (!item.uiFile || !item.uiAction) {
      issues.push(`${item.id}:UI_BINDING_MISSING`);
    }
    if (
      !item.actionFile ||
      !item.schemaSymbol ||
      !item.confirmationFieldToken ||
      !item.mutationToken
    ) {
      issues.push(`${item.id}:SERVER_VALIDATION_MISSING`);
    }
  }

  return issues.toSorted();
}

type ProductDestructiveConfirmationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_DESTRUCTIVE_CONFIRMATION_MASTER_EVIDENCE = {
  "GLOBAL.FUNC.destructive-confirm": {
    status: "tested",
    evidence: [
      PRODUCT_DESTRUCTIVE_CONFIRMATION_EVIDENCE_FILE,
      PRODUCT_DESTRUCTIVE_CONFIRMATION_TEST_FILE,
      "src/components/product-unauthorised-destructive-gate.ts",
      "src/app/actions.ts",
      "src/app/listings/[id]/page.tsx",
      "src/app/messages/[id]/page.tsx",
      "src/app/admin/listings/page.tsx",
      "src/app/account/page.tsx",
      "src/app/account/pages/[id]/page.tsx",
      "src/app/account/team/actions.ts",
      "src/app/account/team/team-management.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductDestructiveConfirmationRequirementId,
    ProductDestructiveConfirmationEvidenceRecord
  >
>;
