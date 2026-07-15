import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import {
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
} from "./production-screen-commerce-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-COMMERCE-INTERACTIONS

const TEST_ID = PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH = PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_COMMERCE_INTERACTIONS = {
  "/listings": {
    authentication: "optional",
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
    onboarding: "excluded",
    canonicalRoute: "/marketplace",
    sourceAssertions: [
      "const q = parseMarketplaceSearch(params.q);",
      "const category = parseMarketplaceCategory(params.category);",
      "const sort = parseMarketplaceSort(params.sort);",
      "const page = parseMarketplacePage(params.page);",
      'submitted={params.submitted === "review"}',
      "getMarketplaceListings(MARKETPLACE_PAGE_SIZE + 1, {",
      "offset: marketplacePageOffset(page)",
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
  "/listings/[id]": {
    authentication: "optional",
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
      [
        "MARKETPLACE-DETAIL.FORM.WITHDRAW",
        "SERVER ACTION withdrawListing",
      ],
      ["MARKETPLACE-DETAIL.FORM.REPORT", "SERVER ACTION reportListing"],
      [
        "MARKETPLACE-DETAIL.FORM.ENQUIRY",
        "POST /api/listings/[id]/enquiry",
      ],
    ],
    onboarding: "excluded",
    canonicalRoute: "/marketplace/[id]",
    sourceAssertions: [
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
  "/listings/[id]/edit": {
    authentication: "required",
    queryParameters: [],
    actionIds: [
      "MARKETPLACE-EDIT.ACTION.SAVE",
      "MARKETPLACE-EDIT.ACTION.LISTING.OPEN",
    ],
    forms: [["MARKETPLACE-EDIT.FORM.LISTING", "PATCH /api/listings/[id]"]],
    onboarding: "excluded",
    canonicalRoute: "/marketplace/[id]/edit",
    sourceAssertions: [
      "const current = await requireListingEditorProfile(id);",
      'if (!hasTier(current.tier, "pro"))',
      "listing = await getOwnedListingForCurrentUser(current, id);",
      "<ListingEditForm",
    ],
  },
  "/listings/new": {
    authentication: "optional",
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
    onboarding: "excluded",
    canonicalRoute: "/marketplace/new",
    sourceAssertions: [
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
  "/marketplace/[id]/edit": {
    authentication: "required",
    queryParameters: [],
    actionIds: [
      "MARKETPLACE-EDIT.ACTION.SAVE",
      "MARKETPLACE-EDIT.ACTION.LISTING.OPEN",
    ],
    forms: [["MARKETPLACE-EDIT.FORM.LISTING", "PATCH /api/listings/[id]"]],
    onboarding: "tested",
    canonicalRoute: null,
    sourceAssertions: [
      "import ListingEditPage, {",
      'from "../../../listings/[id]/edit/page";',
      "export default ListingEditPage;",
    ],
  },
  "/pricing": {
    authentication: "public",
    queryParameters: ["checkout", "billing", "interval", "plan"],
    actionIds: [
      "PRICING.ACTION.FREE.SIGN-IN",
      "PRICING.ACTION.CHECKOUT.START",
      "PRICING.ACTION.BILLING.OPEN",
      "PRICING.ACTION.PLANS.OPEN",
    ],
    forms: [["PRICING.FORM.CHECKOUT", "POST /api/billing/checkout"]],
    onboarding: "tested",
    canonicalRoute: null,
    sourceAssertions: [
      "const checkout = singleQueryValue(query.checkout);",
      "const billing = singleQueryValue(query.billing);",
      'query.interval === "monthly" || query.interval === "yearly"',
      'query.plan === "pro" && interval',
      '<a href="/account/billing"',
      '<a href="#plans"',
      'href="/sign-in?plan=free"',
      'action="/api/billing/checkout"',
      'name="plan"',
      'name="interval"',
    ],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
  Object.keys(EXPECTED_COMMERCE_INTERACTIONS),
  "the commerce batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_COMMERCE_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
  "the owned module may contain only the reviewed commerce routes",
);
assert.equal(PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES.length, 6);

let actionInventoryCount = 0;
let structuredFormCount = 0;

for (const route of PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES) {
  const expected = EXPECTED_COMMERCE_INTERACTIONS[route];
  const ownedInteraction = PRODUCTION_SCREEN_COMMERCE_INTERACTION_CONTRACTS[route];
  const interaction = Object.entries(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).find(
    ([candidateRoute]) => candidateRoute === route,
  )?.[1];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.authentication, expected.authentication);
  assert.equal(
    onboardingExclusions.has(route),
    expected.onboarding === "excluded",
  );
  assert.equal(screen.coverage.onboarding.status, expected.onboarding);
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), false);
  assert.ok(interaction, `${route}: missing central interaction contract`);
  assert.equal(interaction, ownedInteraction);

  assert.deepEqual(interaction.queryParameters, expected.queryParameters);
  assert.deepEqual(
    interaction.actions.map((candidate) => candidate.id),
    expected.actionIds,
  );
  assert.deepEqual(
    interaction.forms.map((candidate) => [candidate.id, candidate.submitsTo]),
    expected.forms,
  );
  assert.deepEqual(screen.queryParameters, [...expected.queryParameters]);
  assert.deepEqual(screen.primaryActions, [...expected.actionIds]);
  assert.deepEqual(
    screen.forms,
    expected.forms.map(([id, submitsTo]) => `${id} -> ${submitsTo}`),
  );

  if (expected.canonicalRoute) {
    const canonicalInteraction = Object.entries(
      PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
    ).find(([candidateRoute]) => candidateRoute === expected.canonicalRoute)?.[1];
    assert.ok(canonicalInteraction, `${route}: missing canonical interaction`);
    assert.deepEqual(
      interaction.queryParameters,
      canonicalInteraction.queryParameters,
    );
    assert.deepEqual(
      interaction.actions.map((candidate) => candidate.id),
      canonicalInteraction.actions.map((candidate) => candidate.id),
    );
    assert.deepEqual(
      interaction.forms.map((candidate) => [candidate.id, candidate.submitsTo]),
      canonicalInteraction.forms.map((candidate) => [
        candidate.id,
        candidate.submitsTo,
      ]),
    );
  }

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const sourceForms = formSignals.filter((signal) => signal.endsWith(":<form>"));
  assert.equal(
    sourceForms.length,
    expected.forms.length,
    `${route}: every source-owned form must have exactly one manifest entry\n${sourceForms.join("\n")}`,
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified actions require a source-owned interaction signal`,
  );

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(screen.coverage.forms.status, "verified");
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));
  for (const candidate of interaction.actions) {
    assert.ok(candidate.result.length > 0);
    assert.ok(candidate.enforcement && candidate.enforcement.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }
  for (const candidate of interaction.forms) {
    assert.match(candidate.submitsTo, /^(?:GET|POST|PATCH) \/|^SERVER ACTION /);
    assert.ok(candidate.schema && candidate.schema.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }

  const source = readFileSync(screen.sourceFiles[0], "utf8");
  for (const assertion of expected.sourceAssertions) {
    assert.ok(
      source.includes(assertion),
      `${route}: source assertion is absent: ${assertion}`,
    );
  }

  actionInventoryCount += interaction.actions.length;
  structuredFormCount += interaction.forms.length;
}

assert.equal(actionInventoryCount, 31);
assert.equal(structuredFormCount, 10);

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const assertion of [
  "listingSchema.parse({",
  "listingReportSchema.parse({",
  "createListingForCurrentUser(current, {",
  "renewListingForCurrentUser(current, listingId)",
  "markListingSoldForCurrentUser(current, listingId)",
  "withdrawListingForCurrentUser(current, listingId)",
]) {
  assert.ok(
    actionsSource.includes(assertion),
    `commerce actions must preserve ${assertion}`,
  );
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
  'if (!listing || !listingIsPublic(listing)) throw new Error("listing.not_found")',
  'throw new Error("listing.cannot_enquire_own_listing")',
  'throw new Error("listing.cannot_save_own_listing")',
]) {
  assert.ok(
    listingServiceSource.includes(assertion),
    `commerce service must preserve ${assertion}`,
  );
}

const enquiryRouteSource = readFileSync(
  "src/app/api/listings/[id]/enquiry/route.ts",
  "utf8",
);
for (const assertion of [
  "requireCurrentUserProfile()",
  "const rateLimit = await checkRateLimit(",
  "listingEnquirySchema.parse(await readBoundedJsonRequest(request))",
  "createListingEnquiryForCurrentUser(",
]) {
  assert.ok(
    enquiryRouteSource.includes(assertion),
    `listing enquiry endpoint must preserve ${assertion}`,
  );
}

const saveRouteSource = readFileSync(
  "src/app/api/listings/[id]/save/route.ts",
  "utf8",
);
for (const assertion of [
  "requireCurrentUserProfile()",
  "const rateLimit = await checkRateLimit(",
  "toggleSavedListingForCurrentUser(current, id)",
]) {
  assert.ok(
    saveRouteSource.includes(assertion),
    `listing save endpoint must preserve ${assertion}`,
  );
}

const checkoutRouteSource = readFileSync(
  "src/app/api/billing/checkout/route.ts",
  "utf8",
);
for (const assertion of [
  'import { billingCheckoutRequestSchema } from "@/lib/billing/checkout-validation";',
  "const checkoutRequestSchema = billingCheckoutRequestSchema;",
  "assertTrustedOrigin(request, env);",
  "current = await requireCurrentUserProfile();",
  "const rateLimit = await checkRateLimit(",
  "{ failClosed: true }",
  "createStripeCheckoutSession({",
]) {
  assert.ok(
    checkoutRouteSource.includes(assertion),
    `checkout endpoint must preserve ${assertion}`,
  );
}

const checkoutValidationSource = readFileSync(
  "src/lib/billing/checkout-validation.ts",
  "utf8",
);
for (const assertion of [
  'interval: z.enum(["monthly", "yearly"]).default("monthly")',
  'plan: z.literal("pro")',
]) {
  assert.ok(
    checkoutValidationSource.includes(assertion),
    `checkout validation must preserve ${assertion}`,
  );
}

const stripeServiceSource = readFileSync(
  "src/lib/billing/stripe-service.ts",
  "utf8",
);
for (const assertion of [
  "env.prices[plan][interval]",
  "client_reference_id: current.dbUserId",
  'mode: "subscription"',
  "success_url: successUrl.toString()",
  "cancel_url: cancelUrl.toString()",
]) {
  assert.ok(
    stripeServiceSource.includes(assertion),
    `Stripe checkout service must preserve ${assertion}`,
  );
}

console.log(
  "Commerce interaction coverage passed: 6 action routes, 6 verified form routes, 31 action entries, 10 structured forms, onboarding retained",
);
