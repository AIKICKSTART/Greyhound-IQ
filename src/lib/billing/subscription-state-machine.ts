import "server-only";

import type Stripe from "stripe";

export type LagoSubscriptionStatus =
  | "pending"
  | "active"
  | "terminated"
  | "canceled"
  | "incomplete";

type BillingSubscriptionProvider = "stripe" | "lago";

const STRIPE_STATUS_TRANSITIONS: Readonly<
  Record<Stripe.Subscription.Status, readonly Stripe.Subscription.Status[]>
> = {
  incomplete: ["active", "incomplete_expired", "canceled"],
  incomplete_expired: [],
  trialing: ["active", "past_due", "paused", "canceled"],
  active: ["trialing", "past_due", "paused", "canceled"],
  past_due: ["active", "unpaid", "canceled"],
  canceled: [],
  unpaid: ["active", "canceled"],
  paused: ["active", "past_due", "canceled"],
};

const LAGO_STATUS_TRANSITIONS: Readonly<
  Record<LagoSubscriptionStatus, readonly LagoSubscriptionStatus[]>
> = {
  pending: ["active", "incomplete", "canceled"],
  active: ["terminated"],
  terminated: [],
  canceled: [],
  incomplete: ["active", "canceled"],
};

const PROVIDER_STATUS_TRANSITIONS: Readonly<
  Record<
    BillingSubscriptionProvider,
    Readonly<Record<string, readonly string[]>>
  >
> = {
  stripe: STRIPE_STATUS_TRANSITIONS,
  lago: LAGO_STATUS_TRANSITIONS,
};

export function assertSubscriptionStatusTransition({
  provider,
  previousStatus,
  nextStatus,
}: {
  provider: BillingSubscriptionProvider;
  previousStatus: string | null | undefined;
  nextStatus: string;
}) {
  const transitions = PROVIDER_STATUS_TRANSITIONS[provider];
  if (!Object.hasOwn(transitions, nextStatus)) {
    throw new Error(`billing.subscription_status_unknown:${provider}`);
  }

  // A first local observation can legitimately be from the middle or end of a
  // provider lifecycle. It still must use the provider's known vocabulary.
  if (previousStatus === null || previousStatus === undefined) return;

  if (!Object.hasOwn(transitions, previousStatus)) {
    throw new Error(`billing.subscription_status_unknown:${provider}`);
  }
  if (previousStatus === nextStatus) return;
  if (!transitions[previousStatus]?.includes(nextStatus)) {
    throw new Error(`billing.subscription_transition_illegal:${provider}`);
  }
}
