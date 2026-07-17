import assert from "node:assert/strict";

import {
  deliverNotificationWebhookWithFetch,
  resolveNotificationWebhookConfig,
  type NotificationWebhookPayload,
} from "./notification-webhook-policy";

const validEnv = {
  NOTIFICATION_WEBHOOK_URL: "https://hooks.example.test/greyhoundiq",
  NOTIFICATION_WEBHOOK_SECRET: "test-notification-secret",
};
const config = resolveNotificationWebhookConfig(validEnv);
assert.deepEqual(config, {
  url: "https://hooks.example.test/greyhoundiq",
  secret: "test-notification-secret",
});
assert.equal(resolveNotificationWebhookConfig({}), null);

for (const url of [
  "http://hooks.example.test/greyhoundiq",
  "https://user:password@hooks.example.test/greyhoundiq",
  "https://hooks.example.test:8443/greyhoundiq",
  "https://hooks.example.test/greyhoundiq?secret=value",
  "https://hooks.example.test/greyhoundiq#secret",
  "not a URL",
]) {
  assert.throws(
    () =>
      resolveNotificationWebhookConfig({
        ...validEnv,
        NOTIFICATION_WEBHOOK_URL: url,
      }),
    /notification\.webhook_invalid_url/,
  );
}
assert.throws(
  () =>
    resolveNotificationWebhookConfig({
      NOTIFICATION_WEBHOOK_URL: validEnv.NOTIFICATION_WEBHOOK_URL,
    }),
  /notification\.webhook_secret_required/,
);

const payload: NotificationWebhookPayload = {
  id: "notification-1",
  type: "message",
  title: "New message",
  body: "A message is ready",
  href: "/messages/thread-1",
  targetType: "conversation",
  targetId: "thread-1",
  createdAt: "2026-07-15T00:00:00.000Z",
  user: { email: "member@example.test", name: "Demo Member" },
};

async function main() {
  let capturedInput: string | URL | undefined;
  let capturedInit: RequestInit | undefined;
  await deliverNotificationWebhookWithFetch(config!, payload, async (input, init) => {
    capturedInput = input;
    capturedInit = init;
    return new Response(null, { status: 204 });
  });
  assert.equal(capturedInput, config?.url);
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.redirect, "manual");
  assert.equal(
    (capturedInit?.headers as Record<string, string>)["x-notification-secret"],
    validEnv.NOTIFICATION_WEBHOOK_SECRET,
  );
  assert.equal(
    (capturedInit?.headers as Record<string, string>)["idempotency-key"],
    payload.id,
  );
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), payload);

  await assert.rejects(
    deliverNotificationWebhookWithFetch(
      config!,
      payload,
      async () => new Response(null, { status: 302 }),
    ),
    /notification\.webhook_redirect_rejected/,
  );
  await assert.rejects(
    deliverNotificationWebhookWithFetch(
      config!,
      payload,
      async () => new Response(null, { status: 503 }),
    ),
    /notification\.webhook_status_503/,
  );

  console.log(
    "notification webhook boundary passed: exact HTTPS target, no URL credentials/query/fragment, mandatory secret, public-address-pinned fetch and no redirects",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
