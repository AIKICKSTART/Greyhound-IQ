export type AdminRequiredRole = "moderator" | "admin";

export type AdminAuthorizationSurface = {
  kind: "page" | "server-action" | "route-handler";
  id: string;
  sourceFile: string;
  requiredRole: AdminRequiredRole;
};

export type AdminAuthorizationObservation = Omit<
  AdminAuthorizationSurface,
  "requiredRole"
> & {
  requiredRole: AdminRequiredRole | "unguarded";
};

const page = (
  route: string,
  requiredRole: AdminRequiredRole
): AdminAuthorizationSurface => ({
  kind: "page",
  id: route,
  sourceFile:
    route === "/admin"
      ? "src/app/admin/page.tsx"
      : `src/app${route}/page.tsx`,
  requiredRole,
});

const action = (
  id: string,
  sourceFile: string,
  requiredRole: AdminRequiredRole
): AdminAuthorizationSurface => ({
  kind: "server-action",
  id,
  sourceFile,
  requiredRole,
});

export const ADMIN_AUTHORIZATION_INVENTORY = {
  runtimeDenial: {
    status: "unverified",
    reason:
      "No request-level test exercises every surface with signed-out, member, moderator, and administrator identities.",
  },
  pages: [
    page("/admin", "admin"),
    page("/admin/users", "admin"),
    page("/admin/organizations", "admin"),
    page("/admin/invitations", "admin"),
    page("/admin/account-deletion", "admin"),
    page("/admin/plans", "admin"),
    page("/admin/subscriptions", "admin"),
    page("/admin/entitlements", "admin"),
    page("/admin/invoices", "admin"),
    page("/admin/payments", "admin"),
    page("/admin/billing", "admin"),
    page("/admin/billing-events", "admin"),
    page("/admin/compliance", "admin"),
    page("/admin/retention", "admin"),
    page("/admin/exports", "admin"),
    page("/admin/audit", "admin"),
    page("/admin/actions", "admin"),
    page("/admin/jobs", "admin"),
    page("/admin/webhooks", "admin"),
    page("/admin/usage", "admin"),
    page("/admin/source-health", "admin"),
    page("/admin/page-rules", "admin"),
    page("/admin/site-content", "admin"),
    page("/admin/reports", "moderator"),
    page("/admin/dog-ownership", "moderator"),
    page("/admin/safety", "moderator"),
    page("/admin/listings", "moderator"),
    page("/admin/feed", "moderator"),
    page("/admin/support", "moderator"),
    page("/admin/feedback", "moderator"),
    page("/admin/bug-reports", "moderator"),
    page("/admin/bespoke", "moderator"),
  ],
  serverActions: [
    action(
      "lookupAdminUserAction",
      "src/app/admin/users/actions.ts",
      "admin",
    ),
    ...[
      "updateAdminStatus",
      "createAdminUserAction",
      "updateAdminUserAccessAction",
      "upsertAdminPlanAction",
      "createAdminPriceAction",
      "upsertAdminEntitlementAction",
      "upsertAdminRetentionPolicyAction",
      "createAdminDeletionJobAction",
      "upsertAdminOrganizationAction",
      "createAdminInvitationAction",
      "createAdminExportAction",
      "upsertAdminSourceHealthAction",
      "updateAdminSupportTicketAction",
      "updateAdminBugReportAction",
      "updatePageRulesAction",
      "updatePricingContentAction",
    ].map((id) => action(id, "src/app/admin/mutations.ts", "admin")),
    ...[
      "approveDogOwnershipAction",
      "rejectDogOwnershipAction",
      "approveTrainerClaimAction",
      "rejectTrainerClaimAction",
      "updateBespokeRequestAction",
    ].map((id) => action(id, "src/app/admin/mutations.ts", "moderator")),
    ...[
      "createFeedTopic",
      "setFeedTopicActive",
      "moderateFeedPost",
      "approveListing",
      "rejectListing",
      "removeListing",
      "createMarketplaceCategory",
      "setMarketplaceCategoryActive",
      "resolveReport",
      "createBannedPhrase",
      "setBannedPhraseActive",
      "resolveTrustSafetyFlag",
    ].map((id) => action(id, "src/app/actions.ts", "moderator")),
  ],
  routeHandlers: [
    {
      kind: "route-handler",
      id: "POST /api/reports/[id]/resolve",
      sourceFile: "src/app/api/reports/[id]/resolve/route.ts",
      requiredRole: "moderator",
    },
  ],
  controls: [
    {
      id: "moderator-peer-ban-policy",
      status: "tested",
      decision: "deny",
      currentBehavior:
        "Report bans allow moderators to target only member, breeder, or trainer roles. Self, moderator, administrator, missing, and unrecognized target roles are denied; administrators retain authority subject to self-lockout and last-administrator controls.",
      evidence: [
        "src/lib/admin-access-contract.ts",
        "src/lib/report-ban-policy.test.ts",
      ],
      limitation:
        "The policy and report-service wiring are source-tested; request-level runtime denial is not yet proven.",
    },
  ],
  blockers: [
    {
      id: "last-admin-self-lockout-db-concurrency",
      status: "blocked",
      decision: "evidence-missing",
      currentBehavior:
        "Pure policy tests and source wiring exist; PostgreSQL transaction and concurrency behavior is unverified.",
      requiredEvidence:
        "A local or staging PostgreSQL test covering simultaneous demotion, ban, and account-deletion attempts.",
    },
  ],
} as const;

export function assertAdminAuthorizationInventory(
  discovered: readonly AdminAuthorizationObservation[]
) {
  const expected: readonly AdminAuthorizationSurface[] = [
    ...ADMIN_AUTHORIZATION_INVENTORY.pages,
    ...ADMIN_AUTHORIZATION_INVENTORY.serverActions,
    ...ADMIN_AUTHORIZATION_INVENTORY.routeHandlers,
  ];
  const issues: string[] = [];
  const expectedById = indexSurfaces(expected, "registered", issues);
  const discoveredById = indexSurfaces(discovered, "discovered", issues);

  for (const [id, registered] of expectedById) {
    const observed = discoveredById.get(id);
    if (!observed) {
      issues.push(`missing surface: ${id}`);
      continue;
    }
    if (
      observed.sourceFile !== registered.sourceFile ||
      observed.requiredRole !== registered.requiredRole
    ) {
      issues.push(
        `surface mismatch: ${id} expected ${registered.requiredRole} in ${registered.sourceFile}, found ${observed.requiredRole} in ${observed.sourceFile}`
      );
    }
  }

  for (const id of discoveredById.keys()) {
    if (!expectedById.has(id)) issues.push(`unregistered surface: ${id}`);
  }

  if (issues.length > 0) {
    throw new Error(`admin.authorization_inventory_invalid\n${issues.join("\n")}`);
  }
}

function indexSurfaces(
  surfaces: readonly AdminAuthorizationObservation[],
  label: string,
  issues: string[]
) {
  const indexed = new Map<string, AdminAuthorizationObservation>();
  for (const surface of surfaces) {
    const id = `${surface.kind}:${surface.id}`;
    if (indexed.has(id)) issues.push(`duplicate ${label} surface: ${id}`);
    indexed.set(id, surface);
  }
  return indexed;
}
