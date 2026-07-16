import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import { PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES } from "./production-screen-member-support-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-ACCOUNT-INTERACTIONS

const TEST_ID = PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH = PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST.path;
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_ACCOUNT_INTERACTIONS = {
  "/account": {
    queryParameters: ["checkout", "interval", "plan"],
    actionIds: [
      "ACCOUNT.ACTION.PROFILE.UPDATE",
      "ACCOUNT.ACTION.PROFILE-STUDIO.OPEN",
      "ACCOUNT.ACTION.MEMBER-AREA.OPEN",
      "ACCOUNT.ACTION.DOG.OPEN",
      "ACCOUNT.ACTION.DATA-EXPORT.REQUEST",
      "ACCOUNT.ACTION.DELETION.REQUEST",
      "ACCOUNT.ACTION.CHECKOUT.CONTINUE",
      "ACCOUNT.ACTION.SIGN-IN.OPEN",
    ],
    forms: [
      ["ACCOUNT.FORM.PROFILE", "SERVER ACTION updateProfile"],
      ["ACCOUNT.FORM.DATA-EXPORT", "POST /api/users/me/export"],
      ["ACCOUNT.FORM.DELETION", "SERVER ACTION requestAccountDeletion"],
      ["ACCOUNT.FORM.CHECKOUT", "POST /api/billing/checkout"],
    ],
    sourceAssertions: [
      "const pendingPlan = parsePendingPlan(query.plan)",
      'query.checkout === "continue"',
      "parsePendingInterval(query.interval)",
      "<form action={updateProfile}",
      "<UserDataExportForm",
      "<form action={requestAccountDeletion}",
      "Type DELETE to confirm",
      'name="confirmation"',
      '<form action="/api/billing/checkout" method="post"',
      "href={`/dogs/${ownership.dog.id}`}",
    ],
  },
  "/account/appearance": {
    queryParameters: ["app", "dock", "market", "sponsored"],
    actionIds: [
      "ACCOUNT-APPEARANCE.ACTION.PREVIEW",
      "ACCOUNT-APPEARANCE.ACTION.APP-PREVIEW.OPEN",
      "ACCOUNT-APPEARANCE.ACTION.DOCK-PREVIEW.OPEN",
      "ACCOUNT-APPEARANCE.ACTION.MARKETPLACE-PREVIEW.OPEN",
    ],
    forms: [["ACCOUNT-APPEARANCE.FORM.PREVIEW", "GET /account/appearance"]],
    sourceAssertions: [
      'process.env.NODE_ENV === "production"',
      'process.env.ENABLE_DEVICE_PREVIEWS !== "true"',
      "notFound();",
      "resolveAppearancePreviewState(await searchParams)",
      '<form method="get"',
      'name="app"',
      'name="dock"',
      'name="market"',
      'name="sponsored"',
      "Preview only — saving is disabled",
      "No account, database,",
      "href={`/feed/device-preview?device=mobile&variant=${state.app}&sponsored=${state.sponsored}`}",
      "href={`/design-lab/dock-skins?dock=${state.dock}`}",
      "href={`/marketplace/design-lab?template=${state.market}`}",
    ],
  },
  "/account/billing": {
    queryParameters: ["billing", "checkout", "interval", "plan", "portal"],
    actionIds: [
      "ACCOUNT-BILLING.ACTION.PORTAL.OPEN",
      "ACCOUNT-BILLING.ACTION.PLAN.OPEN",
      "ACCOUNT-BILLING.ACTION.STATUS.REFRESH",
      "ACCOUNT-BILLING.ACTION.CHECKOUT.RETRY",
      "ACCOUNT-BILLING.ACTION.ACCOUNT.OPEN",
      "ACCOUNT-BILLING.ACTION.SIGN-IN.OPEN",
    ],
    forms: [["ACCOUNT-BILLING.FORM.PORTAL", "POST /api/billing/portal"]],
    sourceAssertions: [
      "singleQueryValue(query.checkout)",
      "singleQueryValue(query.portal)",
      "singleQueryValue(query.billing)",
      'query.interval === "monthly" || query.interval === "yearly"',
      'query.plan === "pro"',
      'action="/api/billing/portal"',
      'method="post"',
    ],
  },
  "/account/listings": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-LISTINGS.ACTION.ACCOUNT.OPEN",
      "ACCOUNT-LISTINGS.ACTION.CREATE.OPEN",
      "ACCOUNT-LISTINGS.ACTION.VIEW.SELECT",
      "ACCOUNT-LISTINGS.ACTION.ITEM.OPEN",
      "ACCOUNT-LISTINGS.ACTION.ITEM.EDIT",
    ],
    forms: [],
    sourceAssertions: [
      'import { SellerListingsViewPage } from "./seller-listings-page";',
      '<SellerListingsViewPage view="all" />',
    ],
  },
  "/account/listings/archived": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-LISTINGS-ARCHIVED.ACTION.ACCOUNT.OPEN",
      "ACCOUNT-LISTINGS-ARCHIVED.ACTION.CREATE.OPEN",
      "ACCOUNT-LISTINGS-ARCHIVED.ACTION.VIEW.SELECT",
      "ACCOUNT-LISTINGS-ARCHIVED.ACTION.ITEM.OPEN",
    ],
    forms: [],
    sourceAssertions: [
      'import { SellerListingsViewPage } from "../seller-listings-page";',
      '<SellerListingsViewPage view="archived" />',
    ],
  },
  "/account/listings/drafts": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-LISTINGS-DRAFTS.ACTION.ACCOUNT.OPEN",
      "ACCOUNT-LISTINGS-DRAFTS.ACTION.CREATE.OPEN",
      "ACCOUNT-LISTINGS-DRAFTS.ACTION.VIEW.SELECT",
      "ACCOUNT-LISTINGS-DRAFTS.ACTION.ITEM.OPEN",
      "ACCOUNT-LISTINGS-DRAFTS.ACTION.ITEM.EDIT",
    ],
    forms: [],
    sourceAssertions: [
      'import { SellerListingsViewPage } from "../seller-listings-page";',
      '<SellerListingsViewPage view="drafts" />',
    ],
  },
  "/account/notifications": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-NOTIFICATIONS.ACTION.ALL.READ",
      "ACCOUNT-NOTIFICATIONS.ACTION.ITEM.READ",
      "ACCOUNT-NOTIFICATIONS.ACTION.ITEM.OPEN",
      "ACCOUNT-NOTIFICATIONS.ACTION.ACCOUNT.OPEN",
    ],
    forms: [
      [
        "ACCOUNT-NOTIFICATIONS.FORM.ALL-READ",
        "SERVER ACTION markAllNotificationsRead",
      ],
      [
        "ACCOUNT-NOTIFICATIONS.FORM.ITEM-READ",
        "SERVER ACTION markNotificationRead",
      ],
    ],
    sourceAssertions: [
      "<form action={markAllNotificationsRead}",
      "markNotificationRead.bind(null, record.id)",
      "<form action={readAction}>",
      "href={record.href}",
      "listNotificationsForUser(current.dbUserId)",
    ],
  },
  "/account/pages": {
    queryParameters: ["bespoke"],
    actionIds: [
      "ACCOUNT-PAGES.ACTION.MAIN.CREATE",
      "ACCOUNT-PAGES.ACTION.DOG.CREATE",
      "ACCOUNT-PAGES.ACTION.MANAGED.OPEN",
      "ACCOUNT-PAGES.ACTION.PUBLIC.OPEN",
      "ACCOUNT-PAGES.ACTION.BESPOKE.CHECKOUT",
      "ACCOUNT-PAGES.ACTION.PLAN.OPEN",
      "ACCOUNT-PAGES.ACTION.CHECKOUT.RETRY",
    ],
    forms: [
      [
        "ACCOUNT-PAGES.FORM.MAIN-CREATE",
        "SERVER ACTION createCustomPageAction",
      ],
      ["ACCOUNT-PAGES.FORM.DOG-CREATE", "SERVER ACTION createCustomPageAction"],
      [
        "ACCOUNT-PAGES.FORM.BESPOKE-CHECKOUT",
        "POST /api/billing/bespoke/checkout",
      ],
    ],
    sourceAssertions: [
      "(await searchParams).bespoke",
      "<form key={type} action={createCustomPageAction}>",
      "<form action={createCustomPageAction}>",
      'action="/api/billing/bespoke/checkout"',
      "href={`/account/pages/${page.id}`}",
      "listApprovedOwnedDogs(current)",
    ],
  },
  "/account/pages/[id]": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-PAGE.ACTION.PUBLISH.TOGGLE",
      "ACCOUNT-PAGE.ACTION.UPDATE",
      "ACCOUNT-PAGE.ACTION.DOG-CARD.GENERATE",
      "ACCOUNT-PAGE.ACTION.DELETE",
      "ACCOUNT-PAGE.ACTION.PUBLIC.OPEN",
      "ACCOUNT-PAGE.ACTION.LIST.OPEN",
      "ACCOUNT-PAGE.ACTION.MEDIA-EDITOR.JUMP",
    ],
    forms: [
      ["ACCOUNT-PAGE.FORM.PUBLISH", "SERVER ACTION publishCustomPageAction"],
      ["ACCOUNT-PAGE.FORM.UPDATE", "SERVER ACTION updateCustomPageAction"],
      ["ACCOUNT-PAGE.FORM.DOG-CARD", "SERVER ACTION generateDogCardAction"],
      ["ACCOUNT-PAGE.FORM.DELETE", "SERVER ACTION deleteCustomPageAction"],
    ],
    sourceAssertions: [
      "publishCustomPageAction.bind(null, page.id)",
      "updateCustomPageAction.bind(null, page.id)",
      "deleteCustomPageAction.bind(null, page.id)",
      "generateDogCardAction.bind(null, page.id)",
      "<form action={publishAction}>",
      "<form action={updateAction}",
      "<form action={cardGenAction}>",
      "<form action={deleteAction}",
      "Type DELETE to confirm",
      'name="confirmation"',
    ],
  },
  "/account/privacy": {
    queryParameters: [],
    actionIds: ["ACCOUNT-PRIVACY.ACTION.ACCOUNT.OPEN"],
    forms: [],
    sourceAssertions: [
      "requirePrivacyProfile()",
      "withDbRequestContext(current",
      '<Link href="/account"',
    ],
  },
  "/account/profile": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-PROFILE.ACTION.PUBLISH",
      "ACCOUNT-PROFILE.ACTION.CANCEL",
    ],
    forms: [
      [
        "ACCOUNT-PROFILE.FORM.MEDIA",
        "SERVER ACTION updatePersonalIdentityMedia",
      ],
    ],
    sourceAssertions: [
      "requireCurrentUserProfile()",
      "<form action={updatePersonalIdentityMedia}",
      'name="avatarMediaId"',
      'name="coverMediaId"',
      "<MediaAlignmentUpload",
      'href="/account"',
    ],
  },
  "/account/saved-listings": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-SAVED.ACTION.LISTING.OPEN",
      "ACCOUNT-SAVED.ACTION.MARKETPLACE.OPEN",
      "ACCOUNT-SAVED.ACTION.ACCOUNT.OPEN",
    ],
    forms: [],
    sourceAssertions: [
      "requireSavedListingsProfile()",
      "getSavedListingsForCurrentUser(current)",
      "href={`/marketplace/${item.listingId}`}",
      'href="/marketplace"',
      'href="/account"',
    ],
  },
  "/account/security": {
    queryParameters: [],
    actionIds: [
      "ACCOUNT-SECURITY.ACTION.SIGN-IN.OPEN",
      "ACCOUNT-SECURITY.ACTION.PRIVACY.OPEN",
      "ACCOUNT-SECURITY.ACTION.ACCOUNT.OPEN",
    ],
    forms: [],
    sourceAssertions: [
      "requireSecurityAccount()",
      "requireCurrentUserProfile()",
      'href="/sign-in"',
      'href="/account/privacy"',
      'href="/account"',
    ],
  },
  "/account/support": {
    queryParameters: ["q", "ticket"],
    actionIds: [
      "ACCOUNT-SUPPORT.ACTION.HELP.SEARCH",
      "ACCOUNT-SUPPORT.ACTION.CONTACT.OPEN",
      "ACCOUNT-SUPPORT.ACTION.ACCOUNT.OPEN",
    ],
    forms: [["ACCOUNT-SUPPORT.FORM.HELP.SEARCH", "GET /account/support"]],
    sourceAssertions: [
      'query.ticket === "created"',
      "query={query.q}",
      "requireSupportProfile()",
      "where: { userId: current.dbUserId }",
      'href="/contact"',
      'href="/account"',
    ],
  },
  "/account/support/[id]": {
    queryParameters: [],
    actionIds: ["ACCOUNT-SUPPORT-DETAIL.ACTION.SUPPORT.OPEN"],
    forms: [],
    sourceAssertions: [
      "const current = await requireSupportTicketProfile();",
      "const ticket = await getSupportTicketForCurrentUser(current, id);",
      "if (!ticket) notFound();",
      'href="/account/support"',
    ],
  },
} as const;

const independentlyCoveredAccountRoutes =
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES.filter((route) =>
    route.startsWith("/account"),
  );

assert.deepEqual(
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES,
  Object.keys(EXPECTED_ACCOUNT_INTERACTIONS),
  "the focused account batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).filter((route) =>
    route.startsWith("/account"),
  ),
  [
    ...PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES,
    ...independentlyCoveredAccountRoutes,
  ],
  "no unreviewed account route may inherit action or form completion",
);
assert.equal(PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES.length, 15);

for (const route of PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES) {
  const expected = EXPECTED_ACCOUNT_INTERACTIONS[route];
  const interaction = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing canonical screen contract`);
  assert.equal(
    screen.productionEnabled,
    route !== "/account/appearance",
    `${route}: preview availability must remain explicit`,
  );
  assert.equal(onboardingExclusions.has(route), false);
  assert.equal(
    screen.coverage.onboarding.status,
    "tested",
    `${route}: shared account onboarding must remain tested`,
  );

  assert.deepEqual(interaction.queryParameters, expected.queryParameters);
  assert.deepEqual(
    interaction.actions.map((action) => action.id),
    expected.actionIds,
  );
  assert.deepEqual(
    interaction.forms.map((form) => [form.id, form.submitsTo]),
    expected.forms,
  );
  assert.deepEqual(screen.queryParameters, [...expected.queryParameters]);
  assert.deepEqual(screen.primaryActions, [...expected.actionIds]);
  assert.deepEqual(
    screen.forms,
    expected.forms.map(([id, submitsTo]) => `${id} -> ${submitsTo}`),
  );

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const sourceForms = formSignals.filter((signal) =>
    signal.endsWith(":<form>"),
  );
  assert.equal(
    sourceForms.length,
    expected.forms.length,
    `${route}: every source-owned form must have exactly one manifest entry\n${sourceForms.join("\n")}`,
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified action coverage requires a page-owned user-action signal`,
  );
  assert.equal(
    formExclusions.has(route),
    expected.forms.length === 0,
    `${route}: zero-form status and the fail-closed exclusion list must agree`,
  );
  if (expected.forms.length === 0) {
    assert.deepEqual(
      formSignals,
      [],
      `${route}: excluded form closure must stay empty`,
    );
  }

  assert.equal(screen.coverage.actions.status, "verified");
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.equal(
    screen.coverage.forms.status,
    expected.forms.length === 0 ? "excluded" : "verified",
  );
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));
  for (const action of interaction.actions) {
    assert.match(action.id, /^ACCOUNT(?:-|\.)/);
    assert.ok(action.result.length > 0);
    assert.ok(action.enforcement && action.enforcement.length > 0);
    assert.deepEqual(action.testIds, [TEST_ID]);
  }
  for (const form of interaction.forms) {
    assert.match(form.submitsTo, /^(?:GET \/|POST \/|SERVER ACTION )/);
    assert.ok(form.schema && form.schema.length > 0);
    assert.deepEqual(form.testIds, [TEST_ID]);
  }

  const pageSource = readFileSync(screen.sourceFiles[0], "utf8");
  for (const assertion of expected.sourceAssertions) {
    assert.ok(
      pageSource.includes(assertion),
      `${route}: source assertion is absent: ${assertion}`,
    );
  }
}

const appearancePageSource = readFileSync(
  "src/app/account/appearance/page.tsx",
  "utf8",
);
assert.equal(
  appearancePageSource.includes(" action={"),
  false,
  "/account/appearance must remain URL-only and must not acquire a server-action form",
);
const appearanceStateSource = readFileSync(
  "src/components/appearance-preview-state.ts",
  "utf8",
);
for (const assertion of [
  "isPrototypeVariant(requestedApp)",
  'requestedApp\n    : "A1"',
  "isDockSkinKey(requestedDock)",
  "resolveMarketplaceTemplateKey(firstValue(searchParams.market))",
  "resolveSponsoredMarketplaceVisibility(searchParams.sponsored)",
  'return firstValue(value) === "off" ? "off" : "on";',
  "return new URLSearchParams({",
]) {
  assert.ok(
    appearanceStateSource.includes(assertion),
    `appearance URL-state validation must preserve ${assertion}`,
  );
}

for (const route of [
  "/feed/device-preview",
  "/marketplace/design-lab",
] as const) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing preview screen contract`);
  assert.equal(formExclusions.has(route), true, `${route}: missing zero-form exclusion`);
  assert.deepEqual(
    [...getLocalSourceClosure(screen.sourceFiles[0])].flatMap(
      findFormSubmissionSignals,
    ),
    [],
    `${route}: preview form exclusion must remain source-exact`,
  );
  assert.equal(screen.coverage.forms.status, "excluded");
}

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const assertion of [
  "profileUpdateSchema.parse({",
  "personalActorMediaUpdateSchema.parse({",
  "markNotificationReadForCurrentUser(current, notificationId)",
  "markAllNotificationsReadForCurrentUser(current)",
  "customPageCreateSchema.parse(raw)",
  "customPageUpdateSchema.parse({",
  "customPagePublishSchema.parse({",
  'setCustomPagePublished(current, pageId, parsed.publish === "true")',
  "destructiveConfirmationSchema.parse({",
  "deleteCustomPage(current, pageId)",
  "generateDogCard(current, pageId)",
]) {
  assert.ok(
    actionsSource.includes(assertion),
    `account actions must preserve ${assertion}`,
  );
}

const exportRouteSource = readFileSync(
  "src/app/api/users/me/export/route.ts",
  "utf8",
);
for (const assertion of [
  'fetchSite !== "same-origin" && fetchSite !== "none"',
  "requireCurrentUserProfile()",
  "{ failClosed: true }",
  "readUserExportData(current)",
  "USER_EXPORT_CACHE_CONTROL",
]) {
  assert.ok(
    exportRouteSource.includes(assertion),
    `data export must preserve ${assertion}`,
  );
}

for (const routePath of [
  "src/app/api/billing/checkout/route.ts",
  "src/app/api/billing/portal/route.ts",
  "src/app/api/billing/bespoke/checkout/route.ts",
]) {
  const source = readFileSync(routePath, "utf8");
  for (const assertion of [
    "assertTrustedOrigin(request, env)",
    "requireCurrentUserProfile()",
    "{ failClosed: true }",
  ]) {
    assert.ok(
      source.includes(assertion),
      `${routePath} must preserve ${assertion}`,
    );
  }
}

console.log(
  "Account interaction coverage passed: 15 action routes, 8 verified form routes, 7 account and 2 preview zero-form exclusions, 17 structured forms, preview persistence/live availability excluded, shared onboarding retained",
);
