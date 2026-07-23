import assert from "node:assert/strict";

import Stripe from "stripe";

import { lagoSubscriptionStatusForUpdate } from "./lago-reducer";
import { stripeUserBillingUpdateForSubscription } from "./stripe-webhooks";

const oldEnv = { ...process.env };

try {
  process.env.STRIPE_APP_URL = "https://greyhoundiq.example";
  process.env.STRIPE_RESTRICTED_KEY = "rk_test_state_machine"; // gitleaks:allow - test sentinel
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_state_machine";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_proMonthly";
  process.env.STRIPE_PRICE_PRO_YEARLY = "price_proYearly";

  assert.equal(lagoSubscriptionStatusForUpdate("pending", "active"), "active");
  assert.equal(
    lagoSubscriptionStatusForUpdate("incomplete", "canceled"),
    "canceled"
  );
  assert.equal(
    lagoSubscriptionStatusForUpdate("active", "terminated"),
    "terminated"
  );
  assert.throws(
    () => lagoSubscriptionStatusForUpdate("active", "pending"),
    /billing\.subscription_transition_illegal:lago/
  );
  assert.throws(
    () => lagoSubscriptionStatusForUpdate(null, "unknown"),
    /billing\.subscription_status_unknown:lago/
  );
  assert.throws(
    () => lagoSubscriptionStatusForUpdate("terminated", "active"),
    /billing\.subscription_transition_illegal:lago/
  );

  const recoveredStripeUpdate = stripeUserBillingUpdateForSubscription(
    subscription("active"),
    "past_due"
  );
  assert.equal(
    "subscriptionTier" in recoveredStripeUpdate,
    false,
    "past_due to active is legal but status alone must not grant paid access"
  );
  const canceledStripeUpdate = stripeUserBillingUpdateForSubscription(
    subscription("canceled"),
    "active"
  );
  assert.equal(canceledStripeUpdate.stripeSubscriptionId, null);
  assert.equal(canceledStripeUpdate.subscriptionTier, "free");
  assert.throws(
    () =>
      stripeUserBillingUpdateForSubscription(
        subscription("incomplete"),
        "active"
      ),
    /billing\.subscription_transition_illegal:stripe/
  );
  assert.throws(
    () =>
      stripeUserBillingUpdateForSubscription(subscription("active"), "canceled"),
    /billing\.subscription_transition_illegal:stripe/
  );
  assert.throws(
    () =>
      stripeUserBillingUpdateForSubscription(
        subscription("future_status" as Stripe.Subscription.Status)
      ),
    /billing\.subscription_status_unknown:stripe/
  );

  console.log("billing subscription state-machine tests passed");
} finally {
  process.env = oldEnv;
}

function subscription(status: Stripe.Subscription.Status) {
  return {
    id: "sub_state_machine",
    object: "subscription",
    customer: "cus_state_machine",
    metadata: { plan: "pro", userId: "user_state_machine" },
    pause_collection: null,
    status,
    items: {
      object: "list",
      data: [{ price: { id: "price_proMonthly" } }],
      has_more: false,
      url: "/v1/subscription_items",
    },
  } as unknown as Stripe.Subscription;
}
