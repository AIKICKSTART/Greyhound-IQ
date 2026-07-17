import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_E2E_JOURNEY_EVIDENCE_FILE =
  "src/components/product-e2e-journey-evidence.ts" as const;
export const PRODUCT_E2E_JOURNEY_EVIDENCE_TEST_FILE =
  "src/components/product-e2e-journey-evidence.test.ts" as const;

export const PRODUCT_E2E_JOURNEY_EVIDENCE_SCOPE =
  "Deterministic source-static verification that the listed canonical routes, actions and forms compose the named local journeys, with focused source tests that fail on route, action, form, authorization-contract or recovery-contract drift. This verifies local source contracts only; it does not execute browser clicks or mutations, prove a live identity, membership, billing, media, call or AI provider flow, demonstrate rendered mobile layout, or establish deployed behavior or production readiness.";

export const PRODUCT_E2E_JOURNEY_REQUIREMENT_IDS = [
  "VERIFY.E2E.visitor",
  "VERIFY.E2E.racing-context",
  "VERIFY.E2E.community-profile",
  "VERIFY.E2E.feed",
  "VERIFY.E2E.pulse-media",
  "VERIFY.E2E.call",
  "VERIFY.E2E.buyer",
  "VERIFY.E2E.seller-ownership",
  "VERIFY.E2E.billing",
  "VERIFY.E2E.team",
  "VERIFY.E2E.moderator",
  "VERIFY.E2E.moderator-denied",
  "VERIFY.E2E.administrator",
  "VERIFY.E2E.first-run",
  "VERIFY.E2E.restart-tour",
] as const;

export type ProductE2eJourneyRequirementId =
  (typeof PRODUCT_E2E_JOURNEY_REQUIREMENT_IDS)[number];

export const PRODUCT_E2E_JOURNEY_OPEN_REQUIREMENT_IDS = [
  "VERIFY.E2E.safe-sign-in-return",
  "VERIFY.E2E.group",
  "VERIFY.E2E.seller-publish",
  "VERIFY.E2E.account-settings",
  "VERIFY.E2E.ai",
  "VERIFY.E2E.mobile-onboarding",
  "VERIFY.E2E.lab-reproduction",
] as const;

export type ProductE2eJourneyOpenRequirementId =
  (typeof PRODUCT_E2E_JOURNEY_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_E2E_JOURNEY_OPEN_GAPS = {
  "VERIFY.E2E.safe-sign-in-return":
    "The callback source synchronizes a local user, but no explicit visible authentication-success state or authorised identity-provider journey proves a safe eventual return destination.",
  "VERIFY.E2E.group":
    "Forum thread creation and replies have source contracts, but the application has no complete group-membership state model or direct non-member join-and-participate proof.",
  "VERIFY.E2E.seller-publish":
    "A seller can submit a listing for moderator review, but publication is deliberately a moderator approval transition rather than a seller-owned publish action.",
  "VERIFY.E2E.account-settings":
    "Profile and notification controls are source-covered, but the required combined privacy, notification and security-settings update journey has no complete local mutation contract.",
  "VERIFY.E2E.ai":
    "Agent runs have source contracts, but the current user-facing surface lacks deterministic coverage of accurate running, completed and failure-state presentation.",
  "VERIFY.E2E.mobile-onboarding":
    "Onboarding source contracts cover device policies, viewport bounds and exits, but the required rendered mobile no-clipping/no-overflow journey needs a fresh browser recapture.",
  "VERIFY.E2E.lab-reproduction":
    "The local Design Lab browser audits exercise selected isolated fixtures, not all 22 product journeys with every required fixture and state.",
} as const satisfies Readonly<
  Record<ProductE2eJourneyOpenRequirementId, string>
>;

export type ProductE2eJourneyBinding = {
  requirementId: ProductE2eJourneyRequirementId;
  routes: readonly string[];
  actionIds: readonly string[];
  formIds: readonly string[];
  evidence: readonly string[];
};

function journey(
  requirementId: ProductE2eJourneyRequirementId,
  routes: readonly string[],
  actionIds: readonly string[],
  formIds: readonly string[],
  evidence: readonly string[],
): ProductE2eJourneyBinding {
  return { requirementId, routes, actionIds, formIds, evidence };
}

export const PRODUCT_E2E_JOURNEY_BINDINGS = [
  journey(
    "VERIFY.E2E.visitor",
    ["/", "/pricing", "/responsible-use", "/terms", "/privacy", "/contact"],
    [
      "HOME.ACTION.RACES.JUMP",
      "PRICING.ACTION.CHECKOUT.START",
      "RESPONSIBLE-USE.ACTION.CONTACT.OPEN",
      "TERMS.ACTION.CONTACT.OPEN",
      "PRIVACY.ACTION.CONTACT.OPEN",
      "CONTACT.ACTION.TICKET.CREATE",
    ],
    ["PRICING.FORM.CHECKOUT", "CONTACT.FORM.TICKET"],
    [
      "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
      "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
      "src/components/screen-contracts/production-screen-member-support-interactions.test.ts",
    ],
  ),
  journey(
    "VERIFY.E2E.racing-context",
    ["/races", "/dogs", "/races/[id]", "/tracks/[id]"],
    [
      "RACES.ACTION.SEARCH",
      "RACES.ACTION.STATE.FILTER",
      "RACES.ACTION.RACE.OPEN",
      "DOGS.ACTION.SEARCH",
      "RACE-DETAIL.ACTION.MEETING.OPEN",
      "TRACK-DETAIL.ACTION.RACE.OPEN",
    ],
    ["RACES.FORM.SEARCH"],
    ["src/components/screen-contracts/production-screen-public-racing-interactions.test.ts"],
  ),
  journey(
    "VERIFY.E2E.community-profile",
    ["/discover", "/p/[handle]"],
    [
      "DISCOVER.ACTION.SEARCH",
      "DISCOVER.ACTION.ACTOR.OPEN",
      "PROFILE.ACTION.CHAT.START",
    ],
    ["DISCOVER.FORM.SEARCH", "PROFILE.FORM.PERSONAL-CHAT"],
    ["src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts"],
  ),
  journey(
    "VERIFY.E2E.feed",
    ["/feed"],
    [
      "FEED.ACTION.POST.CREATE",
      "FEED.ACTION.COMMENT.CREATE",
      "FEED.ACTION.POST.REACT",
      "FEED.ACTION.POST.SAVE",
      "FEED.ACTION.POST.SHARE",
    ],
    ["FEED.FORM.POST", "FEED.FORM.COMMENT"],
    [
      "src/components/screen-contracts/production-screen-community-interactions.test.ts",
      "src/components/screen-contracts/production-screen-coverage.ts",
    ],
  ),
  journey(
    "VERIFY.E2E.pulse-media",
    ["/pulse", "/pulse/[id]"],
    [
      "PULSE.ACTION.MESSAGE.SEND",
      "PULSE-THREAD.ACTION.ATTACHMENT.OPEN",
      "PULSE-THREAD.ACTION.MESSAGE.SEND",
    ],
    ["PULSE.FORM.MESSAGE", "PULSE-THREAD.FORM.MESSAGE"],
    [
      "src/components/screen-contracts/production-screen-community-interactions.test.ts",
      "src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts",
      "src/components/screen-contracts/production-screen-coverage.ts",
    ],
  ),
  journey(
    "VERIFY.E2E.call",
    ["/pulse/[id]"],
    ["PULSE-THREAD.ACTION.CALL.MANAGE"],
    [],
    [
      "src/components/screen-contracts/production-screen-community-interactions.test.ts",
      "src/components/product-community-dropped-call-recovery-evidence.test.ts",
    ],
  ),
  journey(
    "VERIFY.E2E.buyer",
    ["/marketplace", "/marketplace/[id]"],
    [
      "MARKETPLACE.ACTION.FILTER",
      "MARKETPLACE.ACTION.LISTING.OPEN",
      "MARKETPLACE.ACTION.CARD.SAVE",
      "MARKETPLACE-DETAIL.ACTION.ENQUIRY.SEND",
    ],
    ["MARKETPLACE.FORM.FILTER", "MARKETPLACE-DETAIL.FORM.ENQUIRY"],
    ["src/components/screen-contracts/production-screen-marketplace-interactions.test.ts"],
  ),
  journey(
    "VERIFY.E2E.seller-ownership",
    ["/marketplace/[id]/edit"],
    ["MARKETPLACE-EDIT.ACTION.SAVE"],
    ["MARKETPLACE-EDIT.FORM.LISTING"],
    ["src/components/screen-contracts/production-screen-commerce-interactions.test.ts"],
  ),
  journey(
    "VERIFY.E2E.billing",
    ["/pricing", "/account/billing"],
    ["PRICING.ACTION.CHECKOUT.START", "ACCOUNT-BILLING.ACTION.STATUS.REFRESH"],
    ["PRICING.FORM.CHECKOUT", "ACCOUNT-BILLING.FORM.PORTAL"],
    [
      "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
      "src/components/screen-contracts/production-screen-account-interactions.test.ts",
    ],
  ),
  journey(
    "VERIFY.E2E.team",
    ["/account/team"],
    ["ACCOUNT-TEAM.ACTION.INVITATION.COPY"],
    [
      "ACCOUNT-TEAM.FORM.INVITATION.CREATE",
      "ACCOUNT-TEAM.FORM.MEMBER.ROLE",
    ],
    ["src/components/screen-contracts/production-screen-member-support-interactions.test.ts"],
  ),
  journey(
    "VERIFY.E2E.moderator",
    ["/admin/listings"],
    ["ADMIN-LISTINGS.ACTION.LISTING.APPROVE"],
    ["ADMIN-LISTINGS.FORM.APPROVE"],
    ["src/components/screen-contracts/production-screen-admin-moderation-interactions.test.ts"],
  ),
  journey(
    "VERIFY.E2E.moderator-denied",
    ["/admin/bug-reports"],
    ["ADMIN-BUG-REPORTS.ACTION.UPDATE"],
    ["ADMIN-BUG-REPORTS.FORM.UPDATE"],
    [
      "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts",
      "src/components/screen-contracts/production-screen-admin-operations-interactions.test.ts",
    ],
  ),
  journey(
    "VERIFY.E2E.administrator",
    ["/admin/users"],
    ["ADMIN-USERS.ACTION.ACCESS.UPDATE"],
    ["ADMIN-USERS.FORM.ACCESS.UPDATE"],
    [
      "src/components/screen-contracts/production-screen-admin-operations-interactions.test.ts",
      "security/audit-event-coverage.test.ts",
    ],
  ),
  journey(
    "VERIFY.E2E.first-run",
    ["/", "/account", "/races", "/feed"],
    [],
    [],
    ["src/components/product-onboarding-capability-evidence.test.ts"],
  ),
  journey(
    "VERIFY.E2E.restart-tour",
    ["/account"],
    [],
    [],
    ["src/components/product-onboarding-capability-evidence.test.ts"],
  ),
] as const satisfies readonly ProductE2eJourneyBinding[];

export const PRODUCT_E2E_JOURNEY_EXPECTED_GAIN =
  PRODUCT_E2E_JOURNEY_REQUIREMENT_IDS.length;

type ProductE2eJourneyEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_E2E_JOURNEY_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_E2E_JOURNEY_BINDINGS.map((binding) => [
    binding.requirementId,
    {
      status: "tested" as const,
      evidence: [
        PRODUCT_E2E_JOURNEY_EVIDENCE_FILE,
        PRODUCT_E2E_JOURNEY_EVIDENCE_TEST_FILE,
        ...binding.evidence,
      ],
    },
  ]),
) as unknown as Readonly<
  Record<ProductE2eJourneyRequirementId, ProductE2eJourneyEvidenceRecord>
>;
