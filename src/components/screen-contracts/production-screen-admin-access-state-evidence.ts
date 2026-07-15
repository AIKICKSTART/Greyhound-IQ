import type { FamilyScreenManifest, NonEmpty } from "./types";

export const PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ADMIN-ACCESS-STATE-EVIDENCE",
  path: "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts",
} as const satisfies FamilyScreenManifest["tests"][number];

const TEST_IDS = [
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST.id,
] as const;

type SourceAssertion = {
  sourcePath: string;
  orderedText: NonEmpty<string>;
};

type ScreenStateWithEvidence = FamilyScreenManifest["states"][number] & {
  sourceAssertions: NonEmpty<SourceAssertion>;
};

type AdminAccessStateContract = {
  route: string;
  sourcePath: string;
  pageFunction: string;
  guardCall: "requireAdminProfile()" | "requireModeratorProfile()";
  readCall: string;
  permissions: FamilyScreenManifest["permissions"];
  states: NonEmpty<ScreenStateWithEvidence>;
};

const ADMIN_ONLY_PERMISSIONS = [
  {
    actor: "Signed-out visitor viewing protected administration records",
    decision: "deny",
    enforcedBy:
      "The page awaits requireAdminProfile before its first record read; requireAdminProfile delegates to requireCurrentUserProfile, which rejects a missing session.",
    testIds: TEST_IDS,
  },
  {
    actor: "Signed-in non-administrator viewing protected administration records",
    decision: "deny",
    enforcedBy:
      "requireAdminProfile accepts only the exact admin role and throws auth.forbidden before the page reads protected records.",
    testIds: TEST_IDS,
  },
  {
    actor: "Administrator viewing protected administration records",
    decision: "allow",
    enforcedBy:
      "The page awaits requireAdminProfile before its first record read, and the exact admin-role predicate permits the administrator to continue.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const MODERATOR_READ_ONLY_PERMISSIONS = [
  {
    actor: "Signed-out visitor viewing protected moderation records",
    decision: "deny",
    enforcedBy:
      "The page awaits requireModeratorProfile before its first record read; requireModeratorProfile delegates to requireCurrentUserProfile, which rejects a missing session.",
    testIds: TEST_IDS,
  },
  {
    actor: "Signed-in member viewing protected moderation records",
    decision: "deny",
    enforcedBy:
      "requireModeratorProfile accepts only moderator or administrator roles and throws auth.forbidden before the page reads protected records.",
    testIds: TEST_IDS,
  },
  {
    actor: "Moderator viewing protected records without management controls",
    decision: "allow",
    enforcedBy:
      "requireModeratorProfile permits the moderator, while the page's exact admin-role branch replaces mutation controls with the Administrator required label.",
    testIds: TEST_IDS,
  },
  {
    actor: "Administrator viewing and managing protected moderation records",
    decision: "allow",
    enforcedBy:
      "requireModeratorProfile permits the administrator, the exact admin-role branch renders management controls, and the corresponding server mutations independently requireAdminProfile.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const MODERATOR_ACCESS_PERMISSIONS = [
  {
    actor: "Signed-out visitor viewing protected moderation records",
    decision: "deny",
    enforcedBy:
      "The page awaits requireModeratorProfile before its first record read; requireModeratorProfile delegates to requireCurrentUserProfile, which rejects a missing session.",
    testIds: TEST_IDS,
  },
  {
    actor: "Signed-in member viewing protected moderation records",
    decision: "deny",
    enforcedBy:
      "requireModeratorProfile accepts only moderator or administrator roles and throws auth.forbidden before the page reads protected records.",
    testIds: TEST_IDS,
  },
  {
    actor: "Moderator viewing protected moderation records",
    decision: "allow",
    enforcedBy:
      "requireModeratorProfile permits the exact moderator role before the page reads protected records.",
    testIds: TEST_IDS,
  },
  {
    actor: "Administrator viewing protected moderation records",
    decision: "allow",
    enforcedBy:
      "requireModeratorProfile permits the administrator role before the page reads protected records.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const ADMIN_LOADING_ASSERTION = {
  sourcePath: "src/app/admin/loading.tsx",
  orderedText: [
    "export default function AdminLoading()",
    'aria-label="Loading admin control centre"',
    'aria-busy="true"',
    "Loading protected operator data",
  ],
} as const satisfies SourceAssertion;

function state(
  id: string,
  sourcePath: string,
  orderedText: NonEmpty<string>,
  additionalAssertions: readonly SourceAssertion[] = [],
): ScreenStateWithEvidence {
  return {
    id,
    testIds: TEST_IDS,
    sourceAssertions: [
      { sourcePath, orderedText },
      ...additionalAssertions,
    ],
  };
}

function loadingState(id: string, sourcePath: string): ScreenStateWithEvidence {
  return state(id, sourcePath, ["export default async function"], [
    ADMIN_LOADING_ASSERTION,
  ]);
}

type CollectionAccessContractInput = Omit<
  AdminAccessStateContract,
  "permissions" | "states"
> & {
  statePrefix: string;
  empty: NonEmpty<string>;
  populated: NonEmpty<string>;
  permissions?: FamilyScreenManifest["permissions"];
  additionalStates?: readonly ScreenStateWithEvidence[];
};

function collectionAccessContract({
  statePrefix,
  empty,
  populated,
  permissions,
  additionalStates = [],
  ...contract
}: CollectionAccessContractInput): AdminAccessStateContract {
  return {
    ...contract,
    permissions:
      permissions ??
      (contract.guardCall === "requireAdminProfile()"
        ? ADMIN_ONLY_PERMISSIONS
        : MODERATOR_ACCESS_PERMISSIONS),
    states: [
      loadingState(
        `PRODUCTION.STATE.${statePrefix}.LOADING`,
        contract.sourcePath,
      ),
      state(
        `PRODUCTION.STATE.${statePrefix}.EMPTY`,
        contract.sourcePath,
        empty,
      ),
      state(
        `PRODUCTION.STATE.${statePrefix}.POPULATED`,
        contract.sourcePath,
        populated,
      ),
      ...additionalStates,
    ],
  };
}

function configuredAccessContract({
  statePrefix,
  defaultState,
  populated,
  ...contract
}: Omit<CollectionAccessContractInput, "empty" | "additionalStates"> & {
  defaultState: NonEmpty<string>;
}): AdminAccessStateContract {
  return {
    ...contract,
    permissions:
      contract.permissions ??
      (contract.guardCall === "requireAdminProfile()"
        ? ADMIN_ONLY_PERMISSIONS
        : MODERATOR_ACCESS_PERMISSIONS),
    states: [
      loadingState(
        `PRODUCTION.STATE.${statePrefix}.LOADING`,
        contract.sourcePath,
      ),
      state(
        `PRODUCTION.STATE.${statePrefix}.DEFAULT`,
        contract.sourcePath,
        defaultState,
      ),
      state(
        `PRODUCTION.STATE.${statePrefix}.POPULATED`,
        contract.sourcePath,
        populated,
      ),
    ],
  };
}

export const PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS = [
  {
    route: "/admin/billing-events",
    sourcePath: "src/app/admin/billing-events/page.tsx",
    pageFunction: "AdminBillingEventsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getBillingEvents()",
    permissions: ADMIN_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-BILLING-EVENTS.LOADING",
        "src/app/admin/billing-events/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-BILLING-EVENTS.EMPTY",
        "src/app/admin/billing-events/page.tsx",
        ["events.length === 0 ? (", "No billing events found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-BILLING-EVENTS.POPULATED",
        "src/app/admin/billing-events/page.tsx",
        ["events.length === 0 ? (", "events.map((event) => (", "<AdminStatusForm"],
      ),
    ],
  },
  {
    route: "/admin/bug-reports",
    sourcePath: "src/app/admin/bug-reports/page.tsx",
    pageFunction: "AdminBugReportsPage",
    guardCall: "requireModeratorProfile()",
    readCall: "getBugReports(current)",
    permissions: MODERATOR_READ_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-BUG-REPORTS.LOADING",
        "src/app/admin/bug-reports/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-BUG-REPORTS.EMPTY",
        "src/app/admin/bug-reports/page.tsx",
        ["bugReports.length === 0 ? (", "No bug reports found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-BUG-REPORTS.POPULATED",
        "src/app/admin/bug-reports/page.tsx",
        ["bugReports.length === 0 ? (", "bugReports.map((bugReport) => ("],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-BUG-REPORTS.READ-ONLY",
        "src/app/admin/bug-reports/page.tsx",
        [
          'const canManageReports = current.profileRole === "admin";',
          "{canManageReports ? (",
          "<AdminBugReportForm",
          "<AdminRequiredLabel />",
        ],
      ),
    ],
  },
  {
    route: "/admin/entitlements",
    sourcePath: "src/app/admin/entitlements/page.tsx",
    pageFunction: "AdminEntitlementsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getEntitlementSnapshots()",
    permissions: ADMIN_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-ENTITLEMENTS.LOADING",
        "src/app/admin/entitlements/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-ENTITLEMENTS.EMPTY",
        "src/app/admin/entitlements/page.tsx",
        ["snapshots.length === 0 ? (", "No entitlement snapshots found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-ENTITLEMENTS.POPULATED",
        "src/app/admin/entitlements/page.tsx",
        [
          "snapshots.length === 0 ? (",
          "snapshots.map((snapshot) => (",
          "<AdminStatusForm",
        ],
      ),
    ],
  },
  {
    route: "/admin/feedback",
    sourcePath: "src/app/admin/feedback/page.tsx",
    pageFunction: "AdminFeedbackPage",
    guardCall: "requireModeratorProfile()",
    readCall: "getFeedback(current)",
    permissions: MODERATOR_READ_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-FEEDBACK.LOADING",
        "src/app/admin/feedback/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-FEEDBACK.EMPTY",
        "src/app/admin/feedback/page.tsx",
        ["feedback.length === 0 ? (", "No feedback found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-FEEDBACK.POPULATED",
        "src/app/admin/feedback/page.tsx",
        ["feedback.length === 0 ? (", "feedback.map((item) => ("],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-FEEDBACK.READ-ONLY",
        "src/app/admin/feedback/page.tsx",
        [
          'const canManageFeedback = current.profileRole === "admin";',
          "{canManageFeedback ? (",
          "<AdminStatusForm",
          "<AdminRequiredLabel />",
        ],
      ),
    ],
  },
  {
    route: "/admin/invoices",
    sourcePath: "src/app/admin/invoices/page.tsx",
    pageFunction: "AdminInvoicesPage",
    guardCall: "requireAdminProfile()",
    readCall: "getInvoiceRecords()",
    permissions: ADMIN_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-INVOICES.LOADING",
        "src/app/admin/invoices/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-INVOICES.EMPTY",
        "src/app/admin/invoices/page.tsx",
        ["invoices.length === 0 ? (", "No invoice records found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-INVOICES.POPULATED",
        "src/app/admin/invoices/page.tsx",
        ["invoices.length === 0 ? (", "invoices.map((invoice) => (", "<AdminStatusForm"],
      ),
    ],
  },
  {
    route: "/admin/organizations",
    sourcePath: "src/app/admin/organizations/page.tsx",
    pageFunction: "AdminOrganizationsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getOrganizations(current)",
    permissions: ADMIN_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-ORGANIZATIONS.LOADING",
        "src/app/admin/organizations/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-ORGANIZATIONS.EMPTY",
        "src/app/admin/organizations/page.tsx",
        ["organizations.length === 0 ? (", "No organization rows found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-ORGANIZATIONS.POPULATED",
        "src/app/admin/organizations/page.tsx",
        [
          "organizations.length === 0 ? (",
          "organizations.map((organization) => (",
        ],
      ),
    ],
  },
  {
    route: "/admin/subscriptions",
    sourcePath: "src/app/admin/subscriptions/page.tsx",
    pageFunction: "AdminSubscriptionsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getSubscriptions()",
    permissions: ADMIN_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-SUBSCRIPTIONS.LOADING",
        "src/app/admin/subscriptions/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-SUBSCRIPTIONS.EMPTY",
        "src/app/admin/subscriptions/page.tsx",
        ["subscriptions.length === 0 ? (", "No subscriptions found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-SUBSCRIPTIONS.POPULATED",
        "src/app/admin/subscriptions/page.tsx",
        [
          "subscriptions.length === 0 ? (",
          "subscriptions.map((subscription) => (",
          "<AdminStatusForm",
        ],
      ),
    ],
  },
  {
    route: "/admin/webhooks",
    sourcePath: "src/app/admin/webhooks/page.tsx",
    pageFunction: "AdminWebhooksPage",
    guardCall: "requireAdminProfile()",
    readCall: "getWebhookEvents()",
    permissions: ADMIN_ONLY_PERMISSIONS,
    states: [
      loadingState(
        "PRODUCTION.STATE.ADMIN-WEBHOOKS.LOADING",
        "src/app/admin/webhooks/page.tsx",
      ),
      state(
        "PRODUCTION.STATE.ADMIN-WEBHOOKS.EMPTY-STATUSES",
        "src/app/admin/webhooks/page.tsx",
        ["statusCounts.length === 0 ? (", "No statuses"],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-WEBHOOKS.EMPTY-EVENTS",
        "src/app/admin/webhooks/page.tsx",
        ["events.length === 0 ? (", "No webhook events found."],
      ),
      state(
        "PRODUCTION.STATE.ADMIN-WEBHOOKS.POPULATED",
        "src/app/admin/webhooks/page.tsx",
        [
          "statusCounts.map((row) => (",
          "events.length === 0 ? (",
          "events.map((event) => (",
          "<AdminStatusForm",
        ],
      ),
    ],
  },
  collectionAccessContract({
    route: "/admin",
    sourcePath: "src/app/admin/page.tsx",
    pageFunction: "AdminPage",
    guardCall: "requireAdminProfile()",
    readCall: "Promise.all([",
    statePrefix: "ADMIN-DASHBOARD",
    empty: ["reporting.sources.length === 0 ? (", "No sources tracked."],
    populated: [
      "reporting.sources.length === 0 ? (",
      "reporting.sources.map((source) => (",
    ],
  }),
  collectionAccessContract({
    route: "/admin/account-deletion",
    sourcePath: "src/app/admin/account-deletion/page.tsx",
    pageFunction: "AdminAccountDeletionPage",
    guardCall: "requireAdminProfile()",
    readCall: "getPendingDeletionRequests()",
    statePrefix: "ADMIN-ACCOUNT-DELETION",
    empty: [
      "pendingRequests.length === 0 ? (",
      "No pending deletion requests found.",
    ],
    populated: [
      "pendingRequests.length === 0 ? (",
      "pendingRequests.map((user) => (",
    ],
  }),
  collectionAccessContract({
    route: "/admin/actions",
    sourcePath: "src/app/admin/actions/page.tsx",
    pageFunction: "AdminActionsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getAdminActions(current)",
    statePrefix: "ADMIN-ACTIONS",
    empty: ["actions.length === 0 ? (", "No admin actions found."],
    populated: ["actions.length === 0 ? (", "actions.map((action) => ("],
  }),
  collectionAccessContract({
    route: "/admin/audit",
    sourcePath: "src/app/admin/audit/page.tsx",
    pageFunction: "AdminAuditLogPage",
    guardCall: "requireAdminProfile()",
    readCall: "getAuditLogs()",
    statePrefix: "ADMIN-AUDIT",
    empty: ["auditLogs.length === 0 ? (", "No audit log rows found."],
    populated: ["auditLogs.length === 0 ? (", "auditLogs.map((log) => ("],
  }),
  collectionAccessContract({
    route: "/admin/bespoke",
    sourcePath: "src/app/admin/bespoke/page.tsx",
    pageFunction: "BespokeAdmin",
    guardCall: "requireModeratorProfile()",
    readCall: "listCustomDesignRequests(current)",
    statePrefix: "ADMIN-BESPOKE",
    empty: ["requests.length === 0 && (", "No requests yet."],
    populated: ["requests.length === 0 && (", "requests.map((r) => ("],
  }),
  collectionAccessContract({
    route: "/admin/billing",
    sourcePath: "src/app/admin/billing/page.tsx",
    pageFunction: "AdminBillingPage",
    guardCall: "requireAdminProfile()",
    readCall: "getBillingCustomers()",
    statePrefix: "ADMIN-BILLING",
    empty: ["customers.length === 0 ? (", "No billing customers found."],
    populated: [
      "customers.length === 0 ? (",
      "customers.map((customer) => (",
    ],
  }),
  collectionAccessContract({
    route: "/admin/compliance",
    sourcePath: "src/app/admin/compliance/page.tsx",
    pageFunction: "AdminCompliancePage",
    guardCall: "requireAdminProfile()",
    readCall: "getComplianceData(current)",
    statePrefix: "ADMIN-COMPLIANCE",
    empty: ["rows.length === 0 ? (", "{emptyLabel}"],
    populated: ["rows.length === 0 ? (", "rows.map((row) => ("],
  }),
  collectionAccessContract({
    route: "/admin/dog-ownership",
    sourcePath: "src/app/admin/dog-ownership/page.tsx",
    pageFunction: "AdminDogOwnershipPage",
    guardCall: "requireModeratorProfile()",
    readCall: "getPendingClaims()",
    statePrefix: "ADMIN-DOG-OWNERSHIP",
    empty: ["claims.length === 0 ? (", "No pending claims."],
    populated: ["claims.length === 0 ? (", "claims.map((claim) => ("],
  }),
  collectionAccessContract({
    route: "/admin/exports",
    sourcePath: "src/app/admin/exports/page.tsx",
    pageFunction: "AdminExportsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getExportArtifacts(current)",
    statePrefix: "ADMIN-EXPORTS",
    empty: ["artifacts.length === 0 ? (", "No export artifacts found."],
    populated: [
      "artifacts.length === 0 ? (",
      "artifacts.map((artifact) => (",
    ],
  }),
  collectionAccessContract({
    route: "/admin/feed",
    sourcePath: "src/app/admin/feed/page.tsx",
    pageFunction: "AdminFeedPage",
    guardCall: "requireModeratorProfile()",
    readCall: "getFeedAdminTopics()",
    statePrefix: "ADMIN-FEED",
    empty: ["topics.length === 0 ? (", "No topics yet."],
    populated: ["topics.length === 0 ? (", "topics.map((topic) => ("],
  }),
  collectionAccessContract({
    route: "/admin/invitations",
    sourcePath: "src/app/admin/invitations/page.tsx",
    pageFunction: "AdminOrganizationInvitationsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getOrganizationInvitations(current)",
    statePrefix: "ADMIN-INVITATIONS",
    empty: [
      "invitations.length === 0 ? (",
      "No organization invitations found.",
    ],
    populated: [
      "invitations.length === 0 ? (",
      "invitations.map((invitation) => (",
    ],
  }),
  collectionAccessContract({
    route: "/admin/jobs",
    sourcePath: "src/app/admin/jobs/page.tsx",
    pageFunction: "AdminJobsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getJobStatusSummaries()",
    statePrefix: "ADMIN-JOBS",
    empty: ["rows.length === 0 ? (", "No local operational rows found."],
    populated: ["rows.length === 0 ? (", "rows.map((row, index) => ("],
  }),
  collectionAccessContract({
    route: "/admin/listings",
    sourcePath: "src/app/admin/listings/page.tsx",
    pageFunction: "AdminListingsPage",
    guardCall: "requireModeratorProfile()",
    readCall: "getPendingListings()",
    statePrefix: "ADMIN-LISTINGS",
    empty: [
      "listings.length === 0 ? (",
      'No {mode === "pending" ? "pending" : "recent"} marketplace items found.',
    ],
    populated: [
      "listings.length === 0 ? (",
      "listings.map((listing) => (",
    ],
  }),
  configuredAccessContract({
    route: "/admin/page-rules",
    sourcePath: "src/app/admin/page-rules/page.tsx",
    pageFunction: "PageRulesAdmin",
    guardCall: "requireAdminProfile()",
    readCall: "getAllPlatformFlags()",
    statePrefix: "ADMIN-PAGE-RULES",
    defaultState: [
      "const flags = await getAllPlatformFlags();",
      "<form action={updatePageRulesAction}",
    ],
    populated: ["<form action={updatePageRulesAction}", "RULES.map((rule) => ("],
  }),
  collectionAccessContract({
    route: "/admin/payments",
    sourcePath: "src/app/admin/payments/page.tsx",
    pageFunction: "AdminPaymentsPage",
    guardCall: "requireAdminProfile()",
    readCall: "getPaymentRecords()",
    statePrefix: "ADMIN-PAYMENTS",
    empty: ["records.length === 0 ? (", "No payment records found."],
    populated: ["records.length === 0 ? (", "records.map((record) => ("],
  }),
  collectionAccessContract({
    route: "/admin/plans",
    sourcePath: "src/app/admin/plans/page.tsx",
    pageFunction: "AdminPlansPage",
    guardCall: "requireAdminProfile()",
    readCall: "getPlans()",
    statePrefix: "ADMIN-PLANS",
    empty: ["plans.length === 0 ? (", "No plans found."],
    populated: ["plans.length === 0 ? (", "plans.map((plan) => ("],
  }),
  collectionAccessContract({
    route: "/admin/reports",
    sourcePath: "src/app/admin/reports/page.tsx",
    pageFunction: "AdminReportsPage",
    guardCall: "requireModeratorProfile()",
    readCall: "getReports()",
    statePrefix: "ADMIN-REPORTS",
    empty: [
      "reports.length === 0 ? (",
      "No reports are waiting for review.",
    ],
    populated: ["reports.length === 0 ? (", "reports.map((report) => ("],
  }),
  collectionAccessContract({
    route: "/admin/retention",
    sourcePath: "src/app/admin/retention/page.tsx",
    pageFunction: "AdminRetentionPage",
    guardCall: "requireAdminProfile()",
    readCall: "getRetentionPolicies(current)",
    statePrefix: "ADMIN-RETENTION",
    empty: ["policies.length === 0 ? (", "No retention policies found."],
    populated: [
      "policies.length === 0 ? (",
      "policies.map((policy) => (",
    ],
  }),
  collectionAccessContract({
    route: "/admin/safety",
    sourcePath: "src/app/admin/safety/page.tsx",
    pageFunction: "AdminSafetyPage",
    guardCall: "requireModeratorProfile()",
    readCall: "listBannedPhrasesForModerator()",
    statePrefix: "ADMIN-SAFETY",
    empty: [
      "phrases.length === 0 ? (",
      "No content rules configured",
    ],
    populated: ["phrases.length === 0 ? (", "phrases.map((phrase) => ("],
  }),
  configuredAccessContract({
    route: "/admin/site-content",
    sourcePath: "src/app/admin/site-content/page.tsx",
    pageFunction: "SiteContentAdmin",
    guardCall: "requireAdminProfile()",
    readCall: "getPricingContent()",
    statePrefix: "ADMIN-SITE-CONTENT",
    defaultState: [
      "const { plans, yearlyNote } = await getPricingContent();",
      "<form action={updatePricingContentAction}",
    ],
    populated: [
      "<form action={updatePricingContentAction}",
      "plans.map((plan) => (",
    ],
  }),
  collectionAccessContract({
    route: "/admin/source-health",
    sourcePath: "src/app/admin/source-health/page.tsx",
    pageFunction: "AdminSourceHealthPage",
    guardCall: "requireAdminProfile()",
    readCall: "getLiveFeedStatus()",
    statePrefix: "ADMIN-SOURCE-HEALTH",
    empty: ["rows.length === 0 ? (", "No data source health rows found."],
    populated: ["rows.length === 0 ? (", "rows.map((row) => ("],
  }),
  collectionAccessContract({
    route: "/admin/support",
    sourcePath: "src/app/admin/support/page.tsx",
    pageFunction: "AdminSupportPage",
    guardCall: "requireModeratorProfile()",
    readCall: "getSupportTicketCounts(current)",
    statePrefix: "ADMIN-SUPPORT",
    permissions: MODERATOR_READ_ONLY_PERMISSIONS,
    empty: ["tickets.length === 0 ? (", "No support tickets found."],
    populated: ["tickets.length === 0 ? (", "tickets.map((ticket) => ("],
    additionalStates: [
      state(
        "PRODUCTION.STATE.ADMIN-SUPPORT.READ-ONLY",
        "src/app/admin/support/page.tsx",
        [
          'const canManageTickets = current.profileRole === "admin";',
          "{canManageTickets ? (",
          "<AdminSupportTicketForm",
          "<AdminRequiredLabel />",
        ],
      ),
    ],
  }),
  collectionAccessContract({
    route: "/admin/usage",
    sourcePath: "src/app/admin/usage/page.tsx",
    pageFunction: "AdminUsagePage",
    guardCall: "requireAdminProfile()",
    readCall: "getUsageEvents()",
    statePrefix: "ADMIN-USAGE",
    empty: ["rows.length === 0 ? (", "No usage aggregates found."],
    populated: ["rows.length === 0 ? (", "rows.map((row) => ("],
  }),
  collectionAccessContract({
    route: "/admin/users",
    sourcePath: "src/app/admin/users/page.tsx",
    pageFunction: "AdminUsersPage",
    guardCall: "requireAdminProfile()",
    readCall: "getUsers(query)",
    statePrefix: "ADMIN-USERS",
    empty: [
      "result.users.length === 0 ? (",
      "No users match this search and filter combination.",
    ],
    populated: [
      "result.users.length === 0 ? (",
      "result.users.map((user) => (",
    ],
  }),
] as const satisfies readonly AdminAccessStateContract[];
