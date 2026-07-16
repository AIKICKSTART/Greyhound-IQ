import "server-only";

import { createHash, randomUUID } from "node:crypto";
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
    buildStripeCheckoutSessionParams({ current, customerId, env, interval, plan }),
    stripeMutationOptions("subscription-checkout", current.dbUserId),
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
  successUrl.searchParams.set("plan", plan);
  successUrl.searchParams.set("interval", interval);

  const cancelUrl = new URL("/pricing", env.appUrl);
  cancelUrl.searchParams.set("checkout", "cancelled");
  cancelUrl.searchParams.set("plan", plan);
  cancelUrl.searchParams.set("interval", interval);

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

// $500 one-off concierge design package. Inline price_data so no Stripe
// dashboard product is required. Webhook keys off metadata.kind.
export const BESPOKE_DESIGN_PRICE_CENTS = 50_000;

export async function createBespokeDesignCheckoutSession({
  current,
  env,
}: {
  current: StripeBillingUser;
  env: StripeCheckoutEnv;
}) {
  const stripe = getStripeClient(env.secretKey);
  const customerId = await getOrCreateStripeCustomer(current, env);

  const successUrl = new URL("/account/pages", env.appUrl);
  successUrl.searchParams.set("bespoke", "success");
  const cancelUrl = new URL("/account/pages", env.appUrl);
  cancelUrl.searchParams.set("bespoke", "cancelled");

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: current.dbUserId,
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: BESPOKE_DESIGN_PRICE_CENTS,
            product_data: {
              name: "GreyhoundsIQ bespoke design package",
              description:
                "Team-designed business, trainer, punter and up to 5 dog pages.",
            },
          },
        },
      ],
      metadata: {
        kind: "bespoke_design",
        userId: current.dbUserId,
        profileId: current.profileId,
        workosUserId: current.id,
      },
      payment_intent_data: {
        metadata: { kind: "bespoke_design", userId: current.dbUserId },
      },
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    },
    stripeMutationOptions("bespoke-checkout", current.dbUserId),
  );
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

  return getStripeClient(env.secretKey).billingPortal.sessions.create(
    {
      customer: user.stripeCustomerId,
      return_url: returnUrl.toString(),
    },
    stripeMutationOptions("billing-portal", current.dbUserId),
  );
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

  const customer = await getStripeClient(env.secretKey).customers.create(
    {
      email: current.email,
      metadata: {
        userId: current.dbUserId,
        workosUserId: current.id,
      },
      name: current.name,
    },
    stripeCustomerCreationOptions(current.dbUserId),
  );

  await withDbRequestContext(current, (tx) =>
    tx.user.update({
      where: { id: current.dbUserId },
      data: { stripeCustomerId: customer.id },
    })
  );

  return customer.id;
}

type StripeMutationOperation =
  | "bespoke-checkout"
  | "billing-portal"
  | "subscription-checkout";

export function stripeMutationOptions(
  operation: StripeMutationOperation,
  actorId: string,
  nonce: string = randomUUID(),
): Stripe.RequestOptions {
  return {
    idempotencyKey: `ghiq:${operation}:${opaqueActorKey(actorId)}:${nonce}`,
  };
}

export function stripeCustomerCreationOptions(
  actorId: string,
): Stripe.RequestOptions {
  return {
    idempotencyKey: `ghiq:customer:${opaqueActorKey(actorId)}`,
  };
}

function opaqueActorKey(actorId: string) {
  return createHash("sha256").update(actorId, "utf8").digest("hex").slice(0, 24);
}
