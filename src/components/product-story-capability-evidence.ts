import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_STORY_CAPABILITY_EVIDENCE_FILE =
  "src/components/product-story-capability-evidence.ts" as const;
export const PRODUCT_STORY_CAPABILITY_TEST_FILE =
  "src/components/product-story-capability-evidence.test.ts" as const;

const PRODUCTION_SCREEN_COVERAGE_FILE =
  "src/components/screen-contracts/production-screen-coverage.ts" as const;
const PRODUCTION_SCREEN_COVERAGE_TEST = {
  testPath:
    "src/components/screen-contracts/production-screen-coverage.test.ts",
  testId: "PRODUCTION-SCREEN-COVERAGE",
} as const;
const COMMUNITY_INTERACTION_TEST = {
  testPath:
    "src/components/screen-contracts/production-screen-community-interactions.test.ts",
  testId: "PRODUCTION-SCREEN-COMMUNITY-INTERACTIONS",
} as const;
const ACCOUNT_INTERACTION_TEST = {
  testPath:
    "src/components/screen-contracts/production-screen-account-interactions.test.ts",
  testId: "PRODUCTION-SCREEN-ACCOUNT-INTERACTIONS",
} as const;
const ADMIN_OPERATIONS_INTERACTION_TEST = {
  testPath:
    "src/components/screen-contracts/production-screen-admin-operations-interactions.test.ts",
  testId: "PRODUCTION-SCREEN-ADMIN-OPERATIONS-INTERACTIONS",
} as const;
const COMMERCE_INTERACTION_TEST = {
  testPath:
    "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
  testId: "PRODUCTION-SCREEN-COMMERCE-INTERACTIONS",
} as const;
const PUBLIC_NAVIGATION_INTERACTION_TEST = {
  testPath:
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  testId: "PRODUCTION-SCREEN-PUBLIC-NAVIGATION-INTERACTIONS",
} as const;

export const PRODUCT_STORY_CAPABILITY_EVIDENCE_SCOPE =
  "Source-static verification that the canonical 97-screen registry contains independently testable viewing stories, that the Design Lab Screen library owns separate filtering and searching Given/When/Then scenarios, and that each of the other 29 immutable atomic capabilities binds to an existing production-screen route, action result, enforcement contract and focused source test. The result-language checks include both sides of every shared save/unsave, publish/unpublish, join/leave, accept/decline and download/export action. This evidence verifies source contracts only; it does not execute mutations, prove request-level authorization, validate local runtime, staging or production behavior, or approve production readiness.";

export const PRODUCT_STORY_CAPABILITY_PREEXISTING_REQUIREMENT_IDS = [
  "STORY.CAP.view",
  "STORY.CAP.search",
  "STORY.CAP.filter",
] as const;

export const PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_REQUIREMENT_IDS = [
  "STORY.CAP.sort",
  "STORY.CAP.create",
  "STORY.CAP.edit",
  "STORY.CAP.delete",
  "STORY.CAP.save",
  "STORY.CAP.unsave",
  "STORY.CAP.publish",
  "STORY.CAP.unpublish",
  "STORY.CAP.comment",
  "STORY.CAP.react",
  "STORY.CAP.share",
  "STORY.CAP.report",
  "STORY.CAP.block",
  "STORY.CAP.join",
  "STORY.CAP.leave",
  "STORY.CAP.invite",
  "STORY.CAP.accept",
  "STORY.CAP.decline",
  "STORY.CAP.message",
  "STORY.CAP.call",
  "STORY.CAP.upload",
  "STORY.CAP.download",
  "STORY.CAP.export",
  "STORY.CAP.subscribe",
  "STORY.CAP.cancel",
  "STORY.CAP.retry",
  "STORY.CAP.recover",
  "STORY.CAP.auth-return",
  "STORY.CAP.billing-return",
] as const;

export type ProductStoryCapabilitySourceStaticRequirementId =
  (typeof PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_REQUIREMENT_IDS)[number];

export const PRODUCT_STORY_CAPABILITY_REQUIREMENT_IDS = [
  ...PRODUCT_STORY_CAPABILITY_PREEXISTING_REQUIREMENT_IDS,
  ...PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_REQUIREMENT_IDS,
] as const;

export type ProductStoryCapabilityRequirementId =
  (typeof PRODUCT_STORY_CAPABILITY_REQUIREMENT_IDS)[number];

export const PRODUCT_STORY_CAPABILITY_OPEN_REQUIREMENT_IDS = [] as const;

export type ProductStoryCapabilityOpenRequirementId =
  (typeof PRODUCT_STORY_CAPABILITY_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_STORY_CAPABILITY_EXPECTED_GAIN =
  PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_REQUIREMENT_IDS.length;

type ProductStoryCapabilitySourceStaticBinding = {
  requirementId: ProductStoryCapabilitySourceStaticRequirementId;
  route: string;
  actionId: string;
  testPath: string;
  testId: string;
  resultIncludes: readonly [string, ...string[]];
};

function sourceStaticBinding(
  requirementId: ProductStoryCapabilitySourceStaticRequirementId,
  route: string,
  actionId: string,
  resultIncludes: readonly [string, ...string[]],
  test: { readonly testPath: string; readonly testId: string },
): ProductStoryCapabilitySourceStaticBinding {
  return { requirementId, route, actionId, resultIncludes, ...test };
}

export const PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_BINDINGS = [
  sourceStaticBinding("STORY.CAP.sort", "/races", "RACES.ACTION.SORT", ["ordering"], PRODUCTION_SCREEN_COVERAGE_TEST),
  sourceStaticBinding("STORY.CAP.create", "/feed", "FEED.ACTION.POST.CREATE", ["publishes"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.edit", "/feed", "FEED.ACTION.POST.UPDATE", ["updates"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.delete", "/feed", "FEED.ACTION.POST.DELETE", ["deletes"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.save", "/feed", "FEED.ACTION.POST.SAVE", ["saves"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.unsave", "/feed", "FEED.ACTION.POST.SAVE", ["unsaves"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.publish", "/account/pages/[id]", "ACCOUNT-PAGE.ACTION.PUBLISH.TOGGLE", ["publishes"], ACCOUNT_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.unpublish", "/account/pages/[id]", "ACCOUNT-PAGE.ACTION.PUBLISH.TOGGLE", ["unpublishes"], ACCOUNT_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.comment", "/feed", "FEED.ACTION.COMMENT.CREATE", ["comment"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.react", "/feed", "FEED.ACTION.POST.REACT", ["reaction"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.share", "/feed", "FEED.ACTION.POST.SHARE", ["shares"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.report", "/feed", "FEED.ACTION.POST.REPORT", ["reports"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.block", "/feed", "FEED.ACTION.AUTHOR.BLOCK", ["blocks"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.join", "/feed", "FEED.ACTION.CALL.MANAGE", ["joins"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.leave", "/feed", "FEED.ACTION.CALL.MANAGE", ["leaves"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.invite", "/admin/organizations", "ADMIN-ORGANIZATIONS.ACTION.INVITATION.CREATE", ["invitation"], ADMIN_OPERATIONS_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.accept", "/feed", "FEED.ACTION.FRIEND.REQUEST.RESPOND", ["accepts"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.decline", "/feed", "FEED.ACTION.FRIEND.REQUEST.RESPOND", ["declines"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.message", "/feed", "FEED.ACTION.CHAT.SEND", ["message"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.call", "/feed", "FEED.ACTION.CALL.MANAGE", ["call"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.upload", "/feed", "FEED.ACTION.POST.MEDIA.SELECT", ["attachments"], COMMUNITY_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.download", "/account", "ACCOUNT.ACTION.DATA-EXPORT.REQUEST", ["downloads"], ACCOUNT_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.export", "/account", "ACCOUNT.ACTION.DATA-EXPORT.REQUEST", ["export"], ACCOUNT_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.subscribe", "/pricing", "PRICING.ACTION.CHECKOUT.START", ["pro checkout"], COMMERCE_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.cancel", "/account/profile", "ACCOUNT-PROFILE.ACTION.CANCEL", ["without submitting"], ACCOUNT_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.retry", "/account/billing", "ACCOUNT-BILLING.ACTION.CHECKOUT.RETRY", ["retry"], ACCOUNT_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.recover", "/auth/error", "AUTH-ERROR.ACTION.SIGN-IN.RETRY", ["fresh sign-in attempt"], PUBLIC_NAVIGATION_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.auth-return", "/account", "ACCOUNT.ACTION.SIGN-IN.OPEN", ["returns", "account plan intent"], ACCOUNT_INTERACTION_TEST),
  sourceStaticBinding("STORY.CAP.billing-return", "/account/billing", "ACCOUNT-BILLING.ACTION.STATUS.REFRESH", ["checkout return", "billing state"], ACCOUNT_INTERACTION_TEST),
] as const satisfies readonly ProductStoryCapabilitySourceStaticBinding[];

export type ProductStoryCapabilityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_STORY_CAPABILITY_EVIDENCE_FILE,
  PRODUCT_STORY_CAPABILITY_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductStoryCapabilityEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

const DESIGN_LAB_ATOMIC_STORY_EVIDENCE = [
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "src/components/screen-contracts/design-lab-user-stories.test.ts",
  "scripts/audit-design-lab-hydrated-stories.ts",
  "scripts/audit-design-lab-hydrated-stories.test.ts",
] as const;

const SOURCE_STATIC_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_BINDINGS.map((binding) => [
    binding.requirementId,
    tested(PRODUCTION_SCREEN_COVERAGE_FILE, binding.testPath),
  ]),
) as Readonly<
  Record<
    ProductStoryCapabilitySourceStaticRequirementId,
    ProductStoryCapabilityEvidenceRecord
  >
>;

export const PRODUCT_STORY_CAPABILITY_MASTER_EVIDENCE = {
  "STORY.CAP.view": tested(
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
    "src/components/screen-contracts/design-lab-user-stories.ts",
    "src/components/screen-contracts/design-lab-user-stories.test.ts",
  ),
  "STORY.CAP.search": tested(...DESIGN_LAB_ATOMIC_STORY_EVIDENCE),
  "STORY.CAP.filter": tested(...DESIGN_LAB_ATOMIC_STORY_EVIDENCE),
  ...SOURCE_STATIC_MASTER_EVIDENCE,
} as const satisfies Readonly<
  Record<
    ProductStoryCapabilityRequirementId,
    ProductStoryCapabilityEvidenceRecord
  >
>;
