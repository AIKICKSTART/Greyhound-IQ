import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Source-marker contract tests (no DB / no network): assert the launch-critical
// guards and figures are present in source. The runtime settlement/pricing logic
// is covered by marketplace-boost-settlement.test.ts.

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

// --- Boost checkout route: auth, package validation, no client-supplied price.
const route = read("src/app/api/billing/boost/checkout/route.ts");
assert.ok(route.includes("requireCurrentUserProfile"), "route must require auth");
assert.ok(
  route.includes("createMarketplaceBoostCheckoutSession"),
  "route must delegate to the server-side boost service",
);
assert.ok(
  route.includes("z.enum(boostPackageIds)"),
  "route must validate packageId against the server package enum",
);
assert.ok(
  route.includes("checkRateLimit"),
  "route must rate limit checkout starts",
);
assert.ok(
  route.includes("assertTrustedOrigin"),
  "route must enforce a trusted origin",
);
assert.ok(
  !route.includes("unit_amount"),
  "route must not set a price — pricing is server-side in the service",
);
assert.ok(
  !/\bamount\b/.test(route),
  "route must not read an amount from the request",
);

// --- Boost service: tier gate, ownership, server-side pricing, eligibility.
const service = read("src/lib/billing/marketplace-boost-service.ts");
assert.ok(
  service.includes("assertPaidFeatureAccess"),
  "service must gate boosts behind a paid tier",
);
assert.ok(
  service.includes("profileId: current.profileId"),
  "service must scope the listing fetch to the owner",
);
assert.ok(
  service.includes("findMarketplaceBoostPackage") &&
    service.includes("pkg.priceCentsIncludingGst"),
  "service must resolve price from the server package, not the client",
);
assert.ok(
  service.includes('status !== "active"') &&
    service.includes('moderationStatus !== "approved"'),
  "service must require an active, approved listing",
);
assert.ok(service.includes('mode: "payment"'), "boost is a one-time payment");

// --- Webhook: idempotent PaymentRecord ledger + deferred activation seam.
const webhooks = read("src/lib/billing/stripe-webhooks.ts");
assert.ok(
  webhooks.includes("recordMarketplaceBoostPurchase") &&
    webhooks.includes("pspPaymentId: settlement.paymentIntentId"),
  "webhook must record an idempotent PaymentRecord for boosts",
);
assert.ok(
  webhooks.includes("activateListingBoost"),
  "webhook must route boost activation through the storage seam",
);

// --- Public /advertise page: rate card, GST, boosts, CTAs.
const advertise = read("src/app/advertise/page.tsx");
assert.ok(advertise.includes("advertising-product-contract"), "page uses the contract");
assert.ok(advertise.includes("ADVERTISING_PLACEMENTS"), "page renders placements");
assert.ok(advertise.includes("MARKETPLACE_BOOST_PACKAGES"), "page renders boosts");
assert.ok(advertise.includes("formatAud"), "page formats AUD prices");
assert.ok(advertise.includes("GST"), "page labels GST inclusivity");
assert.ok(advertise.includes("Book a campaign"), "page has the contact CTA");
assert.ok(advertise.includes("/contact"), "page links the contact route");
assert.ok(advertise.includes("/advertise/policy"), "page links the policy");

// --- Advertising policy page: viewability, organic gap, creative, refunds.
const policy = read("src/app/advertise/policy/page.tsx");
assert.ok(policy.includes("ADVERTISING_CREATIVE_RULES"), "policy restates creative rules");
assert.ok(policy.includes("viewabilityRule"), "policy defines viewability");
assert.ok(policy.includes("organic"), "policy covers organic-gap protections");
assert.ok(policy.includes("Sponsored"), "policy names the Sponsored label");
assert.ok(policy.includes("Refunds") && policy.includes("cancel"), "policy covers refund/cancellation");

// --- Sponsored card: label + documented Feed wiring contract.
const card = read("src/components/feed-sponsored-card.tsx");
assert.ok(card.includes("Sponsored"), "card renders the Sponsored label");
assert.ok(
  card.includes("minimumOrganicGap") && card.includes("maximumPerSession"),
  "card header documents the organic-gap and per-session wiring contract",
);
assert.ok(card.includes("FEED_INLINE"), "card documents the FEED_INLINE placement");

console.log("advertise + boost contract source-marker tests passed");
