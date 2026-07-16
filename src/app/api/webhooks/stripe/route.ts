import { NextResponse } from "next/server";

import {
  ingestStripeWebhook,
  StripeWebhookError,
} from "@/lib/billing/stripe-webhooks";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";
import {
  readBoundedWebhookBody,
  webhookBodyErrorResponse,
} from "@/lib/webhook-request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STRIPE_WEBHOOK_RATE_LIMIT = 1000;
const STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(
      getStripeWebhookRateLimitKey(request.headers),
      STRIPE_WEBHOOK_RATE_LIMIT,
      STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, STRIPE_WEBHOOK_RATE_LIMIT, {
        code: "rate_limited",
        message: "Too many requests",
      });
    }

    const rawBody = Buffer.from(await readBoundedWebhookBody(request));
    const result = await ingestStripeWebhook({
      headers: request.headers,
      rawBody,
    });

    return NextResponse.json({
      duplicate: result.duplicate,
      ok: true,
    });
  } catch (err) {
    const bodyErrorResponse = webhookBodyErrorResponse(err);
    if (bodyErrorResponse) return bodyErrorResponse;

    if (err instanceof StripeWebhookError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.status === 401 ? "Unauthorized" : "Bad request",
          },
        },
        { status: err.status },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "stripe.webhook_ingest_failed",
          message: "Webhook ingest failed",
        },
      },
      { status: 500 },
    );
  }
}

function getStripeWebhookRateLimitKey(headers: Headers) {
  const clientIp = getClientIp(headers);
  return `stripe-webhook:${clientIp || "missing-forwarded-for"}`;
}
