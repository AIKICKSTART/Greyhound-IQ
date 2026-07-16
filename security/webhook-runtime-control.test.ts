import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";

import { AccessToken } from "livekit-server-sdk";
import Stripe from "stripe";

import {
  LagoWebhookError,
  verifyLagoWebhook,
} from "../src/lib/billing/lago-webhooks";
import {
  StripeWebhookError,
  verifyStripeWebhook,
} from "../src/lib/billing/stripe-webhooks";
import { receiveLiveKitWebhook } from "../src/lib/livekit-admin";

const originalEnv = { ...process.env };

async function main() {
  try {
    process.env.STRIPE_RESTRICTED_KEY = "rk_test_webhook_evidence"; // gitleaks:allow - test sentinel
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_webhook_evidence";
    process.env.LAGO_API_URL = "https://api.lago.invalid";
    process.env.LAGO_FRONT_URL = "https://billing.lago.invalid";
    process.env.LAGO_API_KEY = "lago_test_webhook_evidence"; // gitleaks:allow - test sentinel
    process.env.LAGO_WEBHOOK_SECRET = "lago_webhook_evidence";
    process.env.LIVEKIT_API_KEY = "livekit_test_key";
    process.env.LIVEKIT_API_SECRET = "livekit_test_secret"; // gitleaks:allow - test sentinel
    process.env.LIVEKIT_URL = "wss://livekit.invalid";
    process.env.LIVEKIT_TOPOLOGY = "single";
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://livekit.invalid";

    const stripePayload = JSON.stringify({
      id: "evt_webhook_evidence",
      object: "event",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "evidence.ignored",
      data: { object: { sensitive: "must-not-enter-receipt" } },
    });
    const stripeSignature = Stripe.webhooks.generateTestHeaderString({
      payload: stripePayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    assert.equal(
      verifyStripeWebhook(
        new Headers({ "stripe-signature": stripeSignature }),
        Buffer.from(stripePayload),
      ).id,
      "evt_webhook_evidence",
    );
    assert.throws(
      () => verifyStripeWebhook(new Headers(), Buffer.from(stripePayload)),
      (error) => error instanceof StripeWebhookError && error.status === 401,
    );
    assert.throws(
      () =>
        verifyStripeWebhook(
          new Headers({ "stripe-signature": stripeSignature }),
          Buffer.from(`${stripePayload}\n`),
        ),
      (error) => error instanceof StripeWebhookError && error.status === 401,
    );
    const staleStripeSignature = Stripe.webhooks.generateTestHeaderString({
      payload: stripePayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 600,
    });
    assert.throws(
      () =>
        verifyStripeWebhook(
          new Headers({ "stripe-signature": staleStripeSignature }),
          Buffer.from(stripePayload),
        ),
      (error) => error instanceof StripeWebhookError && error.status === 401,
    );

    const lagoBody = Buffer.from(
      JSON.stringify({
        webhook_type: "invoice.paid",
        invoice: { id: "inv_test" },
      }),
    );
    const lagoSignature = createHmac(
      "sha256",
      process.env.LAGO_WEBHOOK_SECRET,
    )
      .update(lagoBody)
      .digest("base64");
    const lagoHeaders = new Headers({
      "x-lago-signature": lagoSignature,
      "x-lago-signature-algorithm": "hmac",
    });
    assert.doesNotThrow(() => verifyLagoWebhook(lagoHeaders, lagoBody));
    assert.throws(
      () =>
        verifyLagoWebhook(
          lagoHeaders,
          Buffer.from(`${lagoBody.toString()}\n`),
        ),
      (error) => error instanceof LagoWebhookError && error.status === 401,
    );
    assert.throws(
      () =>
        verifyLagoWebhook(
          new Headers({ "x-lago-signature-algorithm": "hmac" }),
          lagoBody,
        ),
      (error) => error instanceof LagoWebhookError && error.status === 401,
    );

    const liveKitBody = JSON.stringify({
      event: "room_started",
      room: { name: "ghiq-webhook-evidence", sid: "RM_evidence" },
    });
    const liveKitToken = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    liveKitToken.sha256 = createHash("sha256")
      .update(liveKitBody)
      .digest("base64");
    const liveKitJwt = await liveKitToken.toJwt();
    assert.equal(
      (await receiveLiveKitWebhook(liveKitBody, liveKitJwt)).event,
      "room_started",
    );
    await assert.rejects(
      () => receiveLiveKitWebhook(`${liveKitBody}\n`, liveKitJwt),
      /sha256 checksum of body does not match/,
    );
    await assert.rejects(
      () => receiveLiveKitWebhook(liveKitBody, null),
      /authorization header is empty/,
    );
    const expiredLiveKitToken = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { ttl: "-1h" },
    );
    expiredLiveKitToken.sha256 = createHash("sha256")
      .update(liveKitBody)
      .digest("base64");
    const expiredLiveKitJwt = await expiredLiveKitToken.toJwt();
    await assert.rejects(() =>
      receiveLiveKitWebhook(liveKitBody, expiredLiveKitJwt),
    );

    console.log(
      "Webhook runtime controls passed: Stripe, Lago, and LiveKit authenticate exact raw bodies; supported freshness checks reject stale credentials",
    );
  } finally {
    process.env = originalEnv;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
