import "server-only";

import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext, withDbSystemContext } from "@/lib/db-context";
import { logExecutionError } from "@/lib/logger";
import {
  deliverNotificationWebhook,
  resolveNotificationWebhookConfig,
} from "@/lib/notification-webhook";

const NOTIFICATION_DELIVERY_LIMIT = 50;
const NOTIFICATION_DELIVERY_MAX_ATTEMPTS = 5;
const NOTIFICATION_DELIVERY_MAX_ATTEMPTS_LIMIT = 20;
const NOTIFICATION_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

type NotificationInput = {
  userId: string;
  actorProfileId?: string | null;
  actorId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function createInAppNotification(input: NotificationInput) {
  try {
    return await withDbSystemContext((tx) => tx.notification.create({
      data: {
        userId: input.userId,
        actorProfileId: input.actorProfileId ?? null,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    }));
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      await logExecutionError("notification.create_failed", {
        type: input.type,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
      }, err);
    }
    return null;
  }
}

export async function createInAppNotificationDeduped(
  input: NotificationInput,
  opts?: { windowMs?: number }
) {
  const windowMs = opts?.windowMs ?? NOTIFICATION_DEDUPE_WINDOW_MS;
  try {
    const existing = await withDbSystemContext((tx) => tx.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        href: input.href ?? null,
        readAt: null,
        createdAt: { gte: new Date(Date.now() - windowMs) },
      },
      select: { id: true },
    }));
    if (existing) return null;
  } catch {
    // Dedupe is best-effort; fall through to create.
  }
  return createInAppNotification(input);
}

export async function countUnreadNotificationsForUser(userId: string) {
  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.notification.count({ where: { userId, readAt: null } })
      ),
    0
  );
}

export async function listNotificationsForUser(userId: string, limit = 50) {
  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.notification.findMany({
          where: { userId },
          orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
          take: Math.min(Math.max(1, Math.trunc(limit)), 100),
        })
      ),
    []
  );
}

export async function markNotificationReadForCurrentUser(
  current: CurrentUserProfile,
  notificationId: string
) {
  await withDbRequestContext(current, (tx) => tx.notification.updateMany({
    where: { id: notificationId, userId: current.dbUserId, readAt: null },
    data: { readAt: new Date() },
  }));
}

export async function markAllNotificationsReadForCurrentUser(
  current: CurrentUserProfile
) {
  await withDbRequestContext(current, (tx) => tx.notification.updateMany({
    where: { userId: current.dbUserId, readAt: null },
    data: { readAt: new Date() },
  }));
}

export function notificationBodySnippet(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

export async function runNotificationDeliveryMaintenance() {
  const maxAttempts = numberEnv(
    "NOTIFICATION_DELIVERY_MAX_ATTEMPTS",
    NOTIFICATION_DELIVERY_MAX_ATTEMPTS
  );
  const pendingWhere = {
    deliveryStatus: { in: ["pending", "error"] },
    deliveryAttempts: { lt: maxAttempts },
    user: { isBanned: false, deletionRequestedAt: null },
  };
  const webhook = resolveNotificationWebhookConfig();

  return withDbSystemContext(async (tx) => {
    const pendingCount = await tx.notification.count({ where: pendingWhere });

    if (!webhook) {
      return {
        mode: "disabled",
        pendingCount,
        attempted: 0,
        delivered: 0,
        failed: 0,
      };
    }

    const notifications = await tx.notification.findMany({
      where: pendingWhere,
      include: {
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: NOTIFICATION_DELIVERY_LIMIT,
    });

    let delivered = 0;
    let failed = 0;
    for (const notification of notifications) {
      const attemptedAt = new Date();
      try {
        await deliverNotificationWebhook(webhook, {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          href: notification.href,
          targetType: notification.targetType,
          targetId: notification.targetId,
          createdAt: notification.createdAt.toISOString(),
          user: notification.user,
        });
        await tx.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: "delivered",
            deliveryAttempts: { increment: 1 },
            deliveredAt: new Date(),
            lastDeliveryAttemptAt: attemptedAt,
            lastDeliveryError: null,
          },
        });
        delivered += 1;
      } catch (err) {
        await tx.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: "error",
            deliveryAttempts: { increment: 1 },
            lastDeliveryAttemptAt: attemptedAt,
            lastDeliveryError: deliveryErrorMessage(err),
          },
        });
        failed += 1;
      }
    }

    return {
      mode: "webhook",
      pendingCount,
      attempted: notifications.length,
      delivered,
      failed,
    };
  });
}

function deliveryErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/\s+/g, " ").slice(0, 500);
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? "");
  return Number.isSafeInteger(value) &&
    value > 0 &&
    value <= NOTIFICATION_DELIVERY_MAX_ATTEMPTS_LIMIT
    ? value
    : fallback;
}
