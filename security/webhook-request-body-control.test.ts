import assert from "node:assert/strict";

import { POST as liveKitWebhookPost } from "../src/app/api/livekit/webhook/route";
import { POST as lagoWebhookPost } from "../src/app/api/webhooks/lago/route";
import { POST as stripeWebhookPost } from "../src/app/api/webhooks/stripe/route";
import {
  readBoundedWebhookBody,
  readBoundedWebhookText,
  WEBHOOK_BODY_MAX_BYTES,
  webhookBodyErrorResponse,
} from "../src/lib/webhook-request-body";

type WebhookHandler = (request: Request) => Promise<Response>;

async function main() {
  const bounded = await readBoundedWebhookBody(
    new Request("http://localhost/webhook", {
      method: "POST",
      body: Uint8Array.from([1, 2, 3, 4]),
      headers: { "content-length": "4" },
    }),
    4,
  );
  assert.deepEqual([...bounded], [1, 2, 3, 4]);

  await assert.rejects(
    () =>
      readBoundedWebhookBody(
        new Request("http://localhost/webhook", {
          method: "POST",
          body: "{}",
          headers: { "content-length": "not-a-number" },
        }),
        8,
      ),
    /webhook\.content_length_invalid/,
  );
  await assert.rejects(
    () =>
      readBoundedWebhookText(
        new Request("http://localhost/webhook", {
          method: "POST",
          body: Uint8Array.from([0xc3, 0x28]),
        }),
        8,
      ),
    /webhook\.payload_invalid/,
  );
  assert.equal(webhookBodyErrorResponse(new Error("unrelated")), null);

  const handlers = [
    ["stripe", stripeWebhookPost],
    ["lago", lagoWebhookPost],
    ["livekit", liveKitWebhookPost],
  ] as const satisfies readonly (readonly [string, WebhookHandler])[];

  for (const [provider, handler] of handlers) {
    await assertErrorResponse(
      provider,
      await handler(
        new Request(`http://localhost/api/${provider}/webhook`, {
          method: "POST",
          body: "{}",
          headers: {
            "content-length": String(WEBHOOK_BODY_MAX_BYTES + 1),
          },
        }),
      ),
      413,
      "webhook.payload_too_large",
    );

    const hostile = hostileStreamRequest(provider);
    await assertErrorResponse(
      provider,
      await handler(hostile.request),
      413,
      "webhook.payload_too_large",
    );
    assert.equal(
      hostile.wasCancelled(),
      true,
      `${provider}: oversized stream must be cancelled`,
    );

    await assertErrorResponse(
      provider,
      await handler(
        new Request(`http://localhost/api/${provider}/webhook`, {
          method: "POST",
          body: "{}",
          headers: { "content-length": "1, 2" },
        }),
      ),
      400,
      "webhook.content_length_invalid",
    );
  }

  console.log(
    "Webhook request-body controls passed: Stripe, Lago and LiveKit reject declared and streamed oversize payloads before signature verification.",
  );
}

function hostileStreamRequest(provider: string) {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(WEBHOOK_BODY_MAX_BYTES));
      controller.enqueue(Uint8Array.of(1));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request(`http://localhost/api/${provider}/webhook`, {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, wasCancelled: () => cancelled };
}

async function assertErrorResponse(
  provider: string,
  response: Response,
  status: number,
  code: string,
) {
  assert.equal(response.status, status, `${provider}: response status`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = (await response.json()) as {
    error?: { code?: string; message?: string };
  };
  assert.equal(body.error?.code, code, `${provider}: safe error code`);
  assert.ok(body.error?.message, `${provider}: safe error message`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
