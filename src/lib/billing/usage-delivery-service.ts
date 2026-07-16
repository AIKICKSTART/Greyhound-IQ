import "server-only";

import { sendLagoUsageEvent } from "@/lib/billing/lago-client";
import {
  processUsageDeliveryBatch,
  UsageDeliveryWorkerFailure,
  type UsageDeliveryClaim,
} from "@/lib/billing/usage-delivery-worker";
import {
  getUsageDeliveryBacklog,
  resolveUsageDeliveryTarget,
  usageDeliveryWorkerStore,
} from "@/lib/billing/usage-delivery-worker-store";
import { logExecutionInfo, logExecutionWarn } from "@/lib/logger";

export async function runUsageDeliveryMaintenance() {
  const result = await processUsageDeliveryBatch({
    store: usageDeliveryWorkerStore,
    handler: deliverUsageClaim,
  });
  const backlog = await getUsageDeliveryBacklog();
  const context = { worker: "usage-delivery", ...result, backlog };
  if (
    result.retried > 0 ||
    result.deadLettered > 0 ||
    result.leaseLost > 0 ||
    backlog.deadLetter > 0 ||
    backlog.due > 100 ||
    backlog.oldestPendingAgeSeconds > 600
  ) {
    await logExecutionWarn("usage_delivery.attention", context);
  } else {
    await logExecutionInfo("usage_delivery.completed", context);
  }
  return { ...result, backlog };
}

async function deliverUsageClaim(
  claim: UsageDeliveryClaim,
  signal: AbortSignal,
) {
  const target = await resolveUsageDeliveryTarget(claim);
  if (target.outcome === "ignored") {
    await logExecutionInfo("usage_delivery.ignored", {
      usageOutboxId: claim.id,
      metricKey: claim.metricKey,
      attempt: claim.attempt,
      reason: target.reason,
    });
    return "ignored" as const;
  }
  if (signal.aborted) {
    throw new UsageDeliveryWorkerFailure("billing.usage_handler_timeout");
  }

  try {
    await sendLagoUsageEvent({
      transaction_id: claim.idempotencyKey,
      external_subscription_id: target.externalSubscriptionId,
      code: claim.metricKey,
      timestamp: Math.floor(claim.occurredAt.getTime() / 1_000),
      properties: { quantity: claim.quantity },
    });
    return "sent" as const;
  } catch (error) {
    throw classifyLagoDeliveryError(error);
  }
}

function classifyLagoDeliveryError(error: unknown) {
  if (error instanceof UsageDeliveryWorkerFailure) return error;
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/^billing\.lago_usage_event_failed:(\d{3})$/);
  if (!match) {
    return new UsageDeliveryWorkerFailure("billing.usage_provider_unavailable");
  }

  const status = Number(match[1]);
  const retryable =
    status === 408 || status === 425 || status === 429 || status >= 500;
  return new UsageDeliveryWorkerFailure(
    `billing.usage_provider_http_${status}`,
    retryable,
  );
}
