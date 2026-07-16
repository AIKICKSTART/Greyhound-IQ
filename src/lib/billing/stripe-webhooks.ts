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
import { assertSubscriptionStatusTransition } from "@/lib/billing/subscription-state-machine";
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
const EXPECTED_BESPOKE_CURRENCY = "aud";
const EXPECTED_BESPOKE_AMOUNT = 50_000;

export async function ingestStripeWebhook({
  headers,
  rawBody,
}: IngestStripeWebhookInput): Promise<IngestStripeWebhookResult> {
  const stripeEvent = verifyStripeWebhook(headers, rawBody);
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const receipt = {
    provider: "stripe",
    lagoEventId: stripeEvent.id,
    eventType: stripeEvent.type,
    status: "received",
    payloadHash,
    payloadJson: stripeWebhookAuditPayload(stripeEvent),
    headersJson: JSON.stringify(safeHeaders(headers)),
  } as const;

  try {
    const event = await withDbSystemContext(async (tx) => {
      let stored: StoredStripeWebhookEvent;
      try {
        stored = await tx.webhookEvent.create({
          data: receipt,
          select: eventSelect,
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          // Leave the failed PostgreSQL transaction immediately. A query after
          // P2002 in this transaction is not a dependable duplicate path.
          throw new StripeWebhookDuplicateDelivery();
        }
        throw err;
      }

      await reduceStripeWebhook(tx, stored.id, stripeEvent);
      return stored;
    });
    return { duplicate: false, event };
  } catch (err) {
    if (err instanceof StripeWebhookDuplicateDelivery) {
      try {
        const event = await processDuplicateStripeWebhook({
          stripeEvent,
          payloadHash,
        });
        return { duplicate: true, event };
      } catch (retryError) {
        await persistFailedStripeWebhook(receipt, retryError);
        throw retryError;
      }
    }

    await persistFailedStripeWebhook(receipt, err);
    throw err;
  }
}

class StripeWebhookDuplicateDelivery extends Error {}

async function processDuplicateStripeWebhook({
  payloadHash,
  stripeEvent,
}: {
  payloadHash: string;
  stripeEvent: Stripe.Event;
}) {
  return withDbSystemContext(async (tx) => {
    const existing = await findExistingStripeWebhook(
      tx,
      stripeEvent.id,
      payloadHash
    );
    if (!existing) {
      throw new Error(`stripe.webhook_duplicate_not_found:${stripeEvent.type}`);
    }

    if (existing.status === "failed") {
      const claim = await tx.webhookEvent.updateMany({
        where: { id: existing.id, status: "failed" },
        data: {
          error: null,
          retryCount: { increment: 1 },
          status: "received",
        },
      });
      if (claim.count === 1) {
        await reduceStripeWebhook(tx, existing.id, stripeEvent);
        return tx.webhookEvent.findUniqueOrThrow({
          where: { id: existing.id },
          select: eventSelect,
        });
      }
    }

    return incrementWebhookRetryCount(tx, existing.id);
  });
}

async function findExistingStripeWebhook(
  db: DbContextClient,
  stripeEventId: string,
  payloadHash: string
) {
  const existingById = await db.webhookEvent.findUnique({
    where: { lagoEventId: stripeEventId },
    select: duplicateEventSelect,
  });
  if (existingById) {
    if (
      existingById.provider !== "stripe" ||
      existingById.payloadHash !== payloadHash
    ) {
      throw new Error("stripe.webhook_receipt_conflict");
    }
    return existingById;
  }

  return db.webhookEvent.findUnique({
    where: { provider_payloadHash: { provider: "stripe", payloadHash } },
    select: duplicateEventSelect,
  });
}

async function persistFailedStripeWebhook(
  receipt: {
    eventType: string;
    headersJson: string;
    lagoEventId: string;
    payloadHash: string;
    payloadJson: string;
    provider: string;
    status: string;
  },
  err: unknown
) {
  const error = summarizeError(err);
  await withDbSystemContext(async (tx) => {
    const created = await tx.webhookEvent.createMany({
      data: { ...receipt, error, status: "failed" },
      skipDuplicates: true,
    });
    if (created.count === 1) return;

    // A concurrent delivery may already have completed successfully. Never
    // overwrite that terminal receipt with an older failing attempt.
    await tx.webhookEvent.updateMany({
      where: {
        provider: "stripe",
        OR: [
          { lagoEventId: receipt.lagoEventId },
          { payloadHash: receipt.payloadHash },
        ],
        status: { notIn: ["ignored", "processed"] },
      },
      data: {
        error,
        retryCount: { increment: 1 },
        status: "failed",
      },
    });
  });
}

function stripeWebhookAuditPayload(stripeEvent: Stripe.Event) {
  return JSON.stringify({
    created: stripeEvent.created,
    id: stripeEvent.id,
    livemode: stripeEvent.livemode,
    type: stripeEvent.type,
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
  switch (stripeEvent.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutSessionCompleted(
        db,
        stripeEvent.data.object as Stripe.Checkout.Session
      );
      break;
    case "invoice.paid":
      await handleInvoicePaid(db, stripeEvent.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChanged(
        db,
        stripeEvent.data.object as Stripe.Subscription,
        firstString(stripeEvent.data.previous_attributes?.status)
      );
      break;
    default:
      await markWebhookEventIgnored(db, webhookEventId);
      return;
  }

  await markWebhookEventHandled(db, webhookEventId);
}

async function handleCheckoutSessionCompleted(
  db: DbContextClient,
  session: Stripe.Checkout.Session
) {
  const settlement = stripeCheckoutSettlementForSession(session);
  if (!settlement) return;
  await assertCheckoutSessionUserBinding(db, settlement);

  if (settlement.kind === "bespoke_design") {
    await recordBespokeDesignPurchase(db, settlement);
    return;
  }

  // Subscription access is provisioned only from invoice.paid, where Stripe
  // supplies authoritative settlement and server-allowlisted price evidence.
  await db.user.update({
    where: { id: settlement.userId },
    data: {
      stripeCustomerId: settlement.customerId,
      stripeSubscriptionId: settlement.subscriptionId,
    },
  });
}

export type StripeCheckoutSettlement =
  | {
      kind: "bespoke_design";
      sessionId: string;
      userId: string;
      workosUserId: string;
      profileId: string;
      customerId: string;
      paymentIntentId: string;
      amount: number;
      currency: string;
    }
  | {
      kind: "subscription";
      sessionId: string;
      userId: string;
      workosUserId: string;
      customerId: string;
      subscriptionId: string;
      plan: StripeCheckoutPlan;
    };

export function stripeCheckoutSettlementForSession(
  session: Stripe.Checkout.Session
): StripeCheckoutSettlement | null {
  const bespoke = session.metadata?.kind === "bespoke_design";
  const plan = parseBillingPlan(session.metadata?.plan);
  if (!bespoke && !plan) return null;

  if (session.status !== "complete") {
    throw new Error("stripe.webhook_checkout_incomplete");
  }
  if (session.payment_status !== "paid") {
    // Delayed payment methods emit checkout.session.completed before funds are
    // available. The later async_payment_succeeded event re-enters this path.
    return null;
  }

  const userId = exactMatchingStrings(
    "stripe.webhook_user_mismatch",
    session.client_reference_id,
    session.metadata?.userId
  );
  if (!userId) throw new Error("stripe.webhook_missing_user");
  const workosUserId = firstString(session.metadata?.workosUserId);
  if (!workosUserId) throw new Error("stripe.webhook_missing_workos_user");
  const customerId = stripeId(session.customer);
  if (!customerId) throw new Error("stripe.webhook_missing_customer");

  if (bespoke) {
    if (session.mode !== "payment") {
      throw new Error("stripe.webhook_checkout_mode_mismatch");
    }
    if (
      session.amount_total !== EXPECTED_BESPOKE_AMOUNT ||
      session.currency?.toLowerCase() !== EXPECTED_BESPOKE_CURRENCY
    ) {
      throw new Error("stripe.webhook_checkout_amount_mismatch");
    }
    const profileId = firstString(session.metadata?.profileId);
    if (!profileId) throw new Error("stripe.webhook_missing_profile");
    const paymentIntentId = stripeId(session.payment_intent);
    if (!paymentIntentId) throw new Error("stripe.webhook_missing_payment_intent");
    return {
      kind: "bespoke_design",
      sessionId: session.id,
      userId,
      workosUserId,
      profileId,
      customerId,
      paymentIntentId,
      amount: session.amount_total,
      currency: EXPECTED_BESPOKE_CURRENCY,
    };
  }

  if (session.mode !== "subscription" || !plan) {
    throw new Error("stripe.webhook_checkout_mode_mismatch");
  }
  if (
    session.currency?.toLowerCase() !== EXPECTED_BESPOKE_CURRENCY ||
    typeof session.amount_total !== "number" ||
    session.amount_total < 0
  ) {
    throw new Error("stripe.webhook_checkout_amount_mismatch");
  }
  const subscriptionId = stripeId(session.subscription);
  if (!subscriptionId) throw new Error("stripe.webhook_missing_subscription");
  return {
    kind: "subscription",
    sessionId: session.id,
    userId,
    workosUserId,
    customerId,
    subscriptionId,
    plan,
  };
}

async function assertCheckoutSessionUserBinding(
  db: DbContextClient,
  settlement: StripeCheckoutSettlement
) {
  const user = await db.user.findUnique({
    where: { id: settlement.userId },
    select: {
      id: true,
      stripeCustomerId: true,
      workosUserId: true,
      profile: { select: { id: true } },
    },
  });
  if (!user) throw new Error("stripe.webhook_missing_user");
  if (user.stripeCustomerId !== settlement.customerId) {
    throw new Error("stripe.webhook_customer_mismatch");
  }
  if (user.workosUserId !== settlement.workosUserId) {
    throw new Error("stripe.webhook_workos_user_mismatch");
  }
  if (
    settlement.kind === "bespoke_design" &&
    user.profile?.id !== settlement.profileId
  ) {
    throw new Error("stripe.webhook_profile_mismatch");
  }
}

// One-off $500 concierge purchase → CustomDesignRequest(status=paid).
// Idempotent on stripeSessionId (webhook may retry).
async function recordBespokeDesignPurchase(
  db: DbContextClient,
  settlement: Extract<StripeCheckoutSettlement, { kind: "bespoke_design" }>
) {
  const existing = await db.customDesignRequest.findUnique({
    where: { stripeSessionId: settlement.sessionId },
    select: { id: true },
  });
  if (existing) return;

  await db.customDesignRequest.create({
    data: {
      buyerProfileId: settlement.profileId,
      buyerUserId: settlement.userId,
      status: "paid",
      amount: settlement.amount,
      currency: settlement.currency,
      stripeSessionId: settlement.sessionId,
      stripePaymentId: settlement.paymentIntentId,
    },
  });
}

export function stripeUserBillingUpdateForCheckoutSession(
  session: Stripe.Checkout.Session
) {
  const stripeCustomerId = stripeId(session.customer);
  const stripeSubscriptionId = stripeId(session.subscription);

  return {
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
  };
}

async function handleSubscriptionChanged(
  db: DbContextClient,
  subscription: Stripe.Subscription,
  previousStatus: string | null
) {
  if (!isManagedStripeSubscription(subscription)) return;
  const update = stripeUserBillingUpdateForSubscription(
    subscription,
    previousStatus
  );
  const stripeCustomerId = stripeId(subscription.customer);
  const userId = await findUserIdForSubscription(db, subscription, stripeCustomerId);
  if (!userId) throw new Error("stripe.webhook_missing_user");

  await db.user.update({
    where: { id: userId },
    data: update,
  });
}

export function stripeUserBillingUpdateForSubscription(
  subscription: Stripe.Subscription,
  previousStatus: string | null = null
) {
  assertSubscriptionStatusTransition({
    provider: "stripe",
    previousStatus,
    nextStatus: subscription.status,
  });
  const stripeCustomerId = stripeId(subscription.customer);
  const plan = planForStripeSubscription(subscription);
  const revokeAccess =
    subscription.status !== "active" || Boolean(subscription.pause_collection) || plan === "free";

  return {
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    stripeSubscriptionId: subscription.status === "canceled" ? null : subscription.id,
    ...(revokeAccess ? { subscriptionTier: "free" as const } : {}),
  };
}

async function handleInvoicePaid(db: DbContextClient, invoice: Stripe.Invoice) {
  const grant = stripeInvoicePaidEntitlement(invoice);
  if (!grant) return;
  const userId = await findUserIdForStripeBinding(db, {
    customerId: grant.customerId,
    subscriptionId: grant.subscriptionId,
    metadataUserId: grant.userId,
  });
  await db.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: grant.customerId,
      stripeSubscriptionId: grant.subscriptionId,
      subscriptionTier: grant.plan,
    },
  });
}

export function stripeInvoicePaidEntitlement(invoice: Stripe.Invoice) {
  const subscriptionDetails = invoice.parent?.subscription_details;
  const subscriptionId = stripeId(subscriptionDetails?.subscription ?? null);
  const metadata = subscriptionDetails?.metadata;
  if (!subscriptionId) return null;

  if (
    invoice.status !== "paid" ||
    invoice.amount_remaining !== 0 ||
    invoice.amount_paid < 0
  ) {
    throw new Error("stripe.webhook_invoice_not_settled");
  }
  if (invoice.currency.toLowerCase() !== EXPECTED_BESPOKE_CURRENCY) {
    throw new Error("stripe.webhook_invoice_currency_mismatch");
  }
  const customerId = stripeId(invoice.customer);
  if (!customerId) throw new Error("stripe.webhook_missing_customer");
  const userId = firstString(metadata?.userId);
  if (!userId) throw new Error("stripe.webhook_missing_user");

  const subscriptionPriceIds = new Set(
    invoice.lines.data.flatMap((line) => {
      if (invoiceLineSubscriptionId(line) !== subscriptionId) return [];
      if (line.currency.toLowerCase() !== EXPECTED_BESPOKE_CURRENCY) {
        throw new Error("stripe.webhook_invoice_currency_mismatch");
      }
      const priceId = stripeId(line.pricing?.price_details?.price ?? null);
      return priceId ? [priceId] : [];
    })
  );
  if (
    subscriptionPriceIds.size !== 1
  ) {
    throw new Error("stripe.webhook_invoice_price_mismatch");
  }
  const priceId = [...subscriptionPriceIds][0];
  const plan = planForStripePriceId(priceId);
  if (!plan) throw new Error("stripe.webhook_invoice_price_mismatch");

  return { customerId, subscriptionId, userId, plan } as const;
}

function invoiceLineSubscriptionId(line: Stripe.InvoiceLineItem) {
  return firstString(
    stripeId(line.subscription),
    line.parent?.subscription_item_details?.subscription,
    line.parent?.invoice_item_details?.subscription
  );
}

async function findUserIdForSubscription(
  db: DbContextClient,
  subscription: Stripe.Subscription,
  stripeCustomerId: string | null
) {
  if (!stripeCustomerId) throw new Error("stripe.webhook_missing_customer");
  return findUserIdForStripeBinding(db, {
    customerId: stripeCustomerId,
    subscriptionId: subscription.id,
    metadataUserId: firstString(subscription.metadata?.userId),
  });
}

async function findUserIdForStripeBinding(
  db: DbContextClient,
  {
    customerId,
    metadataUserId,
    subscriptionId,
  }: {
    customerId: string;
    metadataUserId: string | null;
    subscriptionId: string;
  }
) {
  const [byCustomer, bySubscription] = await Promise.all([
    db.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    }),
    db.user.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      select: { id: true },
    }),
  ]);
  if (!byCustomer) throw new Error("stripe.webhook_customer_mismatch");
  if (bySubscription && bySubscription.id !== byCustomer.id) {
    throw new Error("stripe.webhook_subscription_mismatch");
  }
  if (metadataUserId && metadataUserId !== byCustomer.id) {
    throw new Error("stripe.webhook_user_mismatch");
  }
  return byCustomer.id;
}

function isManagedStripeSubscription(subscription: Stripe.Subscription) {
  return planForStripeSubscription(subscription) !== "free";
}

function planForStripeSubscription(
  subscription: Stripe.Subscription
): StripeCheckoutPlan | "free" {
  for (const item of subscription.items.data) {
    const plan = planForStripePriceId(item.price.id);
    if (plan) return plan;
  }

  return "free";
}

function planForStripePriceId(priceId: string): StripeCheckoutPlan | null {
  const env = getStripeCheckoutEnv();
  const priceIds = new Map<string, StripeCheckoutPlan>([
    [env.prices.pro.monthly, "pro"],
    [env.prices.pro.yearly, "pro"],
  ]);
  return priceIds.get(priceId) ?? null;
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
  value:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.Subscription
    | Stripe.PaymentIntent
    | Stripe.Price
    | null
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

function exactMatchingStrings(errorCode: string, ...values: unknown[]) {
  const cleaned = values.map((value) => firstString(value));
  if (cleaned.some((value) => value === null)) return null;
  const [first, ...rest] = cleaned as [string, ...string[]];
  if (rest.some((value) => value !== first)) throw new Error(errorCode);
  return first;
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

const duplicateEventSelect = {
  ...eventSelect,
  payloadHash: true,
  provider: true,
} as const;
