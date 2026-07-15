import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-COMMERCE-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
} as const;

const TEST_IDS = [PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.id] as const;

type InteractionContract = {
  queryParameters: readonly string[];
  actions: FamilyScreenManifest["actions"];
  forms: FamilyScreenManifest["forms"];
};

type InteractionAction = FamilyScreenManifest["actions"][number];
type InteractionForm = FamilyScreenManifest["forms"][number];

function action(
  id: string,
  result: string,
  enforcement: string,
): InteractionAction {
  return { id, result, enforcement, testIds: TEST_IDS };
}

function form(id: string, submitsTo: string, schema: string): InteractionForm {
  return { id, submitsTo, schema, testIds: TEST_IDS };
}

const LISTING_EDIT_INTERACTION_CONTRACT = {
  queryParameters: [],
  actions: [
    action(
      "MARKETPLACE-EDIT.ACTION.SAVE",
      "Validates and saves an allowlisted patch for the loaded owned listing.",
      "PATCH /api/listings/[id] requires the current profile, fails closed on its rate limit, parses listingPatchSchema, and updateListingForCurrentUser rechecks ownership before writing.",
    ),
    action(
      "MARKETPLACE-EDIT.ACTION.LISTING.OPEN",
      "Returns to the loaded marketplace listing without saving.",
      "Both same-origin Links derive the destination from the listing identifier returned by the ownership-scoped server lookup.",
    ),
  ],
  forms: [
    form(
      "MARKETPLACE-EDIT.FORM.LISTING",
      "PATCH /api/listings/[id]",
      "listingId:path-bound-owned-listing-id,title:trimmed-string(5..100),description:trimmed-string(20..5000),categoryId?:known-category-id,price?:nonnegative-number,attributes<=8",
    ),
  ],
} as const satisfies InteractionContract;

export const PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES = [
  "/listings",
  "/listings/[id]",
  "/listings/[id]/edit",
  "/listings/new",
  "/marketplace/[id]/edit",
  "/pricing",
] as const;

export const PRODUCTION_SCREEN_COMMERCE_INTERACTION_CONTRACTS = {
  "/listings": {
    queryParameters: ["q", "category", "sort", "page", "submitted"],
    actions: [
      action(
        "MARKETPLACE.ACTION.FILTER",
        "Filters and sorts active marketplace inventory by the submitted search text, category, and bounded sort mode.",
        "The GET form targets /marketplace; ListingsContent parses q, category, sort, and page before the public inventory query returns only active, approved, unarchived, unexpired records.",
      ),
      action(
        "MARKETPLACE.ACTION.CLEAR",
        "Clears the current search, category, sort, and page state.",
        "The fixed same-origin Link returns to /marketplace without query parameters.",
      ),
      action(
        "MARKETPLACE.ACTION.PAGE.CHANGE",
        "Moves through the bounded marketplace result pages while preserving the active filters and sort mode.",
        "MarketplacePagination builds fixed same-origin previous and next links from parsed q, category, sort, and a page value capped by MARKETPLACE_MAX_PAGE.",
      ),
      action(
        "MARKETPLACE.ACTION.LISTING.OPEN",
        "Opens a selected active marketplace item at /marketplace/[id].",
        "Listing destinations use identifiers from the public inventory query and the registered dynamic route owns the destination.",
      ),
      action(
        "MARKETPLACE.ACTION.CREATE.OPEN",
        "Opens the marketplace item creation flow.",
        "The fixed same-origin Link targets /marketplace/new, whose page and server action independently enforce sign-in and Pro eligibility.",
      ),
      action(
        "MARKETPLACE.ACTION.GROUPS.OPEN",
        "Opens the community groups directory from the marketplace introduction.",
        "The fixed same-origin Link targets the registered /groups route.",
      ),
      action(
        "MARKETPLACE.ACTION.PROFILE.OPEN",
        "Opens the public greyhound profile represented by a marketplace player card.",
        "Profile destinations come from loaded listing records or the fixed reviewed showcase catalogue.",
      ),
      action(
        "MARKETPLACE.ACTION.CARD.INSPECT",
        "Flips a marketplace player card or toggles its front information panel.",
        "The card buttons mutate only component-local presentation state and expose pressed state to assistive technology.",
      ),
      action(
        "MARKETPLACE.ACTION.CARD.SAVE",
        "Toggles the visible saved state of an eligible marketplace player card.",
        "Reviewed showcase cards remain local-only; account-mode cards POST the loaded listing identifier to the authenticated, rate-limited save endpoint, which accepts only public non-owned listings.",
      ),
    ],
    forms: [
      form(
        "MARKETPLACE.FORM.FILTER",
        "GET /marketplace",
        "q?:trimmed-string,category?:loaded-category-slug,sort?:allowed-sort,page?:bounded-positive-integer",
      ),
    ],
  },
  "/listings/[id]": {
    queryParameters: [],
    actions: [
      action(
        "MARKETPLACE-DETAIL.ACTION.SAVE.TOGGLE",
        "Saves or unsaves the loaded marketplace item for the signed-in buyer.",
        "POST /api/listings/[id]/save requires the current profile, applies a per-profile/listing rate limit, and permits only public listings not owned by that profile.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.ENQUIRY.SEND",
        "Sends a bounded seller enquiry and opens the resulting Pulse conversation.",
        "POST /api/listings/[id]/enquiry requires the current profile, rate-limits the listing pair, parses listingEnquirySchema, enforces paid access, and rejects non-public or self-owned listings.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.OWNER.RENEW",
        "Returns an eligible owned listing to moderator review.",
        "The server-bound listing identifier is checked by getOwnedListing and renewListingForCurrentUser also requires paid feature access.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.OWNER.SOLD",
        "Marks an active owned listing as sold.",
        "markListingSoldForCurrentUser resolves the listing through the current profile and rejects status transitions outside the sold allowlist.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.OWNER.WITHDRAW",
        "Withdraws an active or pending-review owned listing.",
        "withdrawListingForCurrentUser resolves the listing through the current profile and rejects status transitions outside the withdrawal allowlist.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.REPORT",
        "Submits a bounded marketplace-item report for moderator review.",
        "reportListing requires the current profile, applies a per-profile/listing rate limit, parses the allowlisted reason and optional bounded context, and creates a user-scoped report.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.DOG.OPEN",
        "Opens the registered greyhound linked to the listing.",
        "The destination uses the dog identifier included with the access-checked listing record.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.MARKETPLACE.OPEN",
        "Returns to the marketplace directory.",
        "The fixed same-origin Link targets /marketplace.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.PLAN.OPEN",
        "Opens plan information when the signed-in member cannot message the seller.",
        "The tier-gated branch renders a fixed same-origin Link to /pricing only for a signed-in non-owner without Pro access.",
      ),
      action(
        "MARKETPLACE-DETAIL.ACTION.SIGN-IN.OPEN",
        "Opens sign-in when a visitor wants to message the seller.",
        "The signed-out non-owner branch renders a fixed same-origin anchor to /sign-in.",
      ),
    ],
    forms: [
      form(
        "MARKETPLACE-DETAIL.FORM.RENEW",
        "SERVER ACTION renewListing",
        "listingId:server-bound-owned-listing-id",
      ),
      form(
        "MARKETPLACE-DETAIL.FORM.SOLD",
        "SERVER ACTION markListingSold",
        "listingId:server-bound-owned-listing-id,status:active",
      ),
      form(
        "MARKETPLACE-DETAIL.FORM.WITHDRAW",
        "SERVER ACTION withdrawListing",
        "listingId:server-bound-owned-listing-id,status:active|pending_review",
      ),
      form(
        "MARKETPLACE-DETAIL.FORM.REPORT",
        "SERVER ACTION reportListing",
        "listingId:server-bound-listing-id,reason:spam|harassment|misinformation|illegal|other,description?:trimmed-string<=500",
      ),
      form(
        "MARKETPLACE-DETAIL.FORM.ENQUIRY",
        "POST /api/listings/[id]/enquiry",
        "listingId:path-bound-public-listing-id,message:trimmed-string(5..2000)",
      ),
    ],
  },
  "/listings/[id]/edit": LISTING_EDIT_INTERACTION_CONTRACT,
  "/listings/new": {
    queryParameters: ["dogId", "title", "price"],
    actions: [
      action(
        "MARKETPLACE-CREATE.ACTION.SUBMIT",
        "Submits a new marketplace item for moderator review and returns to the directory with review feedback.",
        "createListing requires the current profile and parses listingSchema; createListingForCurrentUser enforces paid access, dog and category rules, required acknowledgements, attachable media, moderation checks, and pending-review persistence.",
      ),
      action(
        "MARKETPLACE-CREATE.ACTION.MARKETPLACE.OPEN",
        "Returns to the marketplace directory without submitting.",
        "The fixed same-origin Link targets /marketplace.",
      ),
      action(
        "MARKETPLACE-CREATE.ACTION.PLAN.OPEN",
        "Opens plan information for a signed-in member without listing access.",
        "The non-Pro branch renders a fixed same-origin Link to /pricing, while the server-side create path independently enforces paid access.",
      ),
      action(
        "MARKETPLACE-CREATE.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to create an item.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in; the server action independently requires the current profile.",
      ),
    ],
    forms: [
      form(
        "MARKETPLACE-CREATE.FORM.LISTING",
        "SERVER ACTION createListing",
        "type:listing-type,categoryId?:known-category-id,title:trimmed-string(5..100),description:trimmed-string(20..5000),price?:nonnegative-number,mediaIds<=11,attributes<=8,welfareAcknowledged:true,legalAcknowledged:true",
      ),
    ],
  },
  "/marketplace/[id]/edit": LISTING_EDIT_INTERACTION_CONTRACT,
  "/pricing": {
    queryParameters: ["checkout", "billing", "interval", "plan"],
    actions: [
      action(
        "PRICING.ACTION.FREE.SIGN-IN",
        "Opens sign-in with the free plan selected.",
        "Both free-plan anchors use the fixed same-origin /sign-in?plan=free destination; the sign-in route owns authentication and return handling.",
      ),
      action(
        "PRICING.ACTION.CHECKOUT.START",
        "Starts monthly or yearly Pro checkout, including an eligible retry.",
        "POST /api/billing/checkout validates the literal Pro plan and interval enum, enforces trusted origin, requires or redirects to sign-in, fails closed on its per-user rate limit, and maps the selection to server-held Stripe price identifiers.",
      ),
      action(
        "PRICING.ACTION.BILLING.OPEN",
        "Opens billing after a trusted checkout return.",
        "The checkout-success branch renders a fixed same-origin anchor to /account/billing; billing independently requires the current profile.",
      ),
      action(
        "PRICING.ACTION.PLANS.OPEN",
        "Returns a cancelled or unavailable checkout outcome to the plan selector.",
        "The outcome branch uses the fixed same-page #plans anchor and never treats a return query as billing confirmation.",
      ),
    ],
    forms: [
      form(
        "PRICING.FORM.CHECKOUT",
        "POST /api/billing/checkout",
        "plan:pro,interval:monthly|yearly",
      ),
    ],
  },
} as const satisfies Readonly<Record<string, InteractionContract>>;
