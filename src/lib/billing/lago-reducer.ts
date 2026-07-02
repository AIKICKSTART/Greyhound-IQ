import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type JsonRecord = Record<string, unknown>;

type ReduceLagoWebhookInput = {
  webhookEventId: string;
  lagoEventId: string | null;
  eventType: string;
  payloadJson: string;
};

type ReduceLagoWebhookResult =
  | { reduced: true; billingEventId: string }
  | { reduced: false; reason: "already_reduced" | "unsupported_payload" };

type SubscriptionSnapshot = {
  kind: "subscription";
  object: JsonRecord;
  lagoSubscriptionId: string;
  lagoCustomerId: string | null;
  lagoPlanId: string | null;
  externalId: string | null;
  planCode: string | null;
  status: string;
  startedAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
};

type InvoiceSnapshot = {
  kind: "invoice";
  object: JsonRecord;
  lagoInvoiceId: string;
  lagoCustomerId: string | null;
  lagoSubscriptionId: string | null;
  invoiceNumber: string | null;
  status: string;
  paymentStatus: string | null;
  currency: string | null;
  totalAmountCents: number | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  voidedAt: Date | null;
};

type LagoSnapshot = SubscriptionSnapshot | InvoiceSnapshot;
type HandledWebhookStatus = "processed" | "ignored";

export async function reduceLagoWebhook({
  webhookEventId,
  lagoEventId,
  eventType,
  payloadJson,
}: ReduceLagoWebhookInput): Promise<ReduceLagoWebhookResult> {
  const payload = parsePayload(payloadJson);
  if (!payload) {
    await markWebhookEventIgnored(webhookEventId);
    return { reduced: false, reason: "unsupported_payload" };
  }

  const effectiveEventType = deriveEventType(payload, eventType);
  const snapshot = extractSnapshot(payload, effectiveEventType);
  if (!snapshot) {
    await markWebhookEventIgnored(webhookEventId);
    return { reduced: false, reason: "unsupported_payload" };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.billingEvent.findFirst({
      where: { webhookEventId },
      select: { id: true },
    });
    if (existing) {
      await markWebhookEventHandled(tx, webhookEventId, "processed");
      return { reduced: false, reason: "already_reduced" };
    }

    const result =
      snapshot.kind === "subscription"
        ? await reduceSubscriptionWebhook(tx, {
            webhookEventId,
            lagoEventId,
            eventType: effectiveEventType,
            payload,
            snapshot,
          })
        : await reduceInvoiceWebhook(tx, {
            webhookEventId,
            lagoEventId,
            eventType: effectiveEventType,
            payload,
            snapshot,
          });

    await markWebhookEventHandled(tx, webhookEventId, "processed");
    return result;
  });
}

async function reduceSubscriptionWebhook(
  tx: Prisma.TransactionClient,
  {
    webhookEventId,
    lagoEventId,
    eventType,
    payload,
    snapshot,
  }: {
    webhookEventId: string;
    lagoEventId: string | null;
    eventType: string;
    payload: JsonRecord;
    snapshot: SubscriptionSnapshot;
  }
): Promise<ReduceLagoWebhookResult> {
  const billingCustomer = await findBillingCustomer(tx, snapshot.lagoCustomerId);
  const relationData = relationFields({
    userId: billingCustomer?.userId,
    billingCustomerId: billingCustomer?.id,
  });

  const subscription = await tx.subscription.upsert({
    where: { lagoSubscriptionId: snapshot.lagoSubscriptionId },
    create: {
      ...relationData,
      lagoSubscriptionId: snapshot.lagoSubscriptionId,
      lagoCustomerId: snapshot.lagoCustomerId,
      lagoPlanId: snapshot.lagoPlanId,
      externalId: snapshot.externalId,
      planCode: snapshot.planCode,
      status: snapshot.status,
      startedAt: snapshot.startedAt,
      currentPeriodStart: snapshot.currentPeriodStart,
      currentPeriodEnd: snapshot.currentPeriodEnd,
      canceledAt: snapshot.canceledAt,
      endedAt: snapshot.endedAt,
      rawJson: JSON.stringify(snapshot.object),
    },
    update: {
      ...relationData,
      lagoCustomerId: snapshot.lagoCustomerId,
      lagoPlanId: snapshot.lagoPlanId,
      externalId: snapshot.externalId,
      planCode: snapshot.planCode,
      status: snapshot.status,
      startedAt: snapshot.startedAt,
      currentPeriodStart: snapshot.currentPeriodStart,
      currentPeriodEnd: snapshot.currentPeriodEnd,
      canceledAt: snapshot.canceledAt,
      endedAt: snapshot.endedAt,
      rawJson: JSON.stringify(snapshot.object),
    },
    select: {
      id: true,
      userId: true,
      billingCustomerId: true,
    },
  });

  const billingEvent = await tx.billingEvent.create({
    data: {
      ...relationFields({
        userId: subscription.userId,
        billingCustomerId: subscription.billingCustomerId,
      }),
      subscriptionId: subscription.id,
      webhookEventId,
      lagoEventId,
      eventType,
      occurredAt: eventOccurredAt(payload, snapshot.object),
      dataJson: JSON.stringify(snapshot.object),
    },
    select: { id: true },
  });

  return { reduced: true, billingEventId: billingEvent.id };
}

async function reduceInvoiceWebhook(
  tx: Prisma.TransactionClient,
  {
    webhookEventId,
    lagoEventId,
    eventType,
    payload,
    snapshot,
  }: {
    webhookEventId: string;
    lagoEventId: string | null;
    eventType: string;
    payload: JsonRecord;
    snapshot: InvoiceSnapshot;
  }
): Promise<ReduceLagoWebhookResult> {
  const billingCustomer = await findBillingCustomer(tx, snapshot.lagoCustomerId);
  const subscription = snapshot.lagoSubscriptionId
    ? await tx.subscription.findUnique({
        where: { lagoSubscriptionId: snapshot.lagoSubscriptionId },
        select: {
          id: true,
          userId: true,
          billingCustomerId: true,
        },
      })
    : null;

  const relationData = relationFields({
    userId: subscription?.userId ?? billingCustomer?.userId,
    billingCustomerId: subscription?.billingCustomerId ?? billingCustomer?.id,
    subscriptionId: subscription?.id,
  });

  const invoiceRecord = await tx.invoiceRecord.upsert({
    where: { lagoInvoiceId: snapshot.lagoInvoiceId },
    create: {
      ...relationData,
      lagoInvoiceId: snapshot.lagoInvoiceId,
      lagoCustomerId: snapshot.lagoCustomerId,
      lagoSubscriptionId: snapshot.lagoSubscriptionId,
      invoiceNumber: snapshot.invoiceNumber,
      status: snapshot.status,
      paymentStatus: snapshot.paymentStatus,
      currency: snapshot.currency,
      totalAmountCents: snapshot.totalAmountCents,
      issuedAt: snapshot.issuedAt,
      dueAt: snapshot.dueAt,
      paidAt: snapshot.paidAt,
      voidedAt: snapshot.voidedAt,
      rawJson: JSON.stringify(snapshot.object),
    },
    update: {
      ...relationData,
      lagoCustomerId: snapshot.lagoCustomerId,
      lagoSubscriptionId: snapshot.lagoSubscriptionId,
      invoiceNumber: snapshot.invoiceNumber,
      status: snapshot.status,
      paymentStatus: snapshot.paymentStatus,
      currency: snapshot.currency,
      totalAmountCents: snapshot.totalAmountCents,
      issuedAt: snapshot.issuedAt,
      dueAt: snapshot.dueAt,
      paidAt: snapshot.paidAt,
      voidedAt: snapshot.voidedAt,
      rawJson: JSON.stringify(snapshot.object),
    },
    select: {
      id: true,
      userId: true,
      billingCustomerId: true,
      subscriptionId: true,
    },
  });

  const billingEvent = await tx.billingEvent.create({
    data: {
      ...relationFields({
        userId: invoiceRecord.userId,
        billingCustomerId: invoiceRecord.billingCustomerId,
        subscriptionId: invoiceRecord.subscriptionId,
      }),
      invoiceRecordId: invoiceRecord.id,
      webhookEventId,
      lagoEventId,
      eventType,
      occurredAt: eventOccurredAt(payload, snapshot.object),
      dataJson: JSON.stringify(snapshot.object),
    },
    select: { id: true },
  });

  return { reduced: true, billingEventId: billingEvent.id };
}

function extractSnapshot(
  payload: JsonRecord,
  eventType: string
): LagoSnapshot | null {
  const objectType = firstString(payload.object_type);

  if (eventType.startsWith("subscription.") || objectType === "subscription") {
    const object = findLagoObject(payload, "subscription");
    return object ? toSubscriptionSnapshot(object) : null;
  }

  if (eventType.startsWith("invoice.") || objectType === "invoice") {
    const object = findLagoObject(payload, "invoice");
    return object ? toInvoiceSnapshot(object) : null;
  }

  return null;
}

function toSubscriptionSnapshot(
  object: JsonRecord
): SubscriptionSnapshot | null {
  const lagoSubscriptionId = firstString(object.lago_id);
  const status = firstString(object.status);
  if (!lagoSubscriptionId || !status) return null;

  const customer = recordValue(object.customer);
  const plan = recordValue(object.plan);

  return {
    kind: "subscription",
    object,
    lagoSubscriptionId,
    lagoCustomerId:
      firstString(object.lago_customer_id) ?? firstString(customer?.lago_id),
    lagoPlanId: firstString(object.lago_plan_id) ?? firstString(plan?.lago_id),
    externalId: firstString(object.external_id),
    planCode: firstString(object.plan_code) ?? firstString(plan?.code),
    status,
    startedAt: firstDate(object.started_at, object.subscription_at),
    currentPeriodStart: firstDate(object.current_billing_period_started_at),
    currentPeriodEnd: firstDate(object.current_billing_period_ending_at),
    canceledAt: firstDate(object.canceled_at),
    endedAt: firstDate(object.terminated_at, object.ending_at),
  };
}

function toInvoiceSnapshot(object: JsonRecord): InvoiceSnapshot | null {
  const lagoInvoiceId = firstString(object.lago_id);
  const status = firstString(object.status);
  if (!lagoInvoiceId || !status) return null;

  const customer = recordValue(object.customer);
  const subscription = firstRecordInArray(object.subscriptions);
  const fee = firstRecordInArray(object.fees);

  return {
    kind: "invoice",
    object,
    lagoInvoiceId,
    lagoCustomerId:
      firstString(object.lago_customer_id) ??
      firstString(customer?.lago_id) ??
      firstString(subscription?.lago_customer_id) ??
      firstString(fee?.lago_customer_id),
    lagoSubscriptionId:
      firstString(object.lago_subscription_id) ??
      firstString(subscription?.lago_id) ??
      firstString(fee?.lago_subscription_id),
    invoiceNumber: firstString(object.number),
    status,
    paymentStatus: firstString(object.payment_status),
    currency: firstString(object.currency),
    totalAmountCents: firstInteger(object.total_amount_cents),
    issuedAt: firstDate(object.issuing_date),
    dueAt: firstDate(object.payment_due_date),
    paidAt: firstDate(object.paid_at),
    voidedAt: firstDate(object.voided_at),
  };
}

function findLagoObject(
  payload: JsonRecord,
  objectKey: "subscription" | "invoice"
) {
  const data = recordValue(payload.data);
  const dataObject = data ? recordValue(data.object) : null;
  const keyedObject = recordValue(payload[objectKey]);
  const candidates = [dataObject, keyedObject, payload];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const objectType = firstString(candidate.object_type);
    if (objectType && objectType !== objectKey) continue;
    if (firstString(candidate.lago_id)) return candidate;
  }

  return null;
}

function parsePayload(payloadJson: string) {
  try {
    return recordValue(JSON.parse(payloadJson));
  } catch {
    return null;
  }
}

function deriveEventType(payload: JsonRecord, fallback: string) {
  return (
    firstString(payload.webhook_type) ??
    firstString(payload.event_type) ??
    firstString(payload.type) ??
    fallback
  );
}

async function findBillingCustomer(
  tx: Prisma.TransactionClient,
  lagoCustomerId: string | null
) {
  if (!lagoCustomerId) return null;

  return tx.billingCustomer.findUnique({
    where: { lagoCustomerId },
    select: {
      id: true,
      userId: true,
    },
  });
}

async function markWebhookEventIgnored(webhookEventId: string) {
  await prisma.$transaction((tx) =>
    markWebhookEventHandled(tx, webhookEventId, "ignored")
  );
}

async function markWebhookEventHandled(
  tx: Prisma.TransactionClient,
  webhookEventId: string,
  status: HandledWebhookStatus
) {
  const webhookEvent = await tx.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: {
      status: true,
      processedAt: true,
    },
  });
  if (!webhookEvent) return;
  if (webhookEvent.status === status && webhookEvent.processedAt) return;

  await tx.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      status,
      processedAt: webhookEvent.processedAt ?? new Date(),
    },
  });
}

function relationFields({
  userId,
  billingCustomerId,
  subscriptionId,
}: {
  userId?: string | null;
  billingCustomerId?: string | null;
  subscriptionId?: string | null;
}) {
  const fields: {
    userId?: string;
    billingCustomerId?: string;
    subscriptionId?: string;
  } = {};

  if (userId) fields.userId = userId;
  if (billingCustomerId) fields.billingCustomerId = billingCustomerId;
  if (subscriptionId) fields.subscriptionId = subscriptionId;

  return fields;
}

function eventOccurredAt(payload: JsonRecord, object: JsonRecord) {
  return (
    firstDate(payload.occurred_at, payload.created_at, object.updated_at) ??
    firstDate(object.created_at) ??
    new Date()
  );
}

function recordValue(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function firstRecordInArray(value: unknown): JsonRecord | null {
  if (!Array.isArray(value)) return null;

  for (const item of value) {
    const record = recordValue(item);
    if (record) return record;
  }

  return null;
}

function firstString(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function firstDate(...values: unknown[]) {
  for (const value of values) {
    const raw = firstString(value);
    if (!raw) continue;

    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? `${raw}T00:00:00.000Z`
      : raw;
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function firstInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;

  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!/^-?\d+$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
