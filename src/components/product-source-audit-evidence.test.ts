import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { API_SURFACE_INVENTORY } from "../../security/api-surface-inventory";
import { APPLICATION_SURFACE_INVENTORY } from "../../security/application-surface-inventory";
import { discoverRouteHandlers } from "../../security/endpoints";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import {
  PRODUCT_ROUTE_CAPABILITY_SOURCE_AUDIT_SCOPE,
  PRODUCT_ROUTE_CAPABILITY_SOURCE_EVIDENCE_RECORDS,
  PRODUCT_ROUTE_CAPABILITY_SOURCE_MASTER_EVIDENCE,
  PRODUCT_ROUTE_CAPABILITY_SOURCE_REQUIREMENT_IDS,
  PRODUCT_SOURCE_AUDIT_MASTER_EVIDENCE,
  PRODUCT_SOURCE_AUDIT_REQUIREMENT_IDS,
  PRODUCT_SOURCE_AUDIT_SCOPE,
  type ProductRouteCapabilitySourceEvidenceRecord,
} from "./product-source-audit-evidence";

const repositoryRoot = path.resolve(__dirname, "../..");
const sourceRoot = path.join(repositoryRoot, "src");
const appRoot = path.join(repositoryRoot, "src", "app");
const expectedRequirementIds = [
  "DISC.SRC.api-handlers",
  "DISC.SRC.api-redirects",
  "DISC.SRC.auth-redirects",
  "DISC.SRC.authentication-flows",
  "DISC.SRC.automated-tests",
  "DISC.SRC.billing-flows",
  "DISC.SRC.billing-return-routes",
  "DISC.SRC.database-models",
  "DISC.SRC.design-lab-fixtures",
  "DISC.SRC.dynamic-routes",
  "DISC.SRC.feature-flagged-routes",
  "DISC.SRC.feature-flags",
  "DISC.SRC.layouts",
  "DISC.SRC.nested-layouts",
  "DISC.SRC.parallel-routes",
  "DISC.SRC.route-groups",
] as const;

const expectedCommunityRouteCapabilityRequirementIds = [
  "ROUTE.COMMUNITY.block",
  "ROUTE.COMMUNITY.comment",
  "ROUTE.COMMUNITY.comment-delete",
  "ROUTE.COMMUNITY.comment-edit",
  "ROUTE.COMMUNITY.conversation-continue",
  "ROUTE.COMMUNITY.conversation-search",
  "ROUTE.COMMUNITY.conversation-start",
  "ROUTE.COMMUNITY.delivery-state",
  "ROUTE.COMMUNITY.follow",
  "ROUTE.COMMUNITY.friend-accept",
  "ROUTE.COMMUNITY.friend-decline",
  "ROUTE.COMMUNITY.friend-send",
  "ROUTE.COMMUNITY.like",
  "ROUTE.COMMUNITY.message-delete",
  "ROUTE.COMMUNITY.message-failed",
  "ROUTE.COMMUNITY.message-react",
  "ROUTE.COMMUNITY.message-reply",
  "ROUTE.COMMUNITY.post-create",
  "ROUTE.COMMUNITY.post-delete",
  "ROUTE.COMMUNITY.post-edit",
  "ROUTE.COMMUNITY.post-media",
  "ROUTE.COMMUNITY.public-profile",
  "ROUTE.COMMUNITY.react",
  "ROUTE.COMMUNITY.read-state",
  "ROUTE.COMMUNITY.report",
  "ROUTE.COMMUNITY.save",
  "ROUTE.COMMUNITY.search-businesses",
  "ROUTE.COMMUNITY.search-greyhounds",
  "ROUTE.COMMUNITY.search-pages",
  "ROUTE.COMMUNITY.search-people",
  "ROUTE.COMMUNITY.send-audio",
  "ROUTE.COMMUNITY.send-document",
  "ROUTE.COMMUNITY.send-image",
  "ROUTE.COMMUNITY.send-text",
  "ROUTE.COMMUNITY.send-video",
  "ROUTE.COMMUNITY.share",
  "ROUTE.COMMUNITY.thread-create",
  "ROUTE.COMMUNITY.thread-reply",
  "ROUTE.COMMUNITY.unblock",
  "ROUTE.COMMUNITY.unfollow",
  "ROUTE.COMMUNITY.unlike",
  "ROUTE.COMMUNITY.unsave",
  "ROUTE.COMMUNITY.upload-recovery",
  "ROUTE.COMMUNITY.upload-retry",
  "ROUTE.COMMUNITY.video-start",
  "ROUTE.COMMUNITY.voice-start",
] as const;

const expectedMarketplaceRouteCapabilityRequirementIds = [
  "ROUTE.MARKET.carousel",
  "ROUTE.MARKET.delete",
  "ROUTE.MARKET.enquire",
  "ROUTE.MARKET.enquiries-route",
  "ROUTE.MARKET.explicit-status",
  "ROUTE.MARKET.filter",
  "ROUTE.MARKET.illustrative-disclosure",
  "ROUTE.MARKET.inventory-separation",
  "ROUTE.MARKET.manage-route",
  "ROUTE.MARKET.mark-unavailable",
  "ROUTE.MARKET.media-disclosure",
  "ROUTE.MARKET.media-route",
  "ROUTE.MARKET.ownership-evidence",
  "ROUTE.MARKET.ownership-route",
  "ROUTE.MARKET.publish",
  "ROUTE.MARKET.remove-media",
  "ROUTE.MARKET.report",
  "ROUTE.MARKET.save",
  "ROUTE.MARKET.save-feedback",
  "ROUTE.MARKET.search",
  "ROUTE.MARKET.unavailable-route",
  "ROUTE.MARKET.unpublish",
  "ROUTE.MARKET.unsave",
  "ROUTE.MARKET.upload-images",
  "ROUTE.MARKET.upload-recovery",
  "ROUTE.MARKET.upload-video",
  "ROUTE.MARKET.verification-route",
] as const;

const expectedAdministrationRouteCapabilityRequirementIds = [
  "ROUTE.ADMIN.danger-confirm",
  "ROUTE.ADMIN.preserve-queue",
  "ROUTE.ADMIN.required-reason",
  "ROUTE.ADMIN.self-lockout",
  "ROUTE.ADMIN.webhook-idempotency",
] as const;

const expectedAccountRouteCapabilityRequirementIds = [
  "ROUTE.ACCOUNT.account-delete",
  "ROUTE.ACCOUNT.appearance",
  "ROUTE.ACCOUNT.billing-cancel",
  "ROUTE.ACCOUNT.billing-intent",
  "ROUTE.ACCOUNT.billing-return",
  "ROUTE.ACCOUNT.checkout",
  "ROUTE.ACCOUNT.data-export",
  "ROUTE.ACCOUNT.export-delete-status",
  "ROUTE.ACCOUNT.invoices",
  "ROUTE.ACCOUNT.no-query-payment-proof",
  "ROUTE.ACCOUNT.notification-scope",
  "ROUTE.ACCOUNT.onboarding-management",
  "ROUTE.ACCOUNT.page-create",
  "ROUTE.ACCOUNT.page-delete",
  "ROUTE.ACCOUNT.page-edit",
  "ROUTE.ACCOUNT.payment-failure",
  "ROUTE.ACCOUNT.restart-reset-tour",
  "ROUTE.ACCOUNT.safe-auth-return",
] as const;

const expectedRacingRouteCapabilityRequirementIds = [
  "ROUTE.RACING.date-navigation",
  "ROUTE.RACING.delayed-records",
  "ROUTE.RACING.filter-live",
  "ROUTE.RACING.filter-replay",
  "ROUTE.RACING.filter-resulted",
  "ROUTE.RACING.filter-upcoming",
  "ROUTE.RACING.meaningful-result",
  "ROUTE.RACING.mobile-tables",
  "ROUTE.RACING.open-dog",
  "ROUTE.RACING.open-race",
  "ROUTE.RACING.open-replay",
  "ROUTE.RACING.open-track",
  "ROUTE.RACING.row-a11y",
  "ROUTE.RACING.safe-missing",
  "ROUTE.RACING.search-date",
  "ROUTE.RACING.search-distance",
  "ROUTE.RACING.search-dog",
  "ROUTE.RACING.search-grade",
  "ROUTE.RACING.search-race",
  "ROUTE.RACING.search-state",
  "ROUTE.RACING.search-status",
  "ROUTE.RACING.search-track",
  "ROUTE.RACING.sort-relevance",
  "ROUTE.RACING.sort-time",
  "ROUTE.RACING.source-completeness",
  "ROUTE.RACING.validate-id",
] as const;

const expectedRouteCapabilityRequirementIds = [
  ...expectedAccountRouteCapabilityRequirementIds,
  ...expectedAdministrationRouteCapabilityRequirementIds,
  ...expectedCommunityRouteCapabilityRequirementIds,
  ...expectedMarketplaceRouteCapabilityRequirementIds,
  ...expectedRacingRouteCapabilityRequirementIds,
].toSorted();

const FEATURE_FLAG_ENVIRONMENT_VARIABLES = [
  "ACTOR_CONVERSATION_MULTIPLEX_ENABLED",
  "AI_DISABLED",
  "ALLOW_COMMUNITY_WRITE_PROBE",
  "APP_ENV",
  "DEMO_AUTH_MODE",
  "DEMO_FIXTURE_QUERY_EVIDENCE_MODE",
  "ENABLE_DEMO_LISTING_MEDIA",
  "ENABLE_DEVICE_PREVIEWS",
  "EXPORT_DISABLED",
  "FASTTRACK_PROTOTYPE_ENABLED",
  "LIVE_SYNC_DEBUG",
  "LIVE_SYNC_INSERT_ONLY",
  "MEDIA_SCAN_MODE",
  "NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT",
  "NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA",
  "NEXT_PUBLIC_USE_SUPABASE_SITE_ASSETS",
  "REALTIME_BROADCAST_DISABLED",
  "REALTIME_BROADCAST_STRICT",
  "SEARCH_DISABLED",
  "THEDOGS_PROVIDER_ENABLED",
  "UPLOAD_DISABLED",
  "USE_SUPABASE_SITE_ASSETS",
  "WATCHDOG_PROVIDER_ENABLED",
] as const;

const INVENTORY_SNAPSHOTS = {
  databaseModels: {
    count: 113,
    sha256: "d93cb59fd5a9b30b7997232151a00c5d7b21a9230a0e18ab99f50f82892ce4d9",
  },
  sourceEnvironmentReferences: {
    count: 130,
    sha256: "e864655d87187326fa206d59e63c48fa759603cead48e98131a8d8a7984df6e1",
  },
  featureFlagReferences: {
    count: 28,
    sha256: "e85f61c6d6bee0bde4eea554db0ae26ec29a619585f570835fce9580baca4c2d",
  },
  authenticationFlowMembers: {
    count: 205,
    sha256: "2098baee6913ae2ef5e7abbcf6ce470cc480f602e439286bd32220d8b92b799a",
  },
  billingSourceMembers: {
    count: 35,
    sha256: "9bb887b72af9ea117867ecb2b2fb5381124dc8c125593ab3f045e6690192d769",
  },
  apiRedirects: {
    count: 12,
    sha256: "a43851223e27b4135fe7203bbf205676921fb50fe0512042542869297d1fe6c9",
  },
  authenticationRedirects: {
    count: 14,
    sha256: "6fc5b28038206966a18a7abc06647138f4bcaa7d78031e9d17c3b2961e15d598",
  },
  featureFlaggedRoutes: {
    count: 6,
    sha256: "6aaaff253c23426966a4ea4ebdcd38db66ca740c9c127d30724ae494df5e6b61",
  },
  routeCapabilitySources: {
    count: 122,
    sha256: "f31f6547f09e0767a319d8bc9dd4f2b214315749b05755938b2c143b14f86e14",
  },
} as const;

assert.deepEqual(PRODUCT_SOURCE_AUDIT_REQUIREMENT_IDS, [
  ...expectedRequirementIds,
]);
assert.match(PRODUCT_SOURCE_AUDIT_SCOPE, /Source-static/);
assert.match(PRODUCT_SOURCE_AUDIT_SCOPE, /runtime behaviour/);
assert.deepEqual(PRODUCT_ROUTE_CAPABILITY_SOURCE_REQUIREMENT_IDS, [
  ...expectedRouteCapabilityRequirementIds,
]);
assert.match(PRODUCT_ROUTE_CAPABILITY_SOURCE_AUDIT_SCOPE, /Source-static/);
assert.match(PRODUCT_ROUTE_CAPABILITY_SOURCE_AUDIT_SCOPE, /runtime/);

for (const requirementId of expectedRouteCapabilityRequirementIds) {
  const evidence = PRODUCT_ROUTE_CAPABILITY_SOURCE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested");
  assert.ok(evidence.evidence.length >= 4);
  for (const evidencePath of evidence.evidence) {
    assert.ok(
      existsSync(evidencePath),
      `${requirementId}: missing ${evidencePath}`,
    );
  }

  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "product" && candidate.id === requirementId,
  );
  assert.ok(
    requirement,
    `${requirementId} must remain in the product registry`,
  );
  assert.equal(
    requirement.section,
    requirementId.startsWith("ROUTE.ADMIN.")
      ? "routes.administration"
      : requirementId.startsWith("ROUTE.ACCOUNT.")
        ? "routes.account"
        : requirementId.startsWith("ROUTE.RACING.")
          ? "routes.racing"
          : requirementId.startsWith("ROUTE.MARKET.")
            ? "routes.marketplace"
            : "routes.community",
  );
}

for (const requirementId of expectedRequirementIds) {
  const evidence = PRODUCT_SOURCE_AUDIT_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested");
  assert.ok(evidence.evidence.length >= 2);
  for (const evidencePath of evidence.evidence) {
    assert.ok(
      existsSync(evidencePath),
      `${requirementId}: missing ${evidencePath}`,
    );
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], evidence);

  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "product" && candidate.id === requirementId,
  );
  assert.ok(
    requirement,
    `${requirementId} must remain in the product registry`,
  );
  assert.equal(requirement.status, "tested");
  assert.equal(isMasterRequirementComplete(requirement), true);
}

const appDirectories = walkDirectories(appRoot);
const appFiles = walkFiles(appRoot);
const routeGroups = appDirectories.filter(isRouteGroup);
const parallelRoutes = appDirectories.filter(isParallelRoute);
const dynamicRouteDirectories = appDirectories.filter(isDynamicRoute);
const layouts = appFiles.filter((file) => path.basename(file) === "layout.tsx");
const rootLayout = path.join(appRoot, "layout.tsx");
const nestedLayouts = layouts.filter((file) => file !== rootLayout);

assert.equal(isRouteGroup(path.join(appRoot, "(member)")), true);
assert.equal(isParallelRoute(path.join(appRoot, "@modal")), true);
assert.equal(isDynamicRoute(path.join(appRoot, "[id]")), true);
assert.equal(isDynamicRoute(path.join(appRoot, "[[...slug]]")), true);
assert.equal(isDynamicRoute(path.join(appRoot, "dogs")), false);

assert.ok(layouts.includes(rootLayout));
assert.ok(nestedLayouts.includes(path.join(appRoot, "admin", "layout.tsx")));
for (const layout of layouts) {
  assert.match(readFileSync(layout, "utf8"), /export\s+default/);
}
for (const directory of [...routeGroups, ...parallelRoutes]) {
  assert.ok(
    readdirSync(directory).length > 0,
    `${repoPath(directory)} is empty`,
  );
}
for (const directory of dynamicRouteDirectories) {
  assert.match(
    path.basename(directory),
    /^\[{1,2}(?:\.\.\.)?[A-Za-z][A-Za-z0-9_-]*\]{1,2}$/,
    `${repoPath(directory)} has an unsupported dynamic segment`,
  );
}
assert.ok(dynamicRouteDirectories.length > 0);

const discoveredRouteFiles = [
  ...new Set(
    discoverRouteHandlers(repositoryRoot).map((handler) => handler.sourceFile),
  ),
].toSorted();
const sourceRouteFiles = appFiles
  .filter((file) => path.basename(file) === "route.ts")
  .map(repoPath)
  .toSorted();
assertRouteHandlerCoverage(sourceRouteFiles, discoveredRouteFiles);
assert.throws(() =>
  assertRouteHandlerCoverage(
    [...sourceRouteFiles, "src/app/api/unregistered/route.ts"],
    discoveredRouteFiles,
  ),
);

const testFiles = ["src", "scripts", "security"]
  .flatMap((directory) => walkFiles(path.join(repositoryRoot, directory)))
  .filter((file) => /\.test\.(?:[cm]?[jt]sx?)$/.test(file));
assert.ok(testFiles.length > 0);
for (const testFile of testFiles) {
  assert.ok(
    readFileSync(testFile, "utf8").trim().length > 0,
    `${repoPath(testFile)} is empty`,
  );
}
for (const sentinel of [
  "security/registry.test.ts",
  "src/app/api/health/ready/route.test.ts",
  "src/components/product-route-tree-evidence.test.ts",
]) {
  assert.ok(
    testFiles.map(repoPath).includes(sentinel),
    `${sentinel} is missing`,
  );
}

assertFixtureInventory(
  SCREEN_CONTRACTS.map((screen) => ({
    route: screen.route,
    fixtureIds: screen.designLabFixtureIds,
  })),
);
assert.throws(() =>
  assertFixtureInventory([{ route: "/missing-fixture", fixtureIds: [] }]),
);

const fixtureIds = SCREEN_CONTRACTS.flatMap(
  (screen) => screen.designLabFixtureIds,
);

const productSourceFiles = walkFiles(sourceRoot).filter(isProductSourceFile);
const prismaSchema = readFileSync(
  path.join(repositoryRoot, "prisma", "schema.prisma"),
  "utf8",
);
const databaseModels = [
  ...prismaSchema.matchAll(/^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm),
]
  .map((match) => match[1])
  .toSorted();
assert.equal(
  databaseModels.length,
  [...prismaSchema.matchAll(/^\s*model\b/gm)].length,
  "every Prisma model declaration must be parsed",
);
assert.equal(
  new Set(databaseModels).size,
  databaseModels.length,
  "Prisma model names must remain unique",
);
assertInventorySnapshot(
  "Prisma model declarations",
  databaseModels,
  INVENTORY_SNAPSHOTS.databaseModels,
);

const sourceEnvironmentReferences = uniqueSorted(
  productSourceFiles.flatMap(collectProcessEnvironmentReferences),
);
assertInventorySnapshot(
  "source environment references",
  sourceEnvironmentReferences,
  INVENTORY_SNAPSHOTS.sourceEnvironmentReferences,
);
const featureFlagNames = new Set<string>(FEATURE_FLAG_ENVIRONMENT_VARIABLES);
const featureFlagReferences = sourceEnvironmentReferences.filter((reference) =>
  featureFlagNames.has(reference.slice(0, reference.indexOf("@"))),
);
assertInventorySnapshot(
  "feature-flag references",
  featureFlagReferences,
  INVENTORY_SNAPSHOTS.featureFlagReferences,
);
assert.deepEqual(
  uniqueSorted(
    featureFlagReferences.map((reference) =>
      reference.slice(0, reference.indexOf("@")),
    ),
  ),
  [...FEATURE_FLAG_ENVIRONMENT_VARIABLES],
  "every classified feature flag must have an application-source reference",
);

const publicRouteInventory = inventoryRecord(
  APPLICATION_SURFACE_INVENTORY,
  "public-route",
);
const authenticatedRouteInventory = inventoryRecord(
  APPLICATION_SURFACE_INVENTORY,
  "authenticated-route",
);
const oauthInventory = inventoryRecord(API_SURFACE_INVENTORY, "oauth-oidc");
for (const record of [
  publicRouteInventory,
  authenticatedRouteInventory,
  oauthInventory,
]) {
  assert.equal(record.status, "verified");
  assert.ok(record.members.length > 0);
}
const authenticationFlowMembers = [
  ...publicRouteInventory.members.map(
    (member) => `application:public-route:${member}`,
  ),
  ...authenticatedRouteInventory.members.map(
    (member) => `application:authenticated-route:${member}`,
  ),
  ...oauthInventory.members.map((member) => `api:oauth-oidc:${member}`),
].toSorted();
assertInventorySnapshot(
  "authentication-flow surface members",
  authenticationFlowMembers,
  INVENTORY_SNAPSHOTS.authenticationFlowMembers,
);

const billingSourceMembers = productSourceFiles
  .filter(
    (file) =>
      repoPath(file).startsWith("src/lib/billing/") ||
      importsBillingModule(file),
  )
  .map(repoPath)
  .toSorted();
assertInventorySnapshot(
  "billing source members",
  billingSourceMembers,
  INVENTORY_SNAPSHOTS.billingSourceMembers,
);
const paymentReturnInventory = inventoryRecord(
  APPLICATION_SURFACE_INVENTORY,
  "payment-return",
);
const paymentWebhookInventory = inventoryRecord(
  APPLICATION_SURFACE_INVENTORY,
  "payment-webhook",
);
assert.equal(paymentReturnInventory.status, "verified");
assert.equal(paymentWebhookInventory.status, "verified");
assert.deepEqual(paymentReturnInventory.members, [
  "PAGE /account/billing",
  "PAGE /account/pages",
  "PAGE /pricing",
]);
assert.deepEqual(paymentWebhookInventory.members, [
  "POST /api/webhooks/lago",
  "POST /api/webhooks/stripe",
]);
const stripeReturnRoutes = collectNewUrlPathnames(
  path.join(repositoryRoot, "src", "lib", "billing", "stripe-service.ts"),
).map((route) => `PAGE ${route}`);
assert.deepEqual(
  uniqueSorted(stripeReturnRoutes),
  paymentReturnInventory.members,
  "the billing return inventory must match every static Stripe return route",
);

const appSourceFiles = productSourceFiles.filter((file) =>
  repoPath(file).startsWith("src/app/"),
);
const redirectCalls = appSourceFiles.flatMap(collectRedirectCalls);
const apiRedirects = redirectCalls
  .filter(({ file }) => repoPath(file).startsWith("src/app/api/"))
  .map(({ signal }) => signal)
  .toSorted();
assertInventorySnapshot(
  "API redirect callsites",
  apiRedirects,
  INVENTORY_SNAPSHOTS.apiRedirects,
);
const authenticationRedirects = redirectCalls
  .filter(
    ({ file, argument, sourceFile }) =>
      ["src/app/sign-in/route.ts", "src/app/callback/route.ts"].includes(
        repoPath(file),
      ) || redirectTargetsSignIn(argument, sourceFile),
  )
  .map(({ signal }) => signal)
  .toSorted();
assertInventorySnapshot(
  "authentication redirect callsites",
  authenticationRedirects,
  INVENTORY_SNAPSHOTS.authenticationRedirects,
);
assert.ok(
  authenticationRedirects.includes(
    'src/app/account/appearance/page.tsx:redirect("/sign-in?returnTo=/account/appearance")',
  ),
  "the production-disabled appearance preview must fail closed behind sign-in when enabled",
);

const sourceFeatureFlaggedRoutes = productSourceFiles
  .filter(
    (file) =>
      repoPath(file).startsWith("src/app/") &&
      /\/(?:page|layout|route)\.tsx?$/.test(repoPath(file)) &&
      sourceCalls(file, "requireDesignLabReviewer"),
  )
  .map(appRouteForSource)
  .toSorted();
const registeredFeatureFlaggedRoutes = SCREEN_CONTRACTS.filter(
  (screen) => screen.featureFlags.length > 0,
)
  .map((screen) => screen.route)
  .toSorted();
assert.deepEqual(
  sourceFeatureFlaggedRoutes,
  registeredFeatureFlaggedRoutes,
  "registered feature-gated routes must match the source access-gate callsites",
);
const featureFlaggedRouteMembers = SCREEN_CONTRACTS.filter(
  (screen) => screen.featureFlags.length > 0,
)
  .map(
    (screen) =>
      `${screen.route}:${[...screen.featureFlags].toSorted().join(",")}`,
  )
  .toSorted();
assert.ok(
  featureFlaggedRouteMembers.every((member) =>
    member.endsWith(":ENABLE_DEVICE_PREVIEWS"),
  ),
);
assertInventorySnapshot(
  "feature-flagged routes",
  featureFlaggedRouteMembers,
  INVENTORY_SNAPSHOTS.featureFlaggedRoutes,
);

const routeCapabilitySourceMembers =
  PRODUCT_ROUTE_CAPABILITY_SOURCE_EVIDENCE_RECORDS.map(
    assertRouteCapabilitySource,
  ).toSorted();
assertInventorySnapshot(
  "route capability source records",
  routeCapabilitySourceMembers,
  INVENTORY_SNAPSHOTS.routeCapabilitySources,
);
const firstRouteCapability =
  PRODUCT_ROUTE_CAPABILITY_SOURCE_EVIDENCE_RECORDS[0];
assert.throws(() =>
  assertRouteCapabilitySource({
    ...firstRouteCapability,
    interfaceExport: "MISSING_INTERFACE_EXPORT",
  }),
);
assert.throws(() =>
  assertRouteCapabilitySource({
    ...firstRouteCapability,
    requiredInterfaceCalls: [
      ...firstRouteCapability.requiredInterfaceCalls,
      "missingInterfaceCall",
    ],
  }),
);
assert.throws(() =>
  assertRouteCapabilitySource({
    ...firstRouteCapability,
    delegateExport: "MISSING_DELEGATE_EXPORT",
  }),
);
assert.throws(() =>
  assertRouteCapabilitySource({
    ...firstRouteCapability,
    requiredBindingSignals: [
      ...firstRouteCapability.requiredBindingSignals,
      "missing binding signal",
    ],
  }),
);
const firstRacingRouteCapability =
  PRODUCT_ROUTE_CAPABILITY_SOURCE_EVIDENCE_RECORDS.find((record) =>
    record.requirementId.startsWith("ROUTE.RACING."),
  ) as ProductRouteCapabilitySourceEvidenceRecord | undefined;
assert.ok(firstRacingRouteCapability);
const firstRacingDelegateCalls =
  firstRacingRouteCapability.requiredDelegateCalls ?? [];
const firstRacingFunctionChecks =
  firstRacingRouteCapability.sourceFunctionChecks ?? [];
assert.ok(firstRacingDelegateCalls.length);
assert.ok(firstRacingFunctionChecks.length);
assert.throws(() =>
  assertRouteCapabilitySource({
    ...firstRacingRouteCapability,
    requiredDelegateCalls: [
      ...firstRacingDelegateCalls,
      "missingDelegateCall",
    ],
  }),
);
const firstRacingFunctionCheck =
  firstRacingFunctionChecks[0];
assert.throws(() =>
  assertRouteCapabilitySource({
    ...firstRacingRouteCapability,
    sourceFunctionChecks: [
      {
        ...firstRacingFunctionCheck,
        requiredSignals: [
          ...(firstRacingFunctionCheck.requiredSignals ?? []),
          "missing source function signal",
        ],
      },
    ],
  }),
);

console.log(
  `Product source audit passed: ${routeGroups.length} route groups, ${layouts.length} layouts (${nestedLayouts.length} nested), ${parallelRoutes.length} parallel routes, ${dynamicRouteDirectories.length} dynamic route directories, ${sourceRouteFiles.length} route-handler files, ${databaseModels.length} database models, ${featureFlagReferences.length} feature-flag references, ${authenticationFlowMembers.length} authentication-flow members, ${billingSourceMembers.length} billing source members, ${apiRedirects.length} API redirects, ${authenticationRedirects.length} authentication redirects, ${featureFlaggedRouteMembers.length} feature-gated routes, ${routeCapabilitySourceMembers.length} source-route capabilities, ${testFiles.length} tests and ${new Set(fixtureIds).size} Design Lab fixtures inspected`,
);

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}

function walkDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const target = path.join(directory, entry.name);
    return [target, ...walkDirectories(target)];
  });
}

function isRouteGroup(directory: string): boolean {
  return /^\(.+\)$/.test(path.basename(directory));
}

function isParallelRoute(directory: string): boolean {
  return /^@.+/.test(path.basename(directory));
}

function isDynamicRoute(directory: string): boolean {
  const segment = path.basename(directory);
  return segment.startsWith("[") && segment.endsWith("]");
}

function isProductSourceFile(file: string): boolean {
  return (
    /\.(?:ts|tsx)$/.test(file) && !/(?:\.test|\.d)\.(?:ts|tsx)$/.test(file)
  );
}

function parseSourceFile(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function visitSource(
  sourceFile: ts.SourceFile,
  inspect: (node: ts.Node) => void,
): void {
  function visit(node: ts.Node): void {
    inspect(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function collectProcessEnvironmentReferences(file: string): string[] {
  const sourceFile = parseSourceFile(file);
  const references: string[] = [];
  visitSource(sourceFile, (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "process" &&
      node.expression.name.text === "env"
    ) {
      references.push(`${node.name.text}@${repoPath(file)}`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "process" &&
      node.expression.name.text === "env"
    ) {
      assert.ok(node.argumentExpression);
      const key =
        ts.isStringLiteral(node.argumentExpression) ||
        ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)
          ? node.argumentExpression.text
          : `[${node.argumentExpression.getText(sourceFile)}]`;
      references.push(`${key}@${repoPath(file)}`);
    }
  });
  return references;
}

function importsBillingModule(file: string): boolean {
  return parseSourceFile(file).statements.some(
    (statement) =>
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith("@/lib/billing/"),
  );
}

function collectNewUrlPathnames(file: string): string[] {
  const sourceFile = parseSourceFile(file);
  const routes: string[] = [];
  visitSource(sourceFile, (node) => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL" &&
      node.arguments?.[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text.startsWith("/")
    ) {
      routes.push(node.arguments[0].text);
    }
  });
  return routes;
}

type RedirectCall = {
  file: string;
  sourceFile: ts.SourceFile;
  argument: ts.Expression | undefined;
  signal: string;
};

function collectRedirectCalls(file: string): RedirectCall[] {
  const sourceFile = parseSourceFile(file);
  const redirectFunctions = new Set<string>();
  const nextResponseBindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const binding of statement.importClause.namedBindings.elements) {
      const importedName = binding.propertyName?.text ?? binding.name.text;
      if (
        statement.moduleSpecifier.text === "next/navigation" &&
        importedName === "redirect"
      ) {
        redirectFunctions.add(binding.name.text);
      }
      if (
        statement.moduleSpecifier.text === "next/server" &&
        importedName === "NextResponse"
      ) {
        nextResponseBindings.add(binding.name.text);
      }
    }
  }

  const calls: RedirectCall[] = [];
  visitSource(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const isRedirectFunction =
      ts.isIdentifier(node.expression) &&
      redirectFunctions.has(node.expression.text);
    const isNextResponseRedirect =
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      nextResponseBindings.has(node.expression.expression.text) &&
      node.expression.name.text === "redirect";
    if (!isRedirectFunction && !isNextResponseRedirect) return;
    calls.push({
      file,
      sourceFile,
      argument: node.arguments[0],
      signal: `${repoPath(file)}:${node.getText(sourceFile).replace(/\s+/g, " ")}`,
    });
  });
  return calls;
}

function redirectTargetsSignIn(
  argument: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
  visitedIdentifiers = new Set<string>(),
): boolean {
  if (!argument) return false;
  let targetsSignIn = false;
  visitNode(argument, (node) => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text.startsWith("/sign-in")
    ) {
      targetsSignIn = true;
    }
  });
  if (targetsSignIn || !ts.isIdentifier(argument)) return targetsSignIn;
  if (visitedIdentifiers.has(argument.text)) return false;
  visitedIdentifiers.add(argument.text);

  let initializer: ts.Expression | undefined;
  visitSource(sourceFile, (node) => {
    if (
      !initializer &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === argument.text &&
      node.initializer
    ) {
      initializer = node.initializer;
    }
  });
  return redirectTargetsSignIn(initializer, sourceFile, visitedIdentifiers);
}

function visitNode(node: ts.Node, inspect: (node: ts.Node) => void): void {
  inspect(node);
  ts.forEachChild(node, (child) => visitNode(child, inspect));
}

function sourceCalls(file: string, expectedName: string): boolean {
  let found = false;
  visitSource(parseSourceFile(file), (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === expectedName
    ) {
      found = true;
    }
  });
  return found;
}

function appRouteForSource(file: string): string {
  const segments = path
    .relative(appRoot, path.dirname(file))
    .split(path.sep)
    .filter(
      (segment) =>
        segment && !/^\(.+\)$/.test(segment) && !segment.startsWith("@"),
    );
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function inventoryRecord<T extends { key: string }>(
  records: readonly T[],
  key: string,
): T {
  const record = records.find((candidate) => candidate.key === key);
  assert.ok(record, `missing inventory record: ${key}`);
  return record;
}

function assertRouteCapabilitySource(
  record: ProductRouteCapabilitySourceEvidenceRecord,
): string {
  const interfaceSource = parseSourceFile(
    path.join(repositoryRoot, record.interfacePath),
  );
  const interfaceFunction = exportedFunction(
    interfaceSource,
    record.interfaceExport,
  );
  const interfaceCalls = callExpressions(interfaceFunction, interfaceSource);
  for (const requiredCall of record.requiredInterfaceCalls) {
    assert.ok(
      interfaceCalls.has(requiredCall),
      `${record.requirementId}: ${record.interfaceExport} must call ${requiredCall}`,
    );
  }

  const delegateSource = parseSourceFile(
    path.join(repositoryRoot, record.delegatePath),
  );
  const delegateFunction = exportedFunction(
    delegateSource,
    record.delegateExport,
  );
  const delegateCalls = callExpressions(delegateFunction, delegateSource);
  for (const requiredCall of record.requiredDelegateCalls ?? []) {
    assert.ok(
      delegateCalls.has(requiredCall),
      `${record.requirementId}: ${record.delegateExport} must call ${requiredCall}`,
    );
  }

  for (const check of record.sourceFunctionChecks ?? []) {
    const checkSource = parseSourceFile(
      path.join(repositoryRoot, check.path),
    );
    const checkedFunction = namedFunction(
      checkSource,
      check.functionName,
    );
    const checkedCalls = callExpressions(checkedFunction, checkSource);
    for (const requiredCall of check.requiredCalls ?? []) {
      assert.ok(
        checkedCalls.has(requiredCall),
        `${record.requirementId}: ${check.path}#${check.functionName} must call ${requiredCall}`,
      );
    }
    const checkedSource = checkedFunction.getText(checkSource);
    for (const requiredSignal of check.requiredSignals ?? []) {
      assert.ok(
        checkedSource.includes(requiredSignal),
        `${record.requirementId}: ${check.path}#${check.functionName} is missing ${requiredSignal}`,
      );
    }
  }

  const bindingRecords = [
    {
      path: record.bindingPath,
      requiredSignals: record.requiredBindingSignals,
    },
    ...(record.additionalBindings ?? []),
  ];
  for (const binding of bindingRecords) {
    const bindingSource = readFileSync(
      path.join(repositoryRoot, binding.path),
      "utf8",
    );
    for (const signal of binding.requiredSignals) {
      assert.ok(
        bindingSource.includes(signal),
        `${record.requirementId}: ${binding.path} is missing ${signal}`,
      );
    }
  }

  return [
    record.requirementId,
    `${record.interfacePath}#${record.interfaceExport}`,
    `calls=${record.requiredInterfaceCalls.join(",")}`,
    `${record.delegatePath}#${record.delegateExport}`,
    `delegateCalls=${(record.requiredDelegateCalls ?? []).join(",")}`,
    `functions=${(record.sourceFunctionChecks ?? [])
      .map(
        (check) =>
          `${check.path}#${check.functionName}:calls=${(check.requiredCalls ?? []).join(",")}:signals=${(check.requiredSignals ?? []).join(",")}`,
      )
      .join(";")}`,
    `bindings=${bindingRecords
      .map(
        (binding) =>
          `${binding.path}#${binding.requiredSignals.join(",")}`,
      )
      .join(";")}`,
  ].join("|");
}

function exportedFunction(
  sourceFile: ts.SourceFile,
  functionName: string,
): ts.FunctionDeclaration {
  const declaration = namedFunction(sourceFile, functionName);
  assert.ok(
    declaration.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) === true,
    `${repoPath(sourceFile.fileName)} must export function ${functionName}`,
  );
  return declaration;
}

function namedFunction(
  sourceFile: ts.SourceFile,
  functionName: string,
): ts.FunctionDeclaration {
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName,
  );
  assert.ok(
    declaration,
    `${repoPath(sourceFile.fileName)} must declare function ${functionName}`,
  );
  return declaration;
}

function callExpressions(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): ReadonlySet<string> {
  const calls = new Set<string>();
  visitNode(node, (candidate) => {
    if (ts.isCallExpression(candidate)) {
      calls.add(candidate.expression.getText(sourceFile));
    }
  });
  return calls;
}

function assertInventorySnapshot(
  label: string,
  members: readonly string[],
  expected: { count: number; sha256: string },
): void {
  assert.deepEqual(members, [...members].toSorted(), `${label} must be sorted`);
  assert.equal(
    new Set(members).size,
    members.length,
    `${label} must not contain duplicate members`,
  );
  assert.equal(members.length, expected.count, `${label} count changed`);
  assert.equal(
    createHash("sha256").update(members.join("\n")).digest("hex"),
    expected.sha256,
    `${label} membership changed`,
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted();
}

function assertRouteHandlerCoverage(
  routeFiles: readonly string[],
  discoveredFiles: readonly string[],
): void {
  assert.deepEqual(
    discoveredFiles,
    [...routeFiles].toSorted(),
    "every route-handler file must export at least one discovered HTTP method",
  );
}

function assertFixtureInventory(
  screens: readonly { route: string; fixtureIds: readonly string[] }[],
): void {
  const fixtureIds = screens.flatMap((screen) => {
    assert.ok(
      screen.fixtureIds.length > 0,
      `${screen.route} must expose at least one Design Lab fixture`,
    );
    for (const fixtureId of screen.fixtureIds) assert.ok(fixtureId.trim());
    return screen.fixtureIds;
  });
  assert.equal(
    new Set(fixtureIds).size,
    fixtureIds.length,
    "Design Lab fixture IDs must remain unique",
  );
}

function repoPath(file: string): string {
  return path.relative(repositoryRoot, file).replaceAll("\\", "/");
}
