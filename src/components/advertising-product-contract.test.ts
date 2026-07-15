import assert from "node:assert/strict";

import {
  ADVERTISING_ADMIN_CONTROLS,
  ADVERTISING_CAMPAIGN_STATES,
  ADVERTISING_CREATIVE_RULES,
  ADVERTISING_GLOBAL_DELIVERY_RULES,
  ADVERTISING_PAYMENT_CONTRACT,
  ADVERTISING_PLACEMENTS,
  ADVERTISING_PRIVACY_RULES,
  ADVERTISING_RATE_CARD,
  ADVERTISING_USER_STORIES,
  MARKETPLACE_BOOST_PACKAGES,
  MARKETPLACE_BOOST_RULES,
  quoteAdvertisingCampaign,
} from "./advertising-product-contract";

assert.equal(new Set(ADVERTISING_PLACEMENTS.map((item) => item.id)).size, 3);
for (const placement of ADVERTISING_PLACEMENTS) {
  assert.ok(placement.desktop.includes("×"));
  assert.ok(placement.mobile.includes("×"));
  assert.ok(placement.baseViewableCpmCents > 0);
  assert.ok(placement.minimumViewableImpressions >= 1_000);
  assert.ok(placement.minimumOrganicGap >= 4);
  assert.ok(placement.maximumPerSession >= 1);
  assert.ok(placement.sameCampaignPerPersonPerDay >= 1);
}
assert.equal(ADVERTISING_RATE_CARD.currency, "AUD");
assert.equal(ADVERTISING_RATE_CARD.publicPricesIncludeGst, true);
assert.equal(ADVERTISING_RATE_CARD.quoteLockMinutes, 30);
assert.equal(
  ADVERTISING_RATE_CARD.maximumCampaignViewableImpressions,
  10_000_000
);
assert.deepEqual(
  ADVERTISING_RATE_CARD.publishedVolumeDiscountBasisPoints,
  [0, 500, 1_000, 1_500]
);

const minimumQuote = quoteAdvertisingCampaign({
  placementId: "FEED_INLINE",
  viewableImpressions: 1,
});
assert.equal(minimumQuote.bookedImpressions, 10_000);
assert.equal(minimumQuote.totalCentsIncludingGst, 27_500);

const premiumQuote = quoteAdvertisingCampaign({
  placementId: "FEED_BILLBOARD",
  viewableImpressions: 20_000,
  targetingMultiplierBasisPoints: 11_500,
  peakMultiplierBasisPoints: 12_000,
  volumeDiscountBasisPoints: 500,
});
assert.equal(premiumQuote.totalCentsIncludingGst, 115_368);
assert.equal(
  premiumQuote.subtotalCentsExcludingGst + premiumQuote.gstCents,
  premiumQuote.totalCentsIncludingGst
);

const singleRoundingQuote = quoteAdvertisingCampaign({
  placementId: "FEED_INLINE",
  viewableImpressions: 10_001,
  targetingMultiplierBasisPoints: 11_500,
  peakMultiplierBasisPoints: 12_000,
  volumeDiscountBasisPoints: 500,
});
const singleRoundingNumerator =
  BigInt(10_001) *
  BigInt(2_750) *
  BigInt(11_500) *
  BigInt(12_000) *
  BigInt(9_500);
const singleRoundingDenominator =
  BigInt(1_000) * BigInt(10_000) * BigInt(10_000) * BigInt(10_000);
assert.equal(
  singleRoundingQuote.totalCentsIncludingGst,
  Number(
    (singleRoundingNumerator + singleRoundingDenominator - BigInt(1)) /
      singleRoundingDenominator
  ),
  "the quote must round once after the complete BigInt calculation"
);

const maximumQuote = quoteAdvertisingCampaign({
  placementId: "FEED_INLINE",
  viewableImpressions: 10_000_000,
});
assert.equal(maximumQuote.bookedImpressions, 10_000_000);
assert.ok(Number.isSafeInteger(maximumQuote.totalCentsIncludingGst));

for (const invalidViewableImpressions of [
  1.5,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
]) {
  assert.throws(
    () =>
      quoteAdvertisingCampaign({
        placementId: "FEED_INLINE",
        viewableImpressions: invalidViewableImpressions,
      }),
    /positive integer/
  );
}
assert.throws(
  () =>
    quoteAdvertisingCampaign({
      placementId: "FEED_INLINE",
      viewableImpressions: 10_000_001,
    }),
  /published campaign maximum/
);

for (const unpublishedFactors of [
  { targetingMultiplierBasisPoints: 11_000 },
  { peakMultiplierBasisPoints: 11_000 },
  { volumeDiscountBasisPoints: 250 },
]) {
  assert.throws(
    () =>
      quoteAdvertisingCampaign({
        placementId: "FEED_INLINE",
        viewableImpressions: 10_000,
        ...unpublishedFactors,
      }),
    /outside the published bounds/
  );
}
assert.throws(
  () =>
    quoteAdvertisingCampaign({
      placementId: "FEED_INLINE",
      viewableImpressions: 10_000,
      volumeDiscountBasisPoints: 2_000,
    }),
  /outside the published bounds/
);

assert.equal(new Set(MARKETPLACE_BOOST_PACKAGES.map((item) => item.id)).size, 3);
for (let index = 1; index < MARKETPLACE_BOOST_PACKAGES.length; index += 1) {
  const previous = MARKETPLACE_BOOST_PACKAGES[index - 1];
  const current = MARKETPLACE_BOOST_PACKAGES[index];
  assert.ok(current.viewableImpressions > previous.viewableImpressions);
  assert.ok(
    current.priceCentsIncludingGst / current.viewableImpressions <
      previous.priceCentsIncludingGst / previous.viewableImpressions,
    "larger boost packages must have a lower effective viewable-impression price"
  );
}

assert.equal(new Set(ADVERTISING_USER_STORIES.map((story) => story.id)).size, 8);
assert.equal(
  ADVERTISING_USER_STORIES.reduce(
    (total, story) => total + story.acceptance.length,
    0
  ),
  16
);
for (const story of ADVERTISING_USER_STORIES) {
  assert.match(story.id, /^ADS\.STORY\.[A-Z0-9-]+$/);
  assert.ok(story.actor.length >= 10);
  assert.ok(story.outcome.length >= 50);
  assert.equal(story.acceptance.length, 2);
  for (const scenario of story.acceptance) {
    assert.ok(scenario.given.length >= 30);
    assert.ok(scenario.when.length >= 30);
    assert.ok(scenario.then.length >= 30);
  }
}

assert.ok(ADVERTISING_CREATIVE_RULES.some((rule) => rule.includes("Sponsored")));
assert.ok(ADVERTISING_CREATIVE_RULES.some((rule) => rule.includes("Wagering")));
assert.ok(MARKETPLACE_BOOST_RULES.some((rule) => rule.includes("own approved")));
assert.ok(MARKETPLACE_BOOST_RULES.some((rule) => rule.includes("equal rotation")));
assert.ok(
  MARKETPLACE_BOOST_RULES.some((rule) =>
    rule.includes("rechecked at every decision and impression")
  )
);

const globalDeliveryContract = ADVERTISING_GLOBAL_DELIVERY_RULES.join(" ");
assert.match(globalDeliveryContract, /three modules per twenty organic Feed entries/);
assert.match(globalDeliveryContract, /at most four paid modules per session/);
assert.match(globalDeliveryContract, /rechecked at decision and impression time/);
assert.match(globalDeliveryContract, /signed idempotent token/);

const privacyContract = ADVERTISING_PRIVACY_RULES.join(" ");
assert.match(privacyContract, /never expose raw account IDs/);
assert.match(privacyContract, /Do not retain raw IP addresses/);
assert.match(privacyContract, /expire within 48 hours/);
assert.match(privacyContract, /within 30 days/);
assert.match(privacyContract, /retained for 24 months/);
assert.match(privacyContract, /for five years/);
assert.match(privacyContract, /opt out of non-essential personalization/);
assert.match(privacyContract, /cross-site tracking/);

const paymentContract = ADVERTISING_PAYMENT_CONTRACT.join(" ");
assert.match(paymentContract, /payment-mode Stripe Checkout Session/);
assert.match(paymentContract, /order-and-quote idempotency key/);
assert.match(paymentContract, /subtotal, GST, total and tax-invoice fields/);
assert.match(paymentContract, /signed idempotent webhook/);
assert.match(paymentContract, /configured test or live environment/);
assert.match(paymentContract, /status complete, payment_status paid, mode payment/);
assert.match(paymentContract, /expected AUD amount/);
assert.match(paymentContract, /30-minute expiry/);
assert.match(paymentContract, /Late or mismatched payments enter review/);
assert.ok(ADVERTISING_ADMIN_CONTROLS.some((rule) => rule.includes("kill switch")));
assert.ok(ADVERTISING_CAMPAIGN_STATES.includes("refunded"));
assert.ok(ADVERTISING_CAMPAIGN_STATES.includes("late-payment-review"));
assert.ok(ADVERTISING_CAMPAIGN_STATES.includes("payment-mismatch-review"));

console.log("Advertising product contract tests passed");
