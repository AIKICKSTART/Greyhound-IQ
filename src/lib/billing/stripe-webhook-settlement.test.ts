import assert from "node:assert/strict";

import Stripe from "stripe";

import {
  stripeCheckoutSettlementForSession,
  stripeInvoicePaidEntitlement,
  stripeUserBillingUpdateForSubscription,
} from "./stripe-webhooks";

const oldEnv = { ...process.env };

try {
  process.env.STRIPE_APP_URL = "https://greyhoundiq.example";
  process.env.STRIPE_RESTRICTED_KEY = "rk_test_settlement"; // gitleaks:allow - test sentinel
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_settlement";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_proMonthly";
  process.env.STRIPE_PRICE_PRO_YEARLY = "price_proYearly";

  const unpaidBespoke = checkoutSession({
    amount_total: 50_000,
    currency: "aud",
    mode: "payment",
    payment_intent: "pi_bespoke",
    payment_status: "unpaid",
    metadata: {
      kind: "bespoke_design",
      profileId: "profile_123",
      userId: "user_123",
      workosUserId: "workos_123",
    },
  });
  assert.equal(
    stripeCheckoutSettlementForSession(unpaidBespoke),
    null,
    "checkout completion must not fulfill a delayed payment"
  );

  const paidBespoke = checkoutSession({
    ...unpaidBespoke,
    payment_status: "paid",
  });
  assert.deepEqual(stripeCheckoutSettlementForSession(paidBespoke), {
    kind: "bespoke_design",
    sessionId: "cs_123",
    userId: "user_123",
    workosUserId: "workos_123",
    profileId: "profile_123",
    customerId: "cus_123",
    paymentIntentId: "pi_bespoke",
    amount: 50_000,
    currency: "aud",
  });

  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        checkoutSession({ ...paidBespoke, amount_total: 49_999 })
      ),
    /stripe\.webhook_checkout_amount_mismatch/
  );
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        checkoutSession({
          ...paidBespoke,
          metadata: { ...paidBespoke.metadata, userId: "other_user" },
        })
      ),
    /stripe\.webhook_user_mismatch/
  );
  assert.throws(
    () =>
      stripeCheckoutSettlementForSession(
        checkoutSession({ ...paidBespoke, mode: "subscription" })
      ),
    /stripe\.webhook_checkout_mode_mismatch/
  );

  const paidSubscriptionCheckout = checkoutSession({
    amount_total: 1_200,
    currency: "aud",
    mode: "subscription",
    payment_status: "paid",
    subscription: "sub_123",
    metadata: {
      plan: "pro",
      userId: "user_123",
      workosUserId: "workos_123",
    },
  });
  assert.deepEqual(
    stripeCheckoutSettlementForSession(paidSubscriptionCheckout),
    {
      kind: "subscription",
      sessionId: "cs_123",
      userId: "user_123",
      workosUserId: "workos_123",
      customerId: "cus_123",
      subscriptionId: "sub_123",
      plan: "pro",
    }
  );

  const paidInvoice = invoice();
  assert.deepEqual(stripeInvoicePaidEntitlement(paidInvoice), {
    customerId: "cus_123",
    subscriptionId: "sub_123",
    userId: "user_123",
    plan: "pro",
  });
  assert.deepEqual(
    stripeInvoicePaidEntitlement(
      invoice({
        parent: {
          type: "subscription_details",
          quote_details: null,
          subscription_details: {
            subscription: "sub_123",
            metadata: { plan: "forged-tier", userId: "user_123" },
          },
        },
      }),
    ),
    {
      customerId: "cus_123",
      subscriptionId: "sub_123",
      userId: "user_123",
      plan: "pro",
    },
    "paid entitlement must come from the allowlisted price rather than metadata",
  );
  assert.throws(
    () => stripeInvoicePaidEntitlement(invoice({ status: "open" })),
    /stripe\.webhook_invoice_not_settled/
  );
  assert.throws(
    () => stripeInvoicePaidEntitlement(invoice({ currency: "usd" })),
    /stripe\.webhook_invoice_currency_mismatch/
  );
  assert.throws(
    () =>
      stripeInvoicePaidEntitlement(
        invoice({ lines: invoiceLines("price_untrusted") })
      ),
    /stripe\.webhook_invoice_price_mismatch/
  );

  const activeSubscription = subscription("active", "price_proMonthly");
  assert.equal(
    "subscriptionTier" in stripeUserBillingUpdateForSubscription(activeSubscription),
    false,
    "subscription status alone must not grant paid access"
  );
  assert.equal(
    stripeUserBillingUpdateForSubscription(
      subscription("past_due", "price_proMonthly")
    ).subscriptionTier,
    "free",
    "unsettled subscription status must revoke paid access"
  );

  console.log("stripe webhook settlement tests passed");
} finally {
  process.env = oldEnv;
}

function checkoutSession(
  overrides: Partial<Stripe.Checkout.Session>
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

function invoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: "in_123",
    object: "invoice",
    amount_paid: 1_200,
    amount_remaining: 0,
    currency: "aud",
    customer: "cus_123",
    lines: invoiceLines("price_proMonthly"),
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: {
        subscription: "sub_123",
        metadata: { plan: "pro", userId: "user_123" },
      },
    },
    status: "paid",
    ...overrides,
  } as unknown as Stripe.Invoice;
}

function invoiceLines(priceId: string): Stripe.ApiList<Stripe.InvoiceLineItem> {
  return {
    object: "list",
    data: [
      {
        id: "il_123",
        object: "line_item",
        currency: "aud",
        subscription: "sub_123",
        pricing: {
          type: "price_details",
          price_details: { price: priceId, product: "prod_pro" },
          unit_amount_decimal: "1200",
        },
      } as unknown as Stripe.InvoiceLineItem,
    ],
    has_more: false,
    url: "/v1/invoices/in_123/lines",
  };
}

function subscription(status: Stripe.Subscription.Status, priceId: string) {
  return {
    id: "sub_123",
    object: "subscription",
    customer: "cus_123",
    metadata: { plan: "pro", userId: "user_123" },
    pause_collection: null,
    status,
    items: {
      object: "list",
      data: [{ price: { id: priceId } }],
      has_more: false,
      url: "/v1/subscription_items",
    },
  } as unknown as Stripe.Subscription;
}
