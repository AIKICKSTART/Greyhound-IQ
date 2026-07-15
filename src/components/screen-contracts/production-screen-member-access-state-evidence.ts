import type { FamilyScreenManifest, NonEmpty } from "./types";

export const PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-MEMBER-ACCESS-STATE-EVIDENCE",
  path: "src/components/screen-contracts/production-screen-member-access-state-evidence.test.ts",
} as const satisfies FamilyScreenManifest["tests"][number];

const TEST_IDS = [
  PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST.id,
] as const;

type SourceAssertion = {
  sourcePath: string;
  symbol?: string;
  orderedText: NonEmpty<string>;
};

type ScreenStateWithEvidence = FamilyScreenManifest["states"][number] & {
  sourceAssertions: NonEmpty<SourceAssertion>;
};

type MemberPermissionContract = {
  route: string;
  sourcePath: string;
  permissions: FamilyScreenManifest["permissions"];
  sourceAssertions: NonEmpty<SourceAssertion>;
};

type MemberStateContract = {
  route: string;
  sourcePath: string;
  states: NonEmpty<ScreenStateWithEvidence>;
};

const PRIVATE_MEMBER_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting private account data",
    decision: "deny",
    enforcedBy:
      "The page either withholds its signed-in branch or resolves requireCurrentUserProfile before any private read; the focused source test verifies the route-specific order.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member requesting their account surface",
    decision: "allow",
    enforcedBy:
      "The page passes only the server-resolved current identity into its private reads; object-specific editors additionally use an ownership-scoped lookup.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const OWNER_SCOPED_MEMBER_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting a private member-owned record",
    decision: "deny",
    enforcedBy:
      "The page resolves requireCurrentUserProfile before the owner-scoped read and redirects a missing session to sign-in.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member requesting another member's record",
    decision: "deny",
    enforcedBy:
      "The data lookup combines the requested identifier with the server-resolved current user or profile identifier and exposes an unmatched result only as not-found.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated owner requesting their private record",
    decision: "allow",
    enforcedBy:
      "The page renders the record only after the owner-scoped lookup succeeds for the server-resolved current identity.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const PRO_LISTING_EDITOR_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting the listing editor",
    decision: "deny",
    enforcedBy:
      "requireListingEditorProfile redirects a missing session to sign-in before the listing lookup or editor render.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member below Pro requesting the listing editor",
    decision: "deny",
    enforcedBy:
      "ListingEditPage checks the server-resolved tier and redirects to pricing before loading the private listing.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated Pro member requesting another seller's listing editor",
    decision: "deny",
    enforcedBy:
      "getOwnedListingForCurrentUser combines the requested identifier with current.profileId and ListingEditPage maps an unmatched record to not-found.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated Pro owner requesting their listing editor",
    decision: "allow",
    enforcedBy:
      "ListingEditPage renders ListingEditForm only after the server-side tier check and ownership-scoped listing lookup both succeed.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const MANAGED_PAGE_PERMISSIONS = [
  ...PRIVATE_MEMBER_PERMISSIONS,
  {
    actor: "Authenticated Free member creating managed pages",
    decision: "deny",
    enforcedBy:
      "MyPagesPage checks the server-resolved tier and returns the Pro boundary before loading or rendering managed-page creation controls.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated Pro or Pro+ member creating managed pages",
    decision: "allow",
    enforcedBy:
      "MyPagesPage accepts the server-resolved paid tier before loading the member's ownership-scoped page and dog inventories.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const AGENT_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting private agent runs or execution",
    decision: "deny",
    enforcedBy:
      "AgentsPage substitutes an empty run inventory without a database identity, ProGate withholds the execution form, and createAgentRun independently requires the current profile.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member without the required agent allowance",
    decision: "deny",
    enforcedBy:
      "runAgentForCurrentUser calls assertAgentTier before conversation, memory, or AgentRun persistence and rejects insufficient allowance with payment.required.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member with the required agent allowance",
    decision: "allow",
    enforcedBy:
      "createAgentRun resolves the current profile and validated agent type before runAgentForCurrentUser performs the server-side tier check and creates the run.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const APPEARANCE_PREVIEW_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting Appearance Studio",
    decision: "deny",
    enforcedBy:
      "AccountAppearancePage keeps the production preview flag fail-closed, then redirects a missing server-resolved session to sign-in before resolving URL preview state.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member requesting enabled Appearance Studio",
    decision: "allow",
    enforcedBy:
      "After the production preview flag permits the route, AccountAppearancePage requires getCurrentUser to resolve an authenticated member before rendering the non-persistent preview.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

function assertion(
  sourcePath: string,
  symbol: string,
  orderedText: NonEmpty<string>,
): SourceAssertion {
  return { sourcePath, symbol, orderedText };
}

function state(
  id: string,
  sourcePath: string,
  symbol: string,
  orderedText: NonEmpty<string>,
  additionalAssertions: readonly SourceAssertion[] = [],
): ScreenStateWithEvidence {
  return {
    id,
    testIds: TEST_IDS,
    sourceAssertions: [
      assertion(sourcePath, symbol, orderedText),
      ...additionalAssertions,
    ],
  };
}

export const PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS = [
  {
    route: "/account",
    sourcePath: "src/app/account/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/page.tsx", "AccountPage", [
        "const user = await getCurrentUser();",
        "{!user ? (",
        "<SignedOutAccount",
        ") : (",
        "<SignedInAccount",
      ]),
      assertion("src/app/account/page.tsx", "SignedInAccount", [
        "const dbContext = user.dbUserId",
        "getAccountSummary(dbContext, user.email)",
        "getMessagesForUserEmail(dbContext, user.email)",
      ]),
    ],
  },
  {
    route: "/account/appearance",
    sourcePath: "src/app/account/appearance/page.tsx",
    permissions: APPEARANCE_PREVIEW_PERMISSIONS,
    sourceAssertions: [
      assertion(
        "src/app/account/appearance/page.tsx",
        "AccountAppearancePage",
        [
          'process.env.NODE_ENV === "production"',
          'process.env.ENABLE_DEVICE_PREVIEWS !== "true"',
          "notFound();",
          "if (!(await getCurrentUser()))",
          'redirect("/sign-in?returnTo=/account/appearance")',
          "const state = resolveAppearancePreviewState(await searchParams);",
        ],
      ),
    ],
  },
  {
    route: "/account/billing",
    sourcePath: "src/app/account/billing/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/billing/page.tsx", "BillingPage", [
        "const user = await getCurrentUser();",
        "{user ? (",
        "<SignedInBilling user={user} />",
        ") : (",
        "<SignedOutBilling />",
      ]),
      assertion("src/app/account/billing/page.tsx", "SignedInBilling", [
        "const overview = await getLocalBillingOverview(user);",
      ]),
    ],
  },
  {
    route: "/account/listings",
    sourcePath: "src/app/account/listings/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/listings/page.tsx", "SellerListingsPage", [
        '<SellerListingsViewPage view="all" />',
      ]),
      assertion(
        "src/app/account/listings/seller-listings-page.tsx",
        "SellerListingsViewPage",
        [
          "const current = await requireSellerListingsProfile(view);",
          "const listings = await getSellerListingsForCurrentUser(current, view);",
        ],
      ),
      assertion(
        "src/lib/listing-service.ts",
        "getSellerListingsForCurrentUser",
        [
          "profileId: current.profileId",
          "take: 100",
        ],
      ),
    ],
  },
  {
    route: "/account/listings/archived",
    sourcePath: "src/app/account/listings/archived/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion(
        "src/app/account/listings/archived/page.tsx",
        "SellerListingArchivedPage",
        ['<SellerListingsViewPage view="archived" />'],
      ),
      assertion(
        "src/app/account/listings/seller-listings-page.tsx",
        "SellerListingsViewPage",
        [
          "const current = await requireSellerListingsProfile(view);",
          "const listings = await getSellerListingsForCurrentUser(current, view);",
        ],
      ),
      assertion(
        "src/lib/listing-service.ts",
        "getSellerListingsForCurrentUser",
        [
          "const statuses = sellerListingStatuses(view);",
          "profileId: current.profileId",
          "take: 100",
        ],
      ),
    ],
  },
  {
    route: "/account/listings/drafts",
    sourcePath: "src/app/account/listings/drafts/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion(
        "src/app/account/listings/drafts/page.tsx",
        "SellerListingDraftsPage",
        ['<SellerListingsViewPage view="drafts" />'],
      ),
      assertion(
        "src/app/account/listings/seller-listings-page.tsx",
        "SellerListingsViewPage",
        [
          "const current = await requireSellerListingsProfile(view);",
          "const listings = await getSellerListingsForCurrentUser(current, view);",
        ],
      ),
      assertion(
        "src/lib/listing-service.ts",
        "getSellerListingsForCurrentUser",
        [
          "const statuses = sellerListingStatuses(view);",
          "profileId: current.profileId",
          "take: 100",
        ],
      ),
    ],
  },
  {
    route: "/account/notifications",
    sourcePath: "src/app/account/notifications/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion(
        "src/app/account/notifications/page.tsx",
        "AccountNotificationsPage",
        [
          "const current = await requireNotificationsProfile();",
          "listNotificationsForUser(current.dbUserId)",
          "getMarketingPreferences(current)",
        ],
      ),
      assertion(
        "src/app/account/notifications/page.tsx",
        "requireNotificationsProfile",
        [
          "return await requireCurrentUserProfile();",
          'err.message === "auth.unauthorized"',
          'redirect("/sign-in")',
        ],
      ),
    ],
  },
  {
    route: "/account/pages",
    sourcePath: "src/app/account/pages/page.tsx",
    permissions: MANAGED_PAGE_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/pages/page.tsx", "MyPagesPage", [
        "const current = await requireCurrentUserProfile();",
        'const isPro = hasTier(current.tier, "pro");',
        "if (!isPro)",
        "await Promise.all([",
        "listCustomPagesForCurrentUser(current)",
      ]),
    ],
  },
  {
    route: "/account/pages/[id]",
    sourcePath: "src/app/account/pages/[id]/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/pages/[id]/page.tsx", "EditCustomPage", [
        "const current = await requireCurrentUserProfile();",
        "const page = await getOwnedCustomPage(current, id);",
        "if (!page) notFound();",
      ]),
      assertion("src/lib/custom-page-service.ts", "getOwnedCustomPage", [
        "withDbRequestContext(current",
        "where: { id: pageId, ownerProfileId: current.profileId }",
      ]),
    ],
  },
  {
    route: "/account/privacy",
    sourcePath: "src/app/account/privacy/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/privacy/page.tsx", "AccountPrivacyPage", [
        "const current = await requirePrivacyProfile();",
        "const records = await getPrivacyRecords(current);",
      ]),
      assertion("src/app/account/privacy/page.tsx", "requirePrivacyProfile", [
        "return await requireCurrentUserProfile();",
        'err.message === "auth.unauthorized"',
        'redirect("/sign-in")',
      ]),
    ],
  },
  {
    route: "/account/profile",
    sourcePath: "src/app/account/profile/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/profile/page.tsx", "ProfileStudioPage", [
        'if (!(await getCurrentUser())) redirect("/sign-in?returnTo=/account/profile");',
        "const current = await requireCurrentUserProfile();",
        "const media = await getPersonalActorMedia(current);",
      ]),
    ],
  },
  {
    route: "/account/saved-listings",
    sourcePath: "src/app/account/saved-listings/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/saved-listings/page.tsx", "SavedListingsPage", [
        "const current = await requireSavedListingsProfile();",
        "const savedListings = await getSavedListingsForCurrentUser(current);",
      ]),
      assertion(
        "src/app/account/saved-listings/page.tsx",
        "requireSavedListingsProfile",
        [
          "return await requireCurrentUserProfile();",
          'err.message === "auth.unauthorized"',
          'redirect("/sign-in")',
        ],
      ),
    ],
  },
  {
    route: "/account/security",
    sourcePath: "src/app/account/security/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/security/page.tsx", "AccountSecurityPage", [
        "const account = await requireSecurityAccount();",
      ]),
      assertion("src/app/account/security/page.tsx", "requireSecurityAccount", [
        "const current = await requireCurrentUserProfile();",
        "deletionRequestedAt: current.deletionRequestedAt",
        'err.message === "auth.unauthorized"',
        'redirect("/sign-in")',
      ]),
    ],
  },
  {
    route: "/account/support",
    sourcePath: "src/app/account/support/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/support/page.tsx", "AccountSupportPage", [
        "const current = await requireSupportProfile();",
        "const tickets = await getSupportTicketsForUser(current);",
      ]),
      assertion("src/app/account/support/page.tsx", "requireSupportProfile", [
        "return await requireCurrentUserProfile();",
        'err.message === "auth.unauthorized"',
        'redirect("/sign-in")',
      ]),
    ],
  },
  {
    route: "/account/support/[id]",
    sourcePath: "src/app/account/support/[id]/page.tsx",
    permissions: OWNER_SCOPED_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion(
        "src/app/account/support/[id]/page.tsx",
        "AccountSupportTicketPage",
        [
          "const current = await requireSupportTicketProfile();",
          "const ticket = await getSupportTicketForCurrentUser(current, id);",
          "if (!ticket) notFound();",
        ],
      ),
      assertion(
        "src/lib/support-ticket-service.ts",
        "getSupportTicketForCurrentUser",
        [
          "id: ticketId",
          "userId: current.dbUserId",
          "if (!ticket) return null;",
        ],
      ),
    ],
  },
  {
    route: "/listings/[id]/edit",
    sourcePath: "src/app/listings/[id]/edit/page.tsx",
    permissions: PRO_LISTING_EDITOR_PERMISSIONS,
    sourceAssertions: [
      assertion(
        "src/app/listings/[id]/edit/page.tsx",
        "ListingEditPage",
        [
          "const current = await requireListingEditorProfile(id);",
          'if (!hasTier(current.tier, "pro"))',
          "listing = await getOwnedListingForCurrentUser(current, id);",
          "<ListingEditForm",
        ],
      ),
      assertion(
        "src/lib/listing-service.ts",
        "getOwnedListingForCurrentUser",
        [
          "where: { id: listingId, profileId: current.profileId }",
          'throw new Error("listing.not_found")',
        ],
      ),
    ],
  },
  {
    route: "/marketplace/[id]/edit",
    sourcePath: "src/app/marketplace/[id]/edit/page.tsx",
    permissions: PRO_LISTING_EDITOR_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/marketplace/[id]/edit/page.tsx", "", [
        "import ListingEditPage, {",
        'from "../../../listings/[id]/edit/page";',
        "export default ListingEditPage;",
      ]),
      assertion(
        "src/app/listings/[id]/edit/page.tsx",
        "ListingEditPage",
        [
          "const current = await requireListingEditorProfile(id);",
          'if (!hasTier(current.tier, "pro"))',
          "listing = await getOwnedListingForCurrentUser(current, id);",
        ],
      ),
      assertion(
        "src/lib/listing-service.ts",
        "getOwnedListingForCurrentUser",
        ["where: { id: listingId, profileId: current.profileId }"],
      ),
    ],
  },
  {
    route: "/account/team",
    sourcePath: "src/app/account/team/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/team/page.tsx", "AccountTeamPage", [
        "const current = await requireTeamProfile(returnTo);",
        "const organizations = await safeQuery(",
        "() => listOrganizationTeams(current)",
      ]),
      assertion("src/app/account/team/page.tsx", "requireTeamProfile", [
        "return await requireCurrentUserProfile();",
        'error.message === "auth.unauthorized"',
        "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
      ]),
    ],
  },
  {
    route: "/account/usage",
    sourcePath: "src/app/account/usage/page.tsx",
    permissions: PRIVATE_MEMBER_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/account/usage/page.tsx", "AccountUsagePage", [
        "const user = await getCurrentUser();",
        "{user ? (",
        "<SignedInUsage user={user} />",
        ") : (",
        "<SignedOutUsage />",
      ]),
      assertion("src/app/account/usage/page.tsx", "SignedInUsage", [
        "await Promise.all([",
        "getEntitlementLimitsForCurrentUser(user)",
        "getUsageEventsForUser(user)",
      ]),
    ],
  },
  {
    route: "/agents",
    sourcePath: "src/app/agents/page.tsx",
    permissions: AGENT_PERMISSIONS,
    sourceAssertions: [
      assertion("src/app/agents/page.tsx", "AgentsPage", [
        "const user = await getCurrentUser();",
        "const runs = user?.dbUserId",
        ": [];",
        '<ProGate minTier="pro" feature="Live agent execution">',
        "action={createAgentRun}",
      ]),
      assertion("src/app/actions.ts", "createAgentRun", [
        "const current = await requireCurrentUserProfile();",
        "agentFormSchema.parse",
        "await runAgentForCurrentUser(current, agentType",
      ]),
      assertion("src/lib/agent-service.ts", "runAgentForCurrentUser", [
        "isEmergencyControlActive(process.env.AI_DISABLED)",
        "assertAgentTier(current, agentType);",
        "tx.agentRun.create",
      ]),
    ],
  },
] as const satisfies readonly MemberPermissionContract[];

export const PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS = [
  {
    route: "/account",
    sourcePath: "src/app/account/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT.SIGNED-OUT", "src/app/account/page.tsx", "AccountPage", [
        "{!user ? (",
        "<SignedOutAccount",
      ]),
      state("PRODUCTION.STATE.ACCOUNT.EMPTY-DOGS", "src/app/account/page.tsx", "SignedInAccount", [
        "{ownedDogs.length > 0 ? (",
        "No dogs are linked to this profile yet.",
      ]),
      state("PRODUCTION.STATE.ACCOUNT.POPULATED", "src/app/account/page.tsx", "SignedInAccount", [
        "{ownedDogs.length > 0 ? (",
        "{ownedDogs.map((ownership) => (",
      ]),
    ],
  },
  {
    route: "/account/appearance",
    sourcePath: "src/app/account/appearance/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-APPEARANCE.DISABLED", "src/app/account/appearance/page.tsx", "AccountAppearancePage", [
        'process.env.NODE_ENV === "production"',
        'process.env.ENABLE_DEVICE_PREVIEWS !== "true"',
        "notFound();",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-APPEARANCE.PREVIEW", "src/app/account/appearance/page.tsx", "AccountAppearancePage", [
        "if (!(await getCurrentUser()))",
        'redirect("/sign-in?returnTo=/account/appearance")',
        "const state = resolveAppearancePreviewState(await searchParams);",
        "data-appearance-studio",
        "Preview only — saving is disabled",
      ]),
    ],
  },
  {
    route: "/account/billing",
    sourcePath: "src/app/account/billing/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-BILLING.SIGNED-OUT", "src/app/account/billing/page.tsx", "BillingPage", [
        "{user ? (",
        "<SignedInBilling user={user} />",
        ") : (",
        "<SignedOutBilling />",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-BILLING.FIRST-USE", "src/app/account/billing/page.tsx", "BillingOutcomeBanner", [
        'if (portal === "no_customer" || billing === "not_started")',
        "No Stripe billing profile yet",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-BILLING.EMPTY-INVOICES", "src/app/account/billing/page.tsx", "SignedInBilling", [
        "{overview.invoices.length > 0 ? (",
        'title="No local invoices"',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-BILLING.POPULATED", "src/app/account/billing/page.tsx", "SignedInBilling", [
        "{overview.invoices.length > 0 ? (",
        "{overview.invoices.map((invoice) => (",
      ]),
    ],
  },
  {
    route: "/account/listings",
    sourcePath: "src/app/account/listings/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS.SIGNED-OUT-REDIRECT", "src/app/account/listings/seller-listings-page.tsx", "requireSellerListingsProfile", [
        "return await requireCurrentUserProfile();",
        'error.message === "auth.unauthorized"',
        "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS.EMPTY", "src/app/account/listings/seller-listings-page.tsx", "SellerListingsViewPage", [
        "{listings.length > 0 ? (",
        "Nothing in this view",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS.POPULATED", "src/app/account/listings/seller-listings-page.tsx", "SellerListingsViewPage", [
        "{listings.length > 0 ? (",
        "{listings.map((listing) => (",
      ]),
    ],
  },
  {
    route: "/account/listings/archived",
    sourcePath: "src/app/account/listings/archived/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS-ARCHIVED.SIGNED-OUT-REDIRECT", "src/app/account/listings/seller-listings-page.tsx", "requireSellerListingsProfile", [
        "return await requireCurrentUserProfile();",
        'error.message === "auth.unauthorized"',
        "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS-ARCHIVED.EMPTY", "src/app/account/listings/seller-listings-page.tsx", "SellerListingsViewPage", [
        "{listings.length > 0 ? (",
        "Nothing in this view",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS-ARCHIVED.POPULATED", "src/app/account/listings/seller-listings-page.tsx", "SellerListingsViewPage", [
        "{listings.length > 0 ? (",
        "{listings.map((listing) => (",
      ]),
    ],
  },
  {
    route: "/account/listings/drafts",
    sourcePath: "src/app/account/listings/drafts/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS-DRAFTS.SIGNED-OUT-REDIRECT", "src/app/account/listings/seller-listings-page.tsx", "requireSellerListingsProfile", [
        "return await requireCurrentUserProfile();",
        'error.message === "auth.unauthorized"',
        "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS-DRAFTS.EMPTY", "src/app/account/listings/seller-listings-page.tsx", "SellerListingsViewPage", [
        "{listings.length > 0 ? (",
        "Nothing in this view",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-LISTINGS-DRAFTS.POPULATED", "src/app/account/listings/seller-listings-page.tsx", "SellerListingsViewPage", [
        "{listings.length > 0 ? (",
        "{listings.map((listing) => (",
      ]),
    ],
  },
  {
    route: "/account/notifications",
    sourcePath: "src/app/account/notifications/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-NOTIFICATIONS.SIGNED-OUT-REDIRECT", "src/app/account/notifications/page.tsx", "requireNotificationsProfile", [
        "return await requireCurrentUserProfile();",
        'redirect("/sign-in")',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-NOTIFICATIONS.EMPTY", "src/app/account/notifications/page.tsx", "AccountNotificationsPage", [
        "{notifications.length > 0 ? (",
        'label="No in-app notifications recorded."',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-NOTIFICATIONS.POPULATED", "src/app/account/notifications/page.tsx", "AccountNotificationsPage", [
        "{notifications.length > 0 ? (",
        "<NotificationList records={notifications} />",
      ]),
    ],
  },
  {
    route: "/account/pages",
    sourcePath: "src/app/account/pages/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-PAGES.TIER-BLOCKED", "src/app/account/pages/page.tsx", "MyPagesPage", [
        'const isPro = hasTier(current.tier, "pro");',
        "if (!isPro)",
        "Custom pages are a Pro feature",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-PAGES.EMPTY", "src/app/account/pages/page.tsx", "MyPagesPage", [
        "{pages.length === 0 ? (",
        "Create your first page",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-PAGES.POPULATED", "src/app/account/pages/page.tsx", "MyPagesPage", [
        "{pages.length === 0 ? (",
        "{pages.map((page) => {",
      ]),
    ],
  },
  {
    route: "/account/pages/[id]",
    sourcePath: "src/app/account/pages/[id]/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-PAGE-EDITOR.MISSING", "src/app/account/pages/[id]/page.tsx", "EditCustomPage", [
        "const page = await getOwnedCustomPage(current, id);",
        "if (!page) notFound();",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-PAGE-EDITOR.EMPTY-GALLERY", "src/app/account/pages/[id]/page.tsx", "EditCustomPage", [
        "{media.galleryUrls.length > 0 ? (",
        "No gallery images yet",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-PAGE-EDITOR.POPULATED", "src/app/account/pages/[id]/page.tsx", "EditCustomPage", [
        "{media.galleryUrls.length > 0 ? (",
        "{media.galleryUrls.map((url, index) => (",
      ]),
    ],
  },
  {
    route: "/account/privacy",
    sourcePath: "src/app/account/privacy/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-PRIVACY.SIGNED-OUT-REDIRECT", "src/app/account/privacy/page.tsx", "requirePrivacyProfile", [
        "return await requireCurrentUserProfile();",
        'redirect("/sign-in")',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-PRIVACY.EMPTY", "src/app/account/privacy/page.tsx", "AccountPrivacyPage", [
        "{records.exportArtifacts.length > 0 ? (",
        'label="No export artifacts recorded."',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-PRIVACY.POPULATED", "src/app/account/privacy/page.tsx", "AccountPrivacyPage", [
        "{records.exportArtifacts.length > 0 ? (",
        "<ExportArtifactTable records={records.exportArtifacts} />",
      ]),
    ],
  },
  {
    route: "/account/profile",
    sourcePath: "src/app/account/profile/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-PROFILE.SIGNED-OUT-REDIRECT", "src/app/account/profile/page.tsx", "ProfileStudioPage", [
        'if (!(await getCurrentUser())) redirect("/sign-in?returnTo=/account/profile");',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-PROFILE.EDITOR", "src/app/account/profile/page.tsx", "ProfileStudioPage", [
        "const media = await getPersonalActorMedia(current);",
        'id="cover-image-editor"',
        'id="profile-picture-editor"',
      ]),
    ],
  },
  {
    route: "/account/saved-listings",
    sourcePath: "src/app/account/saved-listings/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-SAVED-LISTINGS.SIGNED-OUT-REDIRECT", "src/app/account/saved-listings/page.tsx", "requireSavedListingsProfile", [
        "return await requireCurrentUserProfile();",
        'redirect("/sign-in")',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SAVED-LISTINGS.EMPTY", "src/app/account/saved-listings/page.tsx", "SavedListingsPage", [
        "{savedListings.length > 0 ? (",
        "No saved marketplace items yet",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SAVED-LISTINGS.POPULATED", "src/app/account/saved-listings/page.tsx", "SavedListingsPage", [
        "{savedListings.length > 0 ? (",
        "{savedListings.map((item) => (",
      ]),
    ],
  },
  {
    route: "/account/security",
    sourcePath: "src/app/account/security/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-SECURITY.SIGNED-OUT-REDIRECT", "src/app/account/security/page.tsx", "requireSecurityAccount", [
        "const current = await requireCurrentUserProfile();",
        'redirect("/sign-in")',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SECURITY.POPULATED", "src/app/account/security/page.tsx", "AccountSecurityPage", [
        "const account = await requireSecurityAccount();",
        '<InfoRow label="Email" value={account.email} />',
        '<InfoRow label="Tier" value={TIER_LABELS[account.tier]} />',
      ]),
    ],
  },
  {
    route: "/account/support",
    sourcePath: "src/app/account/support/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT.SIGNED-OUT-REDIRECT", "src/app/account/support/page.tsx", "requireSupportProfile", [
        "return await requireCurrentUserProfile();",
        'redirect("/sign-in")',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT.EMPTY", "src/app/account/support/page.tsx", "AccountSupportPage", [
        ") : tickets.length > 0 ? (",
        "<EmptyState />",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT.POPULATED", "src/app/account/support/page.tsx", "AccountSupportPage", [
        ") : tickets.length > 0 ? (",
        "<TicketList tickets={tickets} />",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT.UNAVAILABLE", "src/app/account/support/page.tsx", "AccountSupportPage", [
        "{tickets === null ? (",
        "<UnavailableState />",
      ]),
    ],
  },
  {
    route: "/account/support/[id]",
    sourcePath: "src/app/account/support/[id]/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT-DETAIL.SIGNED-OUT-REDIRECT", "src/app/account/support/[id]/page.tsx", "requireSupportTicketProfile", [
        "return await requireCurrentUserProfile();",
        'err.message === "auth.unauthorized"',
        'redirect("/sign-in");',
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT-DETAIL.MISSING", "src/app/account/support/[id]/page.tsx", "AccountSupportTicketPage", [
        "const ticket = await getSupportTicketForCurrentUser(current, id);",
        "if (!ticket) notFound();",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT-DETAIL.EMPTY", "src/app/account/support/[id]/page.tsx", "AccountSupportTicketPage", [
        "{ticket.messages.length > 0 ? (",
        "No messages are available",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT-DETAIL.POPULATED", "src/app/account/support/[id]/page.tsx", "AccountSupportTicketPage", [
        "{ticket.messages.length > 0 ? (",
        "{ticket.messages.map((message) => {",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-SUPPORT-DETAIL.CAPPED", "src/app/account/support/[id]/page.tsx", "AccountSupportTicketPage", [
        "const isMessageListCapped = messageCount > SUPPORT_TICKET_MESSAGE_LIMIT;",
        "{isMessageListCapped ? (",
        "Latest {SUPPORT_TICKET_MESSAGE_LIMIT} shown",
      ]),
    ],
  },
  {
    route: "/listings/[id]/edit",
    sourcePath: "src/app/listings/[id]/edit/page.tsx",
    states: [
      state("PRODUCTION.STATE.LISTING-EDITOR.SIGNED-OUT-REDIRECT", "src/app/listings/[id]/edit/page.tsx", "requireListingEditorProfile", [
        "return await requireCurrentUserProfile();",
        'error.message === "auth.unauthorized"',
        "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
      ]),
      state("PRODUCTION.STATE.LISTING-EDITOR.TIER-BLOCKED", "src/app/listings/[id]/edit/page.tsx", "ListingEditPage", [
        "const current = await requireListingEditorProfile(id);",
        'if (!hasTier(current.tier, "pro"))',
        'redirect("/pricing?reason=marketplace-edit");',
      ]),
      state("PRODUCTION.STATE.LISTING-EDITOR.MISSING", "src/app/listings/[id]/edit/page.tsx", "ListingEditPage", [
        "listing = await getOwnedListingForCurrentUser(current, id);",
        'error.message === "listing.not_found"',
        "notFound();",
      ]),
      state("PRODUCTION.STATE.LISTING-EDITOR.SAVING", "src/components/listing-edit-form.tsx", "ListingEditForm", [
        'setStatus("saving");',
        'disabled={status === "saving"}',
        '{status === "saving" ? "Saving…" : "Save changes"}',
      ]),
      state("PRODUCTION.STATE.LISTING-EDITOR.SAVED", "src/components/listing-edit-form.tsx", "ListingEditForm", [
        'setStatus("saved");',
        '{status === "saved" ? (',
      ]),
      state("PRODUCTION.STATE.LISTING-EDITOR.ERROR", "src/components/listing-edit-form.tsx", "ListingEditForm", [
        'setStatus("error");',
        'status === "error"',
        "{feedback}",
      ]),
    ],
  },
  {
    route: "/marketplace/[id]/edit",
    sourcePath: "src/app/marketplace/[id]/edit/page.tsx",
    states: [
      state("PRODUCTION.STATE.MARKETPLACE-EDITOR.SIGNED-OUT-REDIRECT", "src/app/marketplace/[id]/edit/page.tsx", "", [
        "import ListingEditPage, {",
        "export default ListingEditPage;",
      ], [
        assertion("src/app/listings/[id]/edit/page.tsx", "requireListingEditorProfile", [
          "return await requireCurrentUserProfile();",
          'error.message === "auth.unauthorized"',
          "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
        ]),
      ]),
      state("PRODUCTION.STATE.MARKETPLACE-EDITOR.TIER-BLOCKED", "src/app/marketplace/[id]/edit/page.tsx", "", [
        "import ListingEditPage, {",
        "export default ListingEditPage;",
      ], [
        assertion("src/app/listings/[id]/edit/page.tsx", "ListingEditPage", [
          'if (!hasTier(current.tier, "pro"))',
          'redirect("/pricing?reason=marketplace-edit");',
        ]),
      ]),
      state("PRODUCTION.STATE.MARKETPLACE-EDITOR.MISSING", "src/app/marketplace/[id]/edit/page.tsx", "", [
        "import ListingEditPage, {",
        "export default ListingEditPage;",
      ], [
        assertion("src/app/listings/[id]/edit/page.tsx", "ListingEditPage", [
          "listing = await getOwnedListingForCurrentUser(current, id);",
          'error.message === "listing.not_found"',
          "notFound();",
        ]),
      ]),
      state("PRODUCTION.STATE.MARKETPLACE-EDITOR.SAVING", "src/app/marketplace/[id]/edit/page.tsx", "", [
        "import ListingEditPage, {",
        "export default ListingEditPage;",
      ], [
        assertion("src/components/listing-edit-form.tsx", "ListingEditForm", [
          'setStatus("saving");',
          '{status === "saving" ? "Saving…" : "Save changes"}',
        ]),
      ]),
      state("PRODUCTION.STATE.MARKETPLACE-EDITOR.SAVED", "src/app/marketplace/[id]/edit/page.tsx", "", [
        "import ListingEditPage, {",
        "export default ListingEditPage;",
      ], [
        assertion("src/components/listing-edit-form.tsx", "ListingEditForm", [
          'setStatus("saved");',
          '{status === "saved" ? (',
        ]),
      ]),
      state("PRODUCTION.STATE.MARKETPLACE-EDITOR.ERROR", "src/app/marketplace/[id]/edit/page.tsx", "", [
        "import ListingEditPage, {",
        "export default ListingEditPage;",
      ], [
        assertion("src/components/listing-edit-form.tsx", "ListingEditForm", [
          'setStatus("error");',
          'status === "error"',
          "{feedback}",
        ]),
      ]),
    ],
  },
  {
    route: "/account/team",
    sourcePath: "src/app/account/team/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-TEAM.SIGNED-OUT-REDIRECT", "src/app/account/team/page.tsx", "requireTeamProfile", [
        "return await requireCurrentUserProfile();",
        "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-TEAM.EMPTY", "src/app/account/team/page.tsx", "AccountTeamPage", [
        ") : organizations.length > 0 ? (",
        "<EmptyState />",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-TEAM.POPULATED", "src/app/account/team/page.tsx", "AccountTeamPage", [
        ") : organizations.length > 0 ? (",
        "<TeamManagement organizations={organizations} />",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-TEAM.UNAVAILABLE", "src/app/account/team/page.tsx", "AccountTeamPage", [
        "{organizations === null ? (",
        "<UnavailableState />",
      ]),
    ],
  },
  {
    route: "/account/usage",
    sourcePath: "src/app/account/usage/page.tsx",
    states: [
      state("PRODUCTION.STATE.ACCOUNT-USAGE.SIGNED-OUT", "src/app/account/usage/page.tsx", "AccountUsagePage", [
        "{user ? (",
        "<SignedInUsage user={user} />",
        ") : (",
        "<SignedOutUsage />",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-USAGE.EMPTY", "src/app/account/usage/page.tsx", "UsageEventsTable", [
        ") : rows.length === 0 ? (",
        "No usage events yet",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-USAGE.POPULATED", "src/app/account/usage/page.tsx", "UsageEventsTable", [
        ") : rows.length === 0 ? (",
        "rows.map((row, index) => (",
      ]),
      state("PRODUCTION.STATE.ACCOUNT-USAGE.UNAVAILABLE", "src/app/account/usage/page.tsx", "UsageEventsTable", [
        "{rows === null ? (",
        "Usage history is temporarily unavailable",
      ]),
    ],
  },
  {
    route: "/agents",
    sourcePath: "src/app/agents/page.tsx",
    states: [
      state("PRODUCTION.STATE.AGENTS.TIER-GATED", "src/app/agents/page.tsx", "AgentsPage", [
        '<ProGate minTier="pro" feature="Live agent execution">',
      ]),
      state("PRODUCTION.STATE.AGENTS.EMPTY", "src/app/agents/page.tsx", "AgentsPage", [
        "{runs.length === 0 ? (",
        "No agent runs recorded yet.",
      ]),
      state("PRODUCTION.STATE.AGENTS.POPULATED", "src/app/agents/page.tsx", "AgentsPage", [
        "{runs.length === 0 ? (",
        "{runs.map((run) => {",
      ]),
    ],
  },
] as const satisfies readonly MemberStateContract[];
