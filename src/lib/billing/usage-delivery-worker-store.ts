import "server-only";

import { randomUUID } from "node:crypto";

import { withDbSystemContext } from "@/lib/db-context";
import {
  decideUsageDeliveryTarget,
  type UsageDeliveryDecision,
} from "@/lib/billing/usage-delivery-policy";
import {
  UsageDeliveryWorkerFailure,
  type UsageDeliveryClaim,
  type UsageDeliveryWorkerStore,
} from "@/lib/billing/usage-delivery-worker";

const WORKER_TRANSACTION_MAX_WAIT_MS = 1_000;
const WORKER_TRANSACTION_TIMEOUT_MS = 5_000;

type ExpiredUsageClaim = { idempotencyKey: string };

export const usageDeliveryWorkerStore: UsageDeliveryWorkerStore = {
  async claimBatch({ now, limit, leaseMs, maxAttempts }) {
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);

    return withDbSystemContext(
      async (tx) => {
        const expired = await tx.$queryRaw<ExpiredUsageClaim[]>`
          WITH candidates AS (
            SELECT "id"
            FROM "UsageOutbox"
            WHERE "retryCount" >= ${maxAttempts}
              AND (
                (
                  "status" = 'pending'
                  AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
                )
                OR (
                  "status" = 'processing'
                  AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
                )
              )
            ORDER BY "nextRetryAt" ASC NULLS FIRST, "createdAt" ASC, "id" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${limit}
          )
          UPDATE "UsageOutbox" AS outbox
          SET
            "status" = 'dead_letter',
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "deadLetteredAt" = ${now},
            "failedAt" = ${now},
            "lastErrorCode" = 'billing.usage_attempts_exhausted',
            "error" = 'billing.usage_attempts_exhausted',
            "updatedAt" = ${now}
          FROM candidates
          WHERE outbox."id" = candidates."id"
          RETURNING outbox."idempotencyKey"`;

        if (expired.length > 0) {
          await tx.usageEvent.updateMany({
            where: {
              idempotencyKey: {
                in: expired.map(({ idempotencyKey }) => idempotencyKey),
              },
            },
            data: {
              status: "failed",
              retryCount: maxAttempts,
              nextRetryAt: null,
              failedAt: now,
              error: "billing.usage_attempts_exhausted",
            },
          });
        }

        const claims = await tx.$queryRaw<UsageDeliveryClaim[]>`
          WITH candidates AS (
            SELECT "id"
            FROM "UsageOutbox"
            WHERE "retryCount" < ${maxAttempts}
              AND (
                (
                  "status" = 'pending'
                  AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
                )
                OR (
                  "status" = 'processing'
                  AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
                )
              )
            ORDER BY "nextRetryAt" ASC NULLS FIRST, "createdAt" ASC, "id" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${limit}
          )
          UPDATE "UsageOutbox" AS outbox
          SET
            "status" = 'processing',
            "retryCount" = outbox."retryCount" + 1,
            "lastAttemptAt" = ${now},
            "nextRetryAt" = NULL,
            "leaseExpiresAt" = ${leaseExpiresAt},
            "leaseToken" = ${leaseToken},
            "deadLetteredAt" = NULL,
            "lastErrorCode" = CASE
              WHEN outbox."status" = 'processing'
                THEN 'billing.usage_lease_expired'
              ELSE NULL
            END,
            "error" = NULL,
            "updatedAt" = ${now}
          FROM candidates
          WHERE outbox."id" = candidates."id"
          RETURNING
            outbox."id",
            outbox."usageEventId",
            outbox."idempotencyKey",
            outbox."metricKey",
            outbox."userId",
            outbox."billingCustomerId",
            outbox."subscriptionId",
            outbox."quantity",
            outbox."occurredAt",
            outbox."retryCount" AS "attempt",
            outbox."leaseToken",
            outbox."leaseExpiresAt"`;

        for (const claim of claims) {
          await tx.usageEvent.updateMany({
            where: { idempotencyKey: claim.idempotencyKey },
            data: {
              status: "processing",
              retryCount: claim.attempt,
              lastAttemptAt: now,
              nextRetryAt: null,
              failedAt: null,
              error: null,
            },
          });
        }

        return { claims, expiredDeadLettered: expired.length };
      },
      {
        maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
        timeout: WORKER_TRANSACTION_TIMEOUT_MS,
      },
    );
  },

  async complete({ claim, completedAt, outcome }) {
    return withDbSystemContext(
      async (tx) => {
        const status = outcome === "sent" ? "sent" : "ignored";
        const sentAt = outcome === "sent" ? completedAt : null;
        const updated = await tx.$executeRaw`
          UPDATE "UsageOutbox"
          SET
            "status" = ${status},
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "sentAt" = ${sentAt},
            "deadLetteredAt" = NULL,
            "failedAt" = NULL,
            "lastErrorCode" = NULL,
            "error" = NULL,
            "updatedAt" = ${completedAt}
          WHERE "id" = ${claim.id}
            AND "status" = 'processing'
            AND "leaseToken" = ${claim.leaseToken}`;
        if (updated !== 1) return false;

        await tx.usageEvent.updateMany({
          where: { idempotencyKey: claim.idempotencyKey },
          data: {
            status: "processed",
            retryCount: claim.attempt,
            processedAt: completedAt,
            nextRetryAt: null,
            failedAt: null,
            error: null,
          },
        });
        return true;
      },
      {
        maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
        timeout: WORKER_TRANSACTION_TIMEOUT_MS,
      },
    );
  },

  async fail({ claim, failedAt, errorCode, retryAt }) {
    return withDbSystemContext(
      async (tx) => {
        const status = retryAt ? "pending" : "dead_letter";
        const updated = await tx.$executeRaw`
          UPDATE "UsageOutbox"
          SET
            "status" = ${status},
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "nextRetryAt" = ${retryAt},
            "deadLetteredAt" = ${retryAt ? null : failedAt},
            "failedAt" = ${failedAt},
            "lastErrorCode" = ${errorCode},
            "error" = ${errorCode},
            "updatedAt" = ${failedAt}
          WHERE "id" = ${claim.id}
            AND "status" = 'processing'
            AND "leaseToken" = ${claim.leaseToken}`;
        if (updated !== 1) return "lease-lost";

        await tx.usageEvent.updateMany({
          where: { idempotencyKey: claim.idempotencyKey },
          data: {
            status: retryAt ? "retrying" : "failed",
            retryCount: claim.attempt,
            nextRetryAt: retryAt,
            failedAt,
            error: errorCode,
          },
        });
        return retryAt ? "retry" : "dead-letter";
      },
      {
        maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
        timeout: WORKER_TRANSACTION_TIMEOUT_MS,
      },
    );
  },
};

export async function getUsageDeliveryBacklog(now = new Date()) {
  return withDbSystemContext(async (tx) => {
    const [pending, due, processing, deadLetter, oldest] = await Promise.all([
      tx.usageOutbox.count({ where: { status: "pending" } }),
      tx.usageOutbox.count({
        where: {
          status: "pending",
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
      }),
      tx.usageOutbox.count({ where: { status: "processing" } }),
      tx.usageOutbox.count({ where: { status: "dead_letter" } }),
      tx.usageOutbox.findFirst({
        where: { status: "pending" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { createdAt: true },
      }),
    ]);
    return {
      pending,
      due,
      processing,
      deadLetter,
      oldestPendingAgeSeconds: oldest
        ? Math.max(0, Math.floor((now.getTime() - oldest.createdAt.getTime()) / 1_000))
        : 0,
    };
  });
}

export async function resolveUsageDeliveryTarget(
  claim: UsageDeliveryClaim,
): Promise<UsageDeliveryDecision> {
  return withDbSystemContext(
    async (tx) => {
      const [owned] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "UsageOutbox"
        WHERE "id" = ${claim.id}
          AND "status" = 'processing'
          AND "leaseToken" = ${claim.leaseToken}`;
      if (!owned) {
        throw new UsageDeliveryWorkerFailure(
          "billing.usage_lease_lost",
          false,
        );
      }
      const user = claim.userId
        ? await tx.user.findUnique({
            where: { id: claim.userId },
            select: {
              id: true,
              subscriptionTier: true,
              isBanned: true,
              deletionRequestedAt: true,
            },
          })
        : null;
      if (!user || user.isBanned || user.deletionRequestedAt) {
        return decideUsageDeliveryTarget(claim, user, null);
      }

      const explicitSubscription = claim.subscriptionId
        ? await tx.subscription.findUnique({
            where: { id: claim.subscriptionId },
            select: subscriptionDeliverySelect,
          })
        : null;
      const subscription =
        explicitSubscription ??
        (await tx.subscription.findFirst({
          where: { userId: user.id, status: "active" },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          select: subscriptionDeliverySelect,
        })) ??
        (await tx.subscription.findFirst({
          where: { userId: user.id },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          select: subscriptionDeliverySelect,
        }));

      const decision = decideUsageDeliveryTarget(claim, user, subscription);
      if (decision.outcome === "ignored") return decision;

      const related = await tx.$executeRaw`
        UPDATE "UsageOutbox"
        SET
          "billingCustomerId" = ${decision.billingCustomerId},
          "subscriptionId" = ${decision.subscriptionId},
          "updatedAt" = ${new Date()}
        WHERE "id" = ${claim.id}
          AND "status" = 'processing'
          AND "leaseToken" = ${claim.leaseToken}`;
      if (related !== 1) {
        throw new UsageDeliveryWorkerFailure(
          "billing.usage_lease_lost",
          false,
        );
      }
      await tx.usageEvent.updateMany({
        where: { idempotencyKey: claim.idempotencyKey },
        data: {
          billingCustomerId: decision.billingCustomerId,
          subscriptionId: decision.subscriptionId,
        },
      });

      return decision;
    },
    {
      maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
      timeout: WORKER_TRANSACTION_TIMEOUT_MS,
    },
  );
}

const subscriptionDeliverySelect = {
  id: true,
  userId: true,
  billingCustomerId: true,
  externalId: true,
  status: true,
} as const;
