import "server-only";

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";

import { getStripeClient } from "@/lib/billing/stripe-client";
import {
  getStripeCheckoutEnv,
  getStripeWebhookEnv,
  type StripeCheckoutPlan,
} from "@/lib/billing/stripe-env";
import { withDbSystemContext, type DbContextClient } from "@/lib/db-context";

type IngestStripeWebhookInput = {
  headers: Headers;
  rawBody: Buffer;
};

type StoredStripeWebhookEvent = {
  eventType: string;
  id: string;
  lagoEventId: string | null;
  retryCount: number;
  status: string;
};

export type IngestStripeWebhookResult = {
  duplicate: boolean;
  event: StoredStripeWebhookEvent;
};

export class StripeWebhookError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 = 400
  ) {
    super(code);
  }
}

const STRIPE_SIGNATURE_HEADER = "stripe-signature";
const PAID_SUBSCRIPTION_STATUSES = new Set(["active", "past_due", "trialing"]);

export async function ingestStripeWebhook({
  headers,
  rawBody,
}: IngestStripeWebhookInput): Promise<IngestStripeWebhookResult> {
  const stripeEvent = verifyStripeWebhook(headers, rawBody);
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const rawBodyText = rawBody.toString("utf8");

  return withDbSystemContext(async (tx) => {
    try {
      const event = await tx.webhookEvent.create({
        data: {
          provider: "stripe",
          lagoEventId: stripeEvent.id,
          eventType: stripeEvent.type,
          status: "received",
          payloadHash,
          payloadJson: rawBodyText,
          headersJson: JSON.stringify(safeHeaders(headers)),
        },
        select: eventSelect,
      });

      await reduceStripeWebhook(tx, event.id, stripeEvent);
      return { duplicate: false, event };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;

      const event = await incrementDuplicateWebhookEvent(tx, {
        stripeEventId: stripeEvent.id,
        eventType: stripeEvent.type,
        payloadHash,
      });
      return { duplicate: true, event };
    }
  });
}

export function verifyStripeWebhook(headers: Headers, rawBody: Buffer) {
  const signature = headers.get(STRIPE_SIGNATURE_HEADER)?.trim();
  if (!signature) {
    throw new StripeWebhookError("stripe.webhook_missing_signature", 401);
  }

  try {
    const env = getStripeWebhookEnv();
    return getStripeClient(env.secretKey).webhooks.constructEvent(
      rawBody,
      signature,
      env.webhookSecret
    );
  } catch {
    throw new StripeWebhookError("stripe.webhook_invalid_signature", 401);
  }
}

async function reduceStripeWebhook(
  db: DbContextClient,
  webhookEventId: string,
  stripeEvent: Stripe.Event
) {
  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          db,
          stripeEvent.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(
          db,
          stripeEvent.data.object as Stripe.Subscription
        );
        break;
      default:
        await markWebhookEventIgnored(db, webhookEventId);
        return;
    }

    await markWebhookEventHandled(db, webhookEventId);
  } catch (err) {
    await markWebhookEventFailed(db, webhookEventId, err);
    throw err;
  }
}

async function handleCheckoutSessionCompleted(
  db: DbContextClient,
  session: Stripe.Checkout.Session
) {
  const userId = firstString(session.client_reference_id, session.metadata?.userId);
  if (!userId) throw new Error("stripe.webhook_missing_user");

  await db.user.update({
    where: { id: userId },
    data: stripeUserBillingUpdateForCheckoutSession(session),
  });
}

export function stripeUserBillingUpdateForCheckoutSession(
  session: Stripe.Checkout.Session
) {
  const stripeCustomerId = stripeId(session.customer);
  const stripeSubscriptionId = stripeId(session.subscription);
  const plan = parseBillingPlan(session.metadata?.plan);

  return {
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    ...(plan ? { subscriptionTier: plan } : {}),
  };
}

async function handleSubscriptionChanged(
  db: DbContextClient,
  subscription: Stripe.Subscription
) {
  const stripeCustomerId = stripeId(subscription.customer);
  const userId = await findUserIdForSubscription(db, subscription, stripeCustomerId);
  if (!userId) throw new Error("stripe.webhook_missing_user");

  await db.user.update({
    where: { id: userId },
    data: stripeUserBillingUpdateForSubscription(subscription),
  });
}

export function stripeUserBillingUpdateForSubscription(subscription: Stripe.Subscription) {
  const stripeCustomerId = stripeId(subscription.customer);
  const tier =
    PAID_SUBSCRIPTION_STATUSES.has(subscription.status) && !subscription.pause_collection
      ? planForStripeSubscription(subscription)
      : "free";

  return {
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    stripeSubscriptionId: subscription.status === "canceled" ? null : subscription.id,
    subscriptionTier: tier,
  };
}

async function findUserIdForSubscription(
  db: DbContextClient,
  subscription: Stripe.Subscription,
  stripeCustomerId: string | null
) {
  const metadataUserId = firstString(subscription.metadata?.userId);
  if (metadataUserId) return metadataUserId;

  const bySubscription = await db.user.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true },
  });
  if (bySubscription) return bySubscription.id;

  if (!stripeCustomerId) return null;
  const byCustomer = await db.user.findUnique({
    where: { stripeCustomerId },
    select: { id: true },
  });
  return byCustomer?.id ?? null;
}

function planForStripeSubscription(
  subscription: Stripe.Subscription
): StripeCheckoutPlan | "free" {
  const metadataPlan = parseBillingPlan(subscription.metadata?.plan);
  if (metadataPlan) return metadataPlan;

  const env = getStripeCheckoutEnv();
  const priceIds = new Map<string, StripeCheckoutPlan>([
    [env.prices.pro.monthly, "pro"],
    [env.prices.pro.yearly, "pro"],
  ]);

  for (const item of subscription.items.data) {
    const plan = priceIds.get(item.price.id);
    if (plan) return plan;
  }

  return "free";
}

async function incrementDuplicateWebhookEvent(
  db: DbContextClient,
  {
    eventType,
    payloadHash,
    stripeEventId,
  }: {
    eventType: string;
    payloadHash: string;
    stripeEventId: string;
  }
) {
  const existingById = await db.webhookEvent.findUnique({
    where: { lagoEventId: stripeEventId },
    select: { id: true },
  });
  if (existingById) return incrementWebhookRetryCount(db, existingById.id);

  const existingByHash = await db.webhookEvent.findUnique({
    where: { provider_payloadHash: { provider: "stripe", payloadHash } },
    select: { id: true },
  });
  if (!existingByHash) {
    throw new Error(`stripe.webhook_duplicate_not_found:${eventType}`);
  }
  return incrementWebhookRetryCount(db, existingByHash.id);
}

function incrementWebhookRetryCount(db: DbContextClient, id: string) {
  return db.webhookEvent.update({
    where: { id },
    data: { retryCount: { increment: 1 } },
    select: eventSelect,
  });
}

function markWebhookEventHandled(db: DbContextClient, id: string) {
  return db.webhookEvent.update({
    where: { id },
    data: { processedAt: new Date(), status: "processed" },
  });
}

function markWebhookEventIgnored(db: DbContextClient, id: string) {
  return db.webhookEvent.update({
    where: { id },
    data: { processedAt: new Date(), status: "ignored" },
  });
}

function markWebhookEventFailed(db: DbContextClient, id: string, err: unknown) {
  return db.webhookEvent.update({
    where: { id },
    data: {
      error: summarizeError(err),
      status: "failed",
    },
  });
}

function safeHeaders(headers: Headers) {
  const safe: Record<string, string> = {};
  addSafeHeader(safe, "content-type", headers.get("content-type"));
  addSafeHeader(safe, "stripe-version", headers.get("stripe-version"));
  return safe;
}

function addSafeHeader(
  target: Record<string, string>,
  key: string,
  value: string | null
) {
  const cleaned = value?.trim();
  if (cleaned) target[key] = cleaned;
}

function parseBillingPlan(value: unknown): StripeCheckoutPlan | null {
  return value === "pro" ? value : null;
}

function stripeId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | Stripe.Subscription | null
) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const cleaned = value.trim();
    if (cleaned) return cleaned;
  }
  return null;
}

function summarizeError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/\s+/g, " ").slice(0, 500);
}

function isUniqueConstraintError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const eventSelect = {
  eventType: true,
  id: true,
  lagoEventId: true,
  retryCount: true,
  status: true,
} as const;
