import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";
import { PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES } from "./production-screen-commerce-interactions";

// screen-evidence-test-id: PRODUCTION-SCREEN-MARKETPLACE-INTERACTIONS

const TEST_ID = PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH = PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES
);
const formExclusions = new Set<string>(
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES
);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS)
);

const EXPECTED_MARKETPLACE_INTERACTIONS = {
  "/marketplace": {
    queryParameters: ["q", "category", "sort", "page", "submitted"],
    actionIds: [
      "MARKETPLACE.ACTION.FILTER",
      "MARKETPLACE.ACTION.CLEAR",
      "MARKETPLACE.ACTION.PAGE.CHANGE",
      "MARKETPLACE.ACTION.LISTING.OPEN",
      "MARKETPLACE.ACTION.CREATE.OPEN",
      "MARKETPLACE.ACTION.GROUPS.OPEN",
      "MARKETPLACE.ACTION.PROFILE.OPEN",
      "MARKETPLACE.ACTION.CARD.INSPECT",
      "MARKETPLACE.ACTION.CARD.SAVE",
    ],
    forms: [["MARKETPLACE.FORM.FILTER", "GET /marketplace"]],
    implementationPath: "src/app/listings/page.tsx",
    wrapperAssertions: [
      'import ListingsPage, { metadata } from "../listings/page";',
      "export { metadata };",
      "export default ListingsPage;",
    ],
    implementationAssertions: [
      "const q = parseMarketplaceSearch(params.q);",
      "const sort = parseMarketplaceSort(params.sort);",
      "const page = parseMarketplacePage(params.page);",
      'submitted={params.submitted === "review"}',
      "getMarketplaceListings(MARKETPLACE_PAGE_SIZE + 1, {",
      "offset: marketplacePageOffset(page),",
      'action="/marketplace"',
      'name="q"',
      'name="category"',
      'name="sort"',
      "marketplacePageHref(navigationState, page - 1)",
      "marketplacePageHref(navigationState, page + 1)",
      'href={`/marketplace/${listing.id}`}',
      'href="/marketplace/new"',
      'saveMode={canSave ? "account" : "none"}',
      'saveMode="local"',
    ],
  },
  "/marketplace/[id]": {
    queryParameters: [],
    actionIds: [
      "MARKETPLACE-DETAIL.ACTION.SAVE.TOGGLE",
      "MARKETPLACE-DETAIL.ACTION.ENQUIRY.SEND",
      "MARKETPLACE-DETAIL.ACTION.OWNER.RENEW",
      "MARKETPLACE-DETAIL.ACTION.OWNER.SOLD",
      "MARKETPLACE-DETAIL.ACTION.OWNER.WITHDRAW",
      "MARKETPLACE-DETAIL.ACTION.REPORT",
      "MARKETPLACE-DETAIL.ACTION.DOG.OPEN",
      "MARKETPLACE-DETAIL.ACTION.MARKETPLACE.OPEN",
      "MARKETPLACE-DETAIL.ACTION.PLAN.OPEN",
      "MARKETPLACE-DETAIL.ACTION.SIGN-IN.OPEN",
    ],
    forms: [
      ["MARKETPLACE-DETAIL.FORM.RENEW", "SERVER ACTION renewListing"],
      ["MARKETPLACE-DETAIL.FORM.SOLD", "SERVER ACTION markListingSold"],
      ["MARKETPLACE-DETAIL.FORM.WITHDRAW", "SERVER ACTION withdrawListing"],
      ["MARKETPLACE-DETAIL.FORM.REPORT", "SERVER ACTION reportListing"],
      [
        "MARKETPLACE-DETAIL.FORM.ENQUIRY",
        "POST /api/listings/[id]/enquiry",
      ],
    ],
    implementationPath: "src/app/listings/[id]/page.tsx",
    wrapperAssertions: [
      "generateMetadata as generateListingMetadata",
      "return generateListingMetadata(props);",
      "export default ListingDetailPage;",
    ],
    implementationAssertions: [
      "getListingForViewerById(id, user)",
      "renewListing.bind(null, listing.id)",
      "markListingSold.bind(null, listing.id)",
      "withdrawListing.bind(null, listing.id)",
      "reportListing.bind(null, listing.id)",
      "<InstantSaveListingButton",
      "<InstantListingEnquiryForm",
      "<form action={renewAction}>",
      "<form action={soldAction}>",
      "<form action={withdrawAction}>",
      "<form action={reportAction}",
      'href={`/dogs/${listing.dog.id}`}',
    ],
  },
  "/marketplace/new": {
    queryParameters: ["dogId", "title", "price"],
    actionIds: [
      "MARKETPLACE-CREATE.ACTION.SUBMIT",
      "MARKETPLACE-CREATE.ACTION.MARKETPLACE.OPEN",
      "MARKETPLACE-CREATE.ACTION.PLAN.OPEN",
      "MARKETPLACE-CREATE.ACTION.SIGN-IN.OPEN",
    ],
    forms: [
      ["MARKETPLACE-CREATE.FORM.LISTING", "SERVER ACTION createListing"],
    ],
    implementationPath: "src/app/listings/new/page.tsx",
    wrapperAssertions: [
      'import NewListingPage, { metadata } from "../../listings/new/page";',
      "export { metadata };",
      "export default NewListingPage;",
    ],
    implementationAssertions: [
      "searchParams: Promise<{ dogId?: string; title?: string; price?: string }>",
      'const canCreateListing = Boolean(user && hasTier(user.tier, "pro"));',
      "action={createListing}",
      'name="welfareAcknowledged"',
      'name="legalAcknowledged"',
      "required",
      'href="/marketplace"',
      'href="/pricing"',
      'href="/sign-in"',
    ],
  },
} as const;

const LEGACY_REDIRECT_ROUTES = [
  "/listings",
  "/listings/[id]",
  "/listings/new",
] as const;

assert.deepEqual(
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES,
  Object.keys(EXPECTED_MARKETPLACE_INTERACTIONS),
  "the canonical marketplace batch must fail closed on route additions or removals"
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).filter(
    (route) => route === "/marketplace" || route.startsWith("/marketplace/")
  ),
  [
    ...PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES.filter(
      (route) =>
        route.startsWith("/marketplace/") &&
        !PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES.includes(
          route as (typeof PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES)[number],
        ),
    ),
  ],
  "no unreviewed marketplace route may inherit action or form completion"
);
assert.equal(PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES.length, 3);

for (const route of PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES) {
  const expected = EXPECTED_MARKETPLACE_INTERACTIONS[route];
  const interaction = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing canonical screen contract`);
  assert.equal(screen.productionEnabled, true, `${route}: must be production-enabled`);
  assert.equal(onboardingExclusions.has(route), false);
  assert.equal(
    screen.coverage.onboarding.status,
    "tested",
    `${route}: contextual marketplace onboarding must remain tested`
  );
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), false);

  assert.deepEqual(interaction.queryParameters, expected.queryParameters);
  assert.deepEqual(
    interaction.actions.map((action) => action.id),
    expected.actionIds
  );
  assert.deepEqual(
    interaction.forms.map((form) => [form.id, form.submitsTo]),
    expected.forms
  );
  assert.deepEqual(screen.queryParameters, [...expected.queryParameters]);
  assert.deepEqual(screen.primaryActions, [...expected.actionIds]);
  assert.deepEqual(
    screen.forms,
    expected.forms.map(([id, submitsTo]) => `${id} -> ${submitsTo}`)
  );

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const sourceForms = formSignals.filter((signal) => signal.endsWith(":<form>"));
  assert.equal(
    sourceForms.length,
    expected.forms.length,
    `${route}: every source-owned form must have exactly one manifest entry\n${sourceForms.join("\n")}`
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified action coverage requires a page-owned user-action signal`
  );

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(screen.coverage.forms.status, "verified");
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));
  for (const action of interaction.actions) {
    assert.match(action.id, /^MARKETPLACE(?:-|\.)/);
    assert.ok(action.result.length > 0);
    assert.ok(action.enforcement && action.enforcement.length > 0);
    assert.deepEqual(action.testIds, [TEST_ID]);
  }
  for (const form of interaction.forms) {
    assert.match(form.submitsTo, /^(?:GET \/|POST \/|SERVER ACTION )/);
    assert.ok(form.schema && form.schema.length > 0);
    assert.deepEqual(form.testIds, [TEST_ID]);
  }

  const wrapperSource = readFileSync(screen.sourceFiles[0], "utf8");
  for (const assertion of expected.wrapperAssertions) {
    assert.ok(
      wrapperSource.includes(assertion),
      `${route}: canonical wrapper assertion is absent: ${assertion}`
    );
  }
  const implementationSource = readFileSync(expected.implementationPath, "utf8");
  for (const assertion of expected.implementationAssertions) {
    assert.ok(
      implementationSource.includes(assertion),
      `${route}: implementation assertion is absent: ${assertion}`
    );
  }
}

for (const route of LEGACY_REDIRECT_ROUTES) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing legacy redirect screen contract`);
  assert.equal(onboardingExclusions.has(route), true);
  assert.equal(route in PRODUCTION_SCREEN_INTERACTION_CONTRACTS, true);
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), false);
  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(screen.coverage.forms.status, "verified");
  assert.equal(screen.coverage.onboarding.status, "excluded");
}

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const assertion of [
  "listingSchema.parse({",
  "listingReportSchema.parse({",
  "createListingForCurrentUser(current, {",
  "renewListingForCurrentUser(current, listingId)",
  "markListingSoldForCurrentUser(current, listingId)",
  "withdrawListingForCurrentUser(current, listingId)",
]) {
  assert.ok(actionsSource.includes(assertion), `marketplace actions must preserve ${assertion}`);
}

const listingServiceSource = readFileSync("src/lib/listing-service.ts", "utf8");
for (const assertion of [
  "assertPaidFeatureAccess(current);",
  "await assertDogListingAllowed(current, input)",
  "assertListingAcknowledgements(input);",
  "await assertListingMediaAttachable(current, mediaIds);",
  "status: LISTING_STATUS_PENDING_REVIEW",
  "const existing = await getOwnedListing(current, listingId);",
  "if (!SOLD_ALLOWED_FROM_STATUSES.includes(existing.status))",
  "if (!WITHDRAW_ALLOWED_FROM_STATUSES.includes(existing.status))",
  "if (!listing || !listingIsPublic(listing)) throw new Error(\"listing.not_found\")",
  "throw new Error(\"listing.cannot_enquire_own_listing\")",
  "throw new Error(\"listing.cannot_save_own_listing\")",
]) {
  assert.ok(
    listingServiceSource.includes(assertion),
    `marketplace service must preserve ${assertion}`
  );
}

const enquiryRouteSource = readFileSync(
  "src/app/api/listings/[id]/enquiry/route.ts",
  "utf8"
);
for (const assertion of [
  "requireCurrentUserProfile()",
  "const rateLimit = await checkRateLimit(",
  "listingEnquirySchema.parse(await readBoundedJsonRequest(request))",
  "createListingEnquiryForCurrentUser(",
]) {
  assert.ok(
    enquiryRouteSource.includes(assertion),
    `marketplace enquiry endpoint must preserve ${assertion}`
  );
}

const saveRouteSource = readFileSync(
  "src/app/api/listings/[id]/save/route.ts",
  "utf8"
);
for (const assertion of [
  "requireCurrentUserProfile()",
  "const rateLimit = await checkRateLimit(",
  "toggleSavedListingForCurrentUser(current, id)",
]) {
  assert.ok(
    saveRouteSource.includes(assertion),
    `marketplace save endpoint must preserve ${assertion}`
  );
}

console.log(
  "Marketplace interaction coverage passed: 3 canonical action routes, 3 verified form routes, 7 structured forms, canonical onboarding tested and 3 legacy redirects excluded"
);
