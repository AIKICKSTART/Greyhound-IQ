import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import Stripe from "stripe";

import { getStripeCheckoutEnv } from "./stripe-env";
import {
  buildStripeCheckoutSessionParams,
  stripeCustomerCreationOptions,
  stripeMutationOptions,
  type StripeBillingUser,
} from "./stripe-service";
import {
  StripeWebhookError,
  stripeUserBillingUpdateForCheckoutSession,
  stripeUserBillingUpdateForSubscription,
  verifyStripeWebhook,
} from "./stripe-webhooks";

const oldEnv = { ...process.env };

try {
  process.env.STRIPE_APP_URL = "https://greyhoundiq.example";
  process.env.STRIPE_RESTRICTED_KEY = "rk_test_123456789"; // gitleaks:allow - test sentinel
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_123";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_proMonthly";
  process.env.STRIPE_PRICE_PRO_YEARLY = "price_proYearly";
  process.env.STRIPE_PRICE_PRO_PLUS_MONTHLY = "price_proPlusMonthly";
  process.env.STRIPE_PRICE_PRO_PLUS_YEARLY = "price_proPlusYearly";

  const env = getStripeCheckoutEnv();
  assert.deepEqual(Object.keys(env.prices), ["pro"]);

  const current: StripeBillingUser = {
    dbUserId: "user_123",
    email: "billing-test@example.invalid",
    id: "workos_123",
    name: "Billing Test",
    profileId: "profile_123",
    profileRole: "owner",
    tier: "free",
  };
  const monthly = buildStripeCheckoutSessionParams({
    current,
    customerId: "cus_123",
    env,
    interval: "monthly",
    plan: "pro",
  });
  const yearly = buildStripeCheckoutSessionParams({
    current,
    customerId: "cus_123",
    env,
    interval: "yearly",
    plan: "pro",
  });

  assert.equal(monthly.mode, "subscription");
  assert.equal(monthly.line_items?.[0]?.price, "price_proMonthly");
  assert.equal(yearly.line_items?.[0]?.price, "price_proYearly");
  assert.equal(Object.hasOwn(monthly, "payment_method_types"), false);
  assert.equal(monthly.metadata?.plan, "pro");
  assert.equal(monthly.subscription_data?.metadata?.plan, "pro");
  const retryOptions = stripeMutationOptions(
    "subscription-checkout",
    current.dbUserId,
    "fixed-test-nonce",
  );
  assert.match(
    retryOptions.idempotencyKey ?? "",
    /^ghiq:subscription-checkout:[a-f0-9]{24}:fixed-test-nonce$/,
  );
  assert.equal(retryOptions.idempotencyKey?.includes(current.dbUserId), false);
  assert.deepEqual(stripeCustomerCreationOptions(current.dbUserId), {
    idempotencyKey: "ghiq:customer:80fba0ae1c48e3978e43e4ef",
  });

  const monthlySuccessUrl = new URL(monthly.success_url ?? "");
  assert.equal(monthlySuccessUrl.pathname, "/account/billing");
  assert.equal(monthlySuccessUrl.searchParams.get("checkout"), "success");
  assert.equal(monthlySuccessUrl.searchParams.get("plan"), "pro");
  assert.equal(monthlySuccessUrl.searchParams.get("interval"), "monthly");

  const yearlyCancelUrl = new URL(yearly.cancel_url ?? "");
  assert.equal(yearlyCancelUrl.pathname, "/pricing");
  assert.equal(yearlyCancelUrl.searchParams.get("checkout"), "cancelled");
  assert.equal(yearlyCancelUrl.searchParams.get("plan"), "pro");
  assert.equal(yearlyCancelUrl.searchParams.get("interval"), "yearly");

  const checkoutRoute = readFileSync(
    new URL("../../app/api/billing/checkout/route.ts", import.meta.url),
    "utf8"
  );
  const checkoutValidation = readFileSync(
    new URL("./checkout-validation.ts", import.meta.url),
    "utf8",
  );
  assert.match(checkoutValidation, /plan:\s*z\.literal\("pro"\)/);
  assert.match(
    checkoutRoute,
    /const checkoutRequestSchema = billingCheckoutRequestSchema/,
  );
  assert.match(
    checkoutRoute,
    /checkoutRequestSchema\.parse\(\s*await readBoundedJsonOrFormRequest\(request\),?\s*\)/,
  );
  assert.doesNotMatch(checkoutRoute, /pro_plus|Pro\+/);
  assert.match(checkoutRoute, /returnTo\.searchParams\.set\("interval", parsed\.interval\)/);
  assert.match(checkoutRoute, /returnTo\.searchParams\.set\("checkout", "continue"\)/);

  const signInRoute = readFileSync(
    new URL("../../app/sign-in/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(signInRoute, /resolveWorkosReturnTo/);
  assert.match(signInRoute, /returnTo: request\.nextUrl\.searchParams\.get\("returnTo"\)/);
  assert.doesNotMatch(signInRoute, /api\/billing\/checkout/);

  const pricingPage = readFileSync(
    new URL("../../app/pricing/page.tsx", import.meta.url),
    "utf8"
  );
  assert.match(pricingPage, /plan:\s*"pro";/);
  assert.match(pricingPage, /plan\.id === "pro_plus"[\s\S]*disabled/);
  assert.match(pricingPage, /Checkout cancelled — no plan change was made/);
  assert.match(pricingPage, /No Stripe billing profile yet/);
  assert.match(pricingPage, /Retry Pro/);

  const accountPage = readFileSync(
    new URL("../../app/account/page.tsx", import.meta.url),
    "utf8"
  );
  assert.match(accountPage, /action="\/api\/billing\/checkout"/);
  assert.match(accountPage, /method="post"/);
  assert.match(accountPage, /Continue to secure checkout/);
  assert.match(accountPage, /Signing in never starts a payment/);

  const accountBillingPage = readFileSync(
    new URL("../../app/account/billing/page.tsx", import.meta.url),
    "utf8"
  );
  assert.match(accountBillingPage, /Returned from Stripe Checkout/);
  assert.match(accountBillingPage, /Returned from the secure Stripe billing portal/);
  assert.match(accountBillingPage, /No Stripe billing profile yet/);

  const managedPages = readFileSync(
    new URL("../../app/account/pages/page.tsx", import.meta.url),
    "utf8"
  );
  assert.match(managedPages, /Bespoke checkout return received/);
  assert.match(managedPages, /Bespoke checkout cancelled/);
  assert.match(managedPages, /id="bespoke-design"/);

  const billingHealthRoute = readFileSync(
    new URL("../../app/api/health/billing/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(billingHealthRoute, /getStripeCheckoutEnv/);
  assert.match(billingHealthRoute, /getStripeWebhookEnv/);
  assert.match(billingHealthRoute, /lagoBilling/);

  assert.throws(
    () => verifyStripeWebhook(new Headers(), Buffer.from("{}")),
    (err) => err instanceof StripeWebhookError && err.status === 401
  );

  const payload = JSON.stringify({
    id: "evt_checkout_pro",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        object: "checkout.session",
        client_reference_id: "user_123",
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { plan: "pro" },
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const event = verifyStripeWebhook(
    new Headers({ "stripe-signature": signature }),
    Buffer.from(payload)
  );
  assert.equal(event.type, "checkout.session.completed");

  assert.throws(
    () =>
      verifyStripeWebhook(
        new Headers({ "stripe-signature": signature }),
        Buffer.from(`${payload}\n`)
      ),
    (err) => err instanceof StripeWebhookError && err.status === 401,
    "signature verification must use the exact raw request bytes"
  );

  const staleSignature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  assert.throws(
    () =>
      verifyStripeWebhook(
        new Headers({ "stripe-signature": staleSignature }),
        Buffer.from(payload)
      ),
    (err) => err instanceof StripeWebhookError && err.status === 401,
    "signed events outside Stripe's freshness window must be rejected"
  );

  const checkoutUpdate = stripeUserBillingUpdateForCheckoutSession(
    event.data.object as Stripe.Checkout.Session
  );
  assert.equal(checkoutUpdate.stripeCustomerId, "cus_123");
  assert.equal(checkoutUpdate.stripeSubscriptionId, "sub_123");
  assert.equal(
    "subscriptionTier" in checkoutUpdate,
    false,
    "checkout completion metadata must not grant paid access"
  );

  const proPlusCheckoutUpdate = stripeUserBillingUpdateForCheckoutSession({
    metadata: { plan: "pro_plus" },
  } as unknown as Stripe.Checkout.Session);
  assert.equal("subscriptionTier" in proPlusCheckoutUpdate, false);

  const canceledUpdate = stripeUserBillingUpdateForSubscription({
    id: "sub_123",
    customer: "cus_123",
    status: "canceled",
    metadata: { plan: "pro" },
    pause_collection: null,
    items: { data: [] },
  } as unknown as Stripe.Subscription);
  assert.equal(canceledUpdate.subscriptionTier, "free");
  assert.equal(canceledUpdate.stripeSubscriptionId, null);

  const proPlusSubscriptionUpdate = stripeUserBillingUpdateForSubscription({
    id: "sub_456",
    customer: "cus_123",
    status: "active",
    metadata: { plan: "pro_plus" },
    pause_collection: null,
    items: { data: [] },
  } as unknown as Stripe.Subscription);
  assert.equal(proPlusSubscriptionUpdate.subscriptionTier, "free");

  console.log("stripe readiness tests passed");
} finally {
  process.env = oldEnv;
}
