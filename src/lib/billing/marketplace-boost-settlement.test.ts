import assert from "node:assert/strict";

import Stripe from "stripe";

import {
  MARKETPLACE_BOOST_PACKAGES,
  findMarketplaceBoostPackage,
} from "@/components/advertising-product-contract";
import { stripeCheckoutSettlementForSession } from "./stripe-webhooks";

const oldEnv = { ...process.env };

try {
  process.env.STRIPE_APP_URL = "https://greyhoundiq.example";
  process.env.STRIPE_RESTRICTED_KEY = "rk_test_boost"; // gitleaks:allow - test sentinel
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_boost";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_proMonthly";
  process.env.STRIPE_PRICE_PRO_YEARLY = "price_proYearly";

  // Server-side package lookup is the single source of price truth.
  assert.equal(findMarketplaceBoostPackage("BOOST.STARTER")?.id, "BOOST.STARTER");
  assert.equal(findMarketplaceBoostPackage("BOOST.NOPE"), null);
  assert.equal(findMarketplaceBoostPackage(null), null);
  const starter = MARKETPLACE_BOOST_PACKAGES[0];
  assert.equal(starter.priceCentsIncludingGst, 2_900);

  const paidBoost = boostSession({
    amount_total: starter.priceCentsIncludingGst,
    currency: "aud",
    mode: "payment",
    payment_status: "paid",
    payment_intent: "pi_boost",
    metadata: {
      kind: "marketplace_boost",
      listingId: "listing_123",
      packageId: "BOOST.STARTER",
      profileId: "profile_123",
      userId: "user_123",
      workosUserId: "workos_123",
    },
  });
  assert.deepEqual(stripeCheckoutSettlementForSession(paidBoost), {
    kind: "marketplace_boost",
    sessionId: "cs_123",
    userId: "user_123",
    workosUserId: "workos_123",
    profileId: "profile_123",
    customerId: "cus_123",
    paymentIntentId: "pi_boost",
    listingId: "listing_123",
    packageId: "BOOST.STARTER",
    amount: 2_900,
    currency: "aud",
  });

  // Delayed payment methods complete before funds settle → do not activate.
  assert.equal(
    stripeCheckoutSettlementForSession(
      boostSession({ ...paidBoost, payment_status: "unpaid" }),
    ),
    null,
    "unpaid boost checkout must not settle",
  );

  // Server-side pricing: a tampered amount fails closed.
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        boostSession({ ...paidBoost, amount_total: 2_901 }),
      ),
    /stripe\.webhook_checkout_amount_mismatch/,
  );
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        boostSession({ ...paidBoost, currency: "usd" }),
      ),
    /stripe\.webhook_checkout_amount_mismatch/,
  );

  // Package validation: unknown or missing package fails closed.
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        boostSession({
          ...paidBoost,
          metadata: { ...paidBoost.metadata, packageId: "BOOST.NOPE" },
        }),
      ),
    /stripe\.webhook_checkout_package_mismatch/,
  );

  // Mode must be a one-time payment.
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        boostSession({ ...paidBoost, mode: "subscription" }),
      ),
    /stripe\.webhook_checkout_mode_mismatch/,
  );

  // Required binding metadata must be present.
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        boostSession({
          ...paidBoost,
          metadata: { ...paidBoost.metadata, listingId: "" },
        }),
      ),
    /stripe\.webhook_missing_listing/,
  );
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        boostSession({
          ...paidBoost,
          metadata: { ...paidBoost.metadata, profileId: "" },
        }),
      ),
    /stripe\.webhook_missing_profile/,
  );
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        boostSession({
          ...paidBoost,
          client_reference_id: "user_123",
          metadata: { ...paidBoost.metadata, userId: "other_user" },
        }),
      ),
    /stripe\.webhook_user_mismatch/,
  );

  console.log("marketplace boost settlement tests passed");
} finally {
  process.env = oldEnv;
}

function boostSession(
  overrides: Partial<Stripe.Checkout.Session>,
): Stripe.Checkout.Session {
  return {
    id: "cs_123",
    object: "checkout.session",
    client_reference_id: "user_123",
    customer: "cus_123",
    status: "complete",
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}
