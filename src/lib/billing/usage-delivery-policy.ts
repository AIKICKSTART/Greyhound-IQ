import { UsageDeliveryWorkerFailure } from "./usage-delivery-worker";

type DeliveryContext = Readonly<{
  userId: string | null;
  billingCustomerId: string | null;
}>;

export type UsageDeliveryUserSnapshot = Readonly<{
  id: string;
  subscriptionTier: string;
  isBanned: boolean;
  deletionRequestedAt: Date | null;
}>;

export type UsageDeliverySubscriptionSnapshot = Readonly<{
  id: string;
  userId: string | null;
  billingCustomerId: string | null;
  externalId: string | null;
  status: string;
}>;

export type UsageDeliveryDecision =
  | { outcome: "ignored"; reason: "account_inactive" | "not_billable" }
  | {
      outcome: "send";
      externalSubscriptionId: string;
      subscriptionId: string;
      billingCustomerId: string | null;
    };

export function decideUsageDeliveryTarget(
  context: DeliveryContext,
  user: UsageDeliveryUserSnapshot | null,
  subscription: UsageDeliverySubscriptionSnapshot | null,
): UsageDeliveryDecision {
  if (!context.userId || !user || user.isBanned || user.deletionRequestedAt) {
    return { outcome: "ignored", reason: "account_inactive" };
  }
  if (!subscription) {
    if (user.subscriptionTier === "free") {
      return { outcome: "ignored", reason: "not_billable" };
    }
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_subscription_missing",
    );
  }
  if (
    subscription.userId !== user.id ||
    (context.billingCustomerId &&
      context.billingCustomerId !== subscription.billingCustomerId)
  ) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_subscription_context_mismatch",
      false,
    );
  }
  if (["canceled", "terminated"].includes(subscription.status)) {
    return { outcome: "ignored", reason: "not_billable" };
  }
  if (subscription.status !== "active" || !subscription.externalId?.trim()) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_subscription_not_ready",
    );
  }

  return {
    outcome: "send",
    externalSubscriptionId: subscription.externalId.trim(),
    subscriptionId: subscription.id,
    billingCustomerId: subscription.billingCustomerId,
  };
}
