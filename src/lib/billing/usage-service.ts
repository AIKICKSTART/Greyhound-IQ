import "server-only";

import {
  LAGO_BILLABLE_METRIC_KEYS,
  type LagoBillableMetricKey,
} from "@/lib/billing/billable-metrics";
import { prisma } from "@/lib/db";

type UsageMetadata = Record<string, unknown> | readonly unknown[];

export type RecordUsageEventInput = {
  idempotencyKey: string;
  metricKey: LagoBillableMetricKey;
  userId?: string | null;
  billingCustomerId?: string | null;
  subscriptionId?: string | null;
  quantity?: number;
  metadata?: UsageMetadata | null;
  occurredAt?: Date;
};

export type RecordUsageEventResult = {
  usageEventId: string;
  usageOutboxId: string;
  idempotencyKey: string;
};

export async function recordUsageEvent(
  input: RecordUsageEventInput
): Promise<RecordUsageEventResult> {
  const idempotencyKey = normalizeRequiredString(
    input.idempotencyKey,
    "billing.usage_idempotency_key_required"
  );
  assertMetricKey(input.metricKey);

  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("billing.usage_quantity_invalid");
  }

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("billing.usage_occurred_at_invalid");
  }

  const metadataJson = serializeMetadata(input.metadata);
  const eventData = {
    idempotencyKey,
    metricKey: input.metricKey,
    userId: normalizeOptionalString(input.userId),
    billingCustomerId: normalizeOptionalString(input.billingCustomerId),
    subscriptionId: normalizeOptionalString(input.subscriptionId),
    quantity,
    metadataJson,
    occurredAt,
  };

  return prisma.$transaction(async (tx) => {
    const usageEvent = await tx.usageEvent.upsert({
      where: { idempotencyKey },
      create: eventData,
      update: {},
      select: { id: true, idempotencyKey: true },
    });

    const usageOutbox = await tx.usageOutbox.upsert({
      where: { idempotencyKey },
      create: {
        ...eventData,
        usageEventId: usageEvent.id,
      },
      update: {
        usageEventId: usageEvent.id,
      },
      select: { id: true },
    });

    return {
      usageEventId: usageEvent.id,
      usageOutboxId: usageOutbox.id,
      idempotencyKey: usageEvent.idempotencyKey,
    };
  });
}

function assertMetricKey(value: string): asserts value is LagoBillableMetricKey {
  if (!(LAGO_BILLABLE_METRIC_KEYS as readonly string[]).includes(value)) {
    throw new Error("billing.usage_metric_key_invalid");
  }
}

function normalizeRequiredString(value: string, errorCode: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(errorCode);
  }
  return normalized;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function serializeMetadata(metadata: UsageMetadata | null | undefined) {
  if (metadata == null) return null;

  const seen = new WeakSet<object>();
  const json = JSON.stringify(metadata, (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "function" || typeof value === "symbol") return null;

    if (value && typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }

    return value;
  });

  return json ?? null;
}
