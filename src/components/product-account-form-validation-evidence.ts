import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCOUNT_FORM_VALIDATION_EVIDENCE_FILE =
  "src/components/product-account-form-validation-evidence.ts" as const;
export const PRODUCT_ACCOUNT_FORM_VALIDATION_TEST_FILE =
  "src/components/product-account-form-validation-evidence.test.ts" as const;

export const PRODUCT_ACCOUNT_FORM_VALIDATION_SCOPE =
  "Focused source-static verification of all 24 structured account forms: eight schema-validated payloads, seven schema-validated and server-authorized team mutations, three server-bound and ownership-checked mutations, four current-user zero-payload operations, and two validated GET-only forms that cannot mutate state. This proves reviewed source ordering and fail-closed inventory coverage only. It does not prove deployed identity, database RLS, bound-action encryption at runtime, hydrated browser feedback, or cross-account runtime denial.";

export const PRODUCT_ACCOUNT_FORM_VALIDATION_REQUIREMENT_IDS = [
  "ROUTE.ACCOUNT.validate",
] as const;

export type ProductAccountFormValidationRequirementId =
  (typeof PRODUCT_ACCOUNT_FORM_VALIDATION_REQUIREMENT_IDS)[number];

export const PRODUCT_ACCOUNT_FORM_VALIDATION_EXPECTED_GAIN =
  PRODUCT_ACCOUNT_FORM_VALIDATION_REQUIREMENT_IDS.length;

export type ProductAccountFormValidationKind =
  | "schema-validated"
  | "schema-validated-authorized"
  | "server-bound-owned"
  | "current-user-zero-payload"
  | "validated-get-only";

export const PRODUCT_ACCOUNT_FORM_VALIDATION_CASES = [
  {
    route: "/account",
    formId: "ACCOUNT.FORM.PROFILE",
    submitsTo: "SERVER ACTION updateProfile",
    kind: "schema-validated",
  },
  {
    route: "/account",
    formId: "ACCOUNT.FORM.DATA-EXPORT",
    submitsTo: "POST /api/users/me/export",
    kind: "current-user-zero-payload",
  },
  {
    route: "/account",
    formId: "ACCOUNT.FORM.DELETION",
    submitsTo: "SERVER ACTION requestAccountDeletion",
    kind: "schema-validated",
  },
  {
    route: "/account",
    formId: "ACCOUNT.FORM.CHECKOUT",
    submitsTo: "POST /api/billing/checkout",
    kind: "schema-validated",
  },
  {
    route: "/account/appearance",
    formId: "ACCOUNT-APPEARANCE.FORM.PREVIEW",
    submitsTo: "GET /account/appearance",
    kind: "validated-get-only",
  },
  {
    route: "/account/billing",
    formId: "ACCOUNT-BILLING.FORM.PORTAL",
    submitsTo: "POST /api/billing/portal",
    kind: "current-user-zero-payload",
  },
  {
    route: "/account/notifications",
    formId: "ACCOUNT-NOTIFICATIONS.FORM.ALL-READ",
    submitsTo: "SERVER ACTION markAllNotificationsRead",
    kind: "current-user-zero-payload",
  },
  {
    route: "/account/notifications",
    formId: "ACCOUNT-NOTIFICATIONS.FORM.ITEM-READ",
    submitsTo: "SERVER ACTION markNotificationRead",
    kind: "server-bound-owned",
  },
  {
    route: "/account/pages",
    formId: "ACCOUNT-PAGES.FORM.MAIN-CREATE",
    submitsTo: "SERVER ACTION createCustomPageAction",
    kind: "schema-validated",
  },
  {
    route: "/account/pages",
    formId: "ACCOUNT-PAGES.FORM.DOG-CREATE",
    submitsTo: "SERVER ACTION createCustomPageAction",
    kind: "schema-validated",
  },
  {
    route: "/account/pages",
    formId: "ACCOUNT-PAGES.FORM.BESPOKE-CHECKOUT",
    submitsTo: "POST /api/billing/bespoke/checkout",
    kind: "current-user-zero-payload",
  },
  {
    route: "/account/pages/[id]",
    formId: "ACCOUNT-PAGE.FORM.PUBLISH",
    submitsTo: "SERVER ACTION publishCustomPageAction",
    kind: "server-bound-owned",
  },
  {
    route: "/account/pages/[id]",
    formId: "ACCOUNT-PAGE.FORM.UPDATE",
    submitsTo: "SERVER ACTION updateCustomPageAction",
    kind: "schema-validated",
  },
  {
    route: "/account/pages/[id]",
    formId: "ACCOUNT-PAGE.FORM.DOG-CARD",
    submitsTo: "SERVER ACTION generateDogCardAction",
    kind: "server-bound-owned",
  },
  {
    route: "/account/pages/[id]",
    formId: "ACCOUNT-PAGE.FORM.DELETE",
    submitsTo: "SERVER ACTION deleteCustomPageAction",
    kind: "schema-validated",
  },
  {
    route: "/account/profile",
    formId: "ACCOUNT-PROFILE.FORM.MEDIA",
    submitsTo: "SERVER ACTION updatePersonalIdentityMedia",
    kind: "schema-validated",
  },
  {
    route: "/account/support",
    formId: "ACCOUNT-SUPPORT.FORM.HELP.SEARCH",
    submitsTo: "GET /account/support",
    kind: "validated-get-only",
  },
  {
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.INVITATION.CREATE",
    submitsTo: "SERVER ACTION createTeamInvitationAction",
    kind: "schema-validated-authorized",
  },
  {
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.INVITATION.ACCEPT",
    submitsTo: "SERVER ACTION decideTeamInvitationAction",
    kind: "schema-validated-authorized",
  },
  {
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.INVITATION.REJECT",
    submitsTo: "SERVER ACTION decideTeamInvitationAction",
    kind: "schema-validated-authorized",
  },
  {
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.LEAVE",
    submitsTo: "SERVER ACTION leaveTeamAction",
    kind: "schema-validated-authorized",
  },
  {
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.MEMBER.ROLE",
    submitsTo: "SERVER ACTION changeTeamMemberRoleAction",
    kind: "schema-validated-authorized",
  },
  {
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.OWNER.TRANSFER",
    submitsTo: "SERVER ACTION changeTeamMemberRoleAction",
    kind: "schema-validated-authorized",
  },
  {
    route: "/account/team",
    formId: "ACCOUNT-TEAM.FORM.MEMBER.REMOVE",
    submitsTo: "SERVER ACTION removeTeamMemberAction",
    kind: "schema-validated-authorized",
  },
] as const satisfies readonly {
  route: string;
  formId: string;
  submitsTo: string;
  kind: ProductAccountFormValidationKind;
}[];

type ProductAccountFormValidationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_ACCOUNT_FORM_VALIDATION_MASTER_EVIDENCE = {
  "ROUTE.ACCOUNT.validate": {
    status: "tested",
    evidence: [
      PRODUCT_ACCOUNT_FORM_VALIDATION_EVIDENCE_FILE,
      PRODUCT_ACCOUNT_FORM_VALIDATION_TEST_FILE,
      "src/components/screen-contracts/production-screen-coverage.ts",
      "src/components/screen-contracts/production-screen-account-interactions.test.ts",
      "src/app/actions.ts",
      "src/app/api/billing/checkout/route.ts",
      "src/app/api/billing/portal/route.ts",
      "src/app/api/billing/bespoke/checkout/route.ts",
      "src/app/api/users/me/export/route.ts",
      "src/lib/custom-page-service.ts",
      "src/lib/notification-service.ts",
      "src/lib/dog-card-service.ts",
      "src/app/account/team/actions.ts",
      "src/lib/organization-team-policy.ts",
      "src/lib/organization-team-service.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductAccountFormValidationRequirementId,
    ProductAccountFormValidationEvidenceRecord
  >
>;
