import "server-only";

import { fetchPublicInternetOrigin } from "@/lib/public-network";
import {
  deliverNotificationWebhookWithFetch,
  resolveNotificationWebhookConfig,
  type NotificationWebhookConfig,
  type NotificationWebhookPayload,
} from "@/lib/notification-webhook-policy";

export {
  resolveNotificationWebhookConfig,
  type NotificationWebhookConfig,
  type NotificationWebhookPayload,
};

export function deliverNotificationWebhook(
  config: NotificationWebhookConfig,
  payload: NotificationWebhookPayload,
) {
  return deliverNotificationWebhookWithFetch(
    config,
    payload,
    fetchPublicInternetOrigin,
  );
}
