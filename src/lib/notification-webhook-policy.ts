const NOTIFICATION_WEBHOOK_TIMEOUT_MS = 10_000;

export type NotificationWebhookConfig = {
  readonly url: string;
  readonly secret: string;
};

export type NotificationWebhookPayload = {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly href: string | null;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly createdAt: string;
  readonly user: { readonly email: string; readonly name: string | null };
};

type NotificationWebhookEnvironment = {
  readonly NOTIFICATION_WEBHOOK_URL?: string;
  readonly NOTIFICATION_WEBHOOK_SECRET?: string;
};

type PublicFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export function resolveNotificationWebhookConfig(
  env?: NotificationWebhookEnvironment,
): NotificationWebhookConfig | null {
  const source = env ?? {
    NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL,
    NOTIFICATION_WEBHOOK_SECRET: process.env.NOTIFICATION_WEBHOOK_SECRET,
  };
  const value = source.NOTIFICATION_WEBHOOK_URL?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("notification.webhook_invalid_url");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    throw new Error("notification.webhook_invalid_url");
  }

  const secret = source.NOTIFICATION_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("notification.webhook_secret_required");

  return { url: url.toString(), secret };
}

export async function deliverNotificationWebhookWithFetch(
  config: NotificationWebhookConfig,
  payload: NotificationWebhookPayload,
  fetcher: PublicFetch,
) {
  const response = await fetcher(config.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": payload.id,
      "x-notification-secret": config.secret,
    },
    body: JSON.stringify(payload),
    redirect: "manual",
    signal: AbortSignal.timeout(NOTIFICATION_WEBHOOK_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (response.status >= 300 && response.status < 400) {
    throw new Error("notification.webhook_redirect_rejected");
  }
  if (!response.ok) {
    throw new Error(`notification.webhook_status_${response.status}`);
  }
}
