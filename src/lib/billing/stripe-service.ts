import "server-only";

import type Stripe from "stripe";

import { getStripeClient } from "@/lib/billing/stripe-client";
import {
  type StripeBillingInterval,
  type StripeCheckoutPlan,
  type StripeCheckoutEnv,
} from "@/lib/billing/stripe-env";
import { withDbRequestContext, type DbContextUser } from "@/lib/db-context";

export type StripeBillingUser = DbContextUser & {
  dbUserId: string;
  email: string;
  id: string;
  name: string;
};

export async function createStripeCheckoutSession({
  current,
  env,
  interval,
  plan,
}: {
  current: StripeBillingUser;
  env: StripeCheckoutEnv;
  interval: StripeBillingInterval;
  plan: StripeCheckoutPlan;
}) {
  const stripe = getStripeClient(env.secretKey);
  const customerId = await getOrCreateStripeCustomer(current, env);

  return stripe.checkout.sessions.create(
    buildStripeCheckoutSessionParams({ current, customerId, env, interval, plan })
  );
}

export function buildStripeCheckoutSessionParams({
  current,
  customerId,
  env,
  interval,
  plan,
}: {
  current: StripeBillingUser;
  customerId: string;
  env: StripeCheckoutEnv;
  interval: StripeBillingInterval;
  plan: StripeCheckoutPlan;
}): Stripe.Checkout.SessionCreateParams {
  const successUrl = new URL("/account/billing", env.appUrl);
  successUrl.searchParams.set("checkout", "success");

  const cancelUrl = new URL("/pricing", env.appUrl);
  cancelUrl.searchParams.set("checkout", "cancelled");
  cancelUrl.searchParams.set("plan", plan);

  return {
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    client_reference_id: current.dbUserId,
    customer: customerId,
    customer_update: {
      address: "auto",
      name: "auto",
    },
    line_items: [{ price: env.prices[plan][interval], quantity: 1 }],
    metadata: {
      interval,
      plan,
      userId: current.dbUserId,
      workosUserId: current.id,
    },
    mode: "subscription",
    subscription_data: {
      metadata: {
        interval,
        plan,
        userId: current.dbUserId,
        workosUserId: current.id,
      },
    },
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
  };
}

export async function createStripePortalSession({
  current,
  env,
}: {
  current: StripeBillingUser;
  env: StripeCheckoutEnv;
}) {
  const user = await withDbRequestContext(current, (tx) =>
    tx.user.findUnique({
      where: { id: current.dbUserId },
      select: { stripeCustomerId: true },
    })
  );
  if (!user?.stripeCustomerId) return null;

  const returnUrl = new URL("/account/billing", env.appUrl);
  returnUrl.searchParams.set("portal", "returned");

  return getStripeClient(env.secretKey).billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl.toString(),
  });
}

async function getOrCreateStripeCustomer(
  current: StripeBillingUser,
  env: StripeCheckoutEnv
) {
  const user = await withDbRequestContext(current, (tx) =>
    tx.user.findUnique({
      where: { id: current.dbUserId },
      select: { stripeCustomerId: true },
    })
  );
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripeClient(env.secretKey).customers.create({
    email: current.email,
    metadata: {
      userId: current.dbUserId,
      workosUserId: current.id,
    },
    name: current.name,
  });

  await withDbRequestContext(current, (tx) =>
    tx.user.update({
      where: { id: current.dbUserId },
      data: { stripeCustomerId: customer.id },
    })
  );

  return customer.id;
}
