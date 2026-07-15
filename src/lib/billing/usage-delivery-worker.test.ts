import assert from "node:assert/strict";

import { decideUsageDeliveryTarget } from "./usage-delivery-policy";
import {
  processUsageDeliveryBatch,
  UsageDeliveryWorkerFailure,
  usageDeliveryRetryDelayMs,
  type UsageDeliveryClaim,
  type UsageDeliveryWorkerStore,
} from "./usage-delivery-worker";

const baseTime = new Date("2026-07-15T00:00:00.000Z");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await testBoundedDeliveryOutcomes();
  await testRetryAndDeadLetterDispositions();
  await testInvalidPayloadFailsClosed();
  testExecutionTimeAuthorization();
  testDeterministicBackoff();
  console.log("Usage delivery worker tests passed");
}

async function testBoundedDeliveryOutcomes() {
  const store = memoryStore([
    claim("usage-1", "agent_run"),
    claim("usage-2", "media_upload_bytes"),
    claim("usage-3", "agent_run"),
  ]);
  let active = 0;
  let peak = 0;
  const result = await processUsageDeliveryBatch({
    store,
    concurrency: 2,
    clock: () => baseTime,
    handler: async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return item.id === "usage-2" ? "ignored" : "sent";
    },
  });

  assert.equal(peak, 2);
  assert.deepEqual(result, {
    claimed: 3,
    sent: 2,
    ignored: 1,
    retried: 0,
    deadLettered: 0,
    leaseLost: 0,
    expiredDeadLettered: 0,
  });
  assert.deepEqual(store.completed, [
    ["usage-1", "sent"],
    ["usage-2", "ignored"],
    ["usage-3", "sent"],
  ]);
}

async function testRetryAndDeadLetterDispositions() {
  const transient = claim("usage-retry", "agent_run", 1);
  const permanent = claim("usage-dead", "agent_run", 1);
  const exhausted = claim("usage-exhausted", "agent_run", 5);
  const store = memoryStore([transient, permanent, exhausted]);

  const result = await processUsageDeliveryBatch({
    store,
    maxAttempts: 5,
    clock: () => baseTime,
    handler: async (item) => {
      if (item.id === permanent.id) {
        throw new UsageDeliveryWorkerFailure(
          "billing.usage_context_mismatch",
          false,
        );
      }
      throw new UsageDeliveryWorkerFailure("billing.usage_provider_unavailable");
    },
  });

  assert.equal(result.retried, 1);
  assert.equal(result.deadLettered, 2);
  assert.equal(store.failed[0]?.retryAt instanceof Date, true);
  assert.equal(store.failed[1]?.retryAt, null);
  assert.equal(store.failed[2]?.retryAt, null);
}

async function testInvalidPayloadFailsClosed() {
  const invalid = claim("usage-invalid", "not-a-metric");
  const store = memoryStore([invalid]);
  let handlerCalled = false;
  const result = await processUsageDeliveryBatch({
    store,
    clock: () => baseTime,
    handler: async () => {
      handlerCalled = true;
      return "sent";
    },
  });

  assert.equal(handlerCalled, false);
  assert.equal(result.deadLettered, 1);
  assert.equal(store.failed[0]?.errorCode, "billing.usage_claim_metric_invalid");
}

function testDeterministicBackoff() {
  const first = usageDeliveryRetryDelayMs(1, "usage-key");
  assert.equal(first, usageDeliveryRetryDelayMs(1, "usage-key"));
  assert.ok(first >= 15_000 && first <= 30_000);
  const fifth = usageDeliveryRetryDelayMs(5, "usage-key");
  assert.ok(fifth >= 240_000 && fifth <= 480_000);
}

function testExecutionTimeAuthorization() {
  const context = { userId: "user-1", billingCustomerId: "customer-1" };
  const user = {
    id: "user-1",
    subscriptionTier: "pro",
    isBanned: false,
    deletionRequestedAt: null,
  };
  const subscription = {
    id: "subscription-1",
    userId: "user-1",
    billingCustomerId: "customer-1",
    externalId: "external-subscription-1",
    status: "active",
  };

  assert.deepEqual(decideUsageDeliveryTarget(context, user, subscription), {
    outcome: "send",
    externalSubscriptionId: "external-subscription-1",
    subscriptionId: "subscription-1",
    billingCustomerId: "customer-1",
  });
  assert.deepEqual(
    decideUsageDeliveryTarget(context, { ...user, isBanned: true }, subscription),
    { outcome: "ignored", reason: "account_inactive" },
  );
  assert.deepEqual(
    decideUsageDeliveryTarget(
      context,
      { ...user, subscriptionTier: "free" },
      null,
    ),
    { outcome: "ignored", reason: "not_billable" },
  );
  assert.throws(
    () =>
      decideUsageDeliveryTarget(context, user, {
        ...subscription,
        userId: "other-user",
      }),
    /billing\.usage_subscription_context_mismatch/,
  );
  assert.throws(
    () =>
      decideUsageDeliveryTarget(context, user, {
        ...subscription,
        status: "pending",
      }),
    /billing\.usage_subscription_not_ready/,
  );
}

function claim(id: string, metricKey: string, attempt = 1): UsageDeliveryClaim {
  return {
    id,
    usageEventId: `event-${id}`,
    idempotencyKey: `agent_run:${id}`,
    metricKey,
    userId: `user-${id}`,
    billingCustomerId: null,
    subscriptionId: null,
    quantity: 1,
    occurredAt: baseTime,
    attempt,
    leaseToken: `lease-${id}`,
    leaseExpiresAt: new Date(baseTime.getTime() + 45_000),
  };
}

function memoryStore(initialClaims: readonly UsageDeliveryClaim[]) {
  const pending = [...initialClaims];
  const completed: [string, "sent" | "ignored"][] = [];
  const failed: {
    id: string;
    errorCode: string;
    retryAt: Date | null;
  }[] = [];
  const store: UsageDeliveryWorkerStore & { completed: typeof completed; failed: typeof failed } = {
    completed,
    failed,
    async claimBatch({ limit }) {
      return { claims: pending.splice(0, limit), expiredDeadLettered: 0 };
    },
    async complete({ claim: item, outcome }) {
      completed.push([item.id, outcome]);
      return true;
    },
    async fail({ claim: item, errorCode, retryAt }) {
      failed.push({ id: item.id, errorCode, retryAt });
      return retryAt ? "retry" : "dead-letter";
    },
  };
  return store;
}
