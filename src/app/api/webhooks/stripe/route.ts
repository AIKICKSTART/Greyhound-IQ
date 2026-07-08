import { NextResponse } from "next/server";

import {
  ingestStripeWebhook,
  StripeWebhookError,
} from "@/lib/billing/stripe-webhooks";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STRIPE_WEBHOOK_RATE_LIMIT = 1000;
const STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(
      getStripeWebhookRateLimitKey(request.headers),
      STRIPE_WEBHOOK_RATE_LIMIT,
      STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limited",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const rawBody = Buffer.from(await request.arrayBuffer());
    const result = await ingestStripeWebhook({
      headers: request.headers,
      rawBody,
    });

    return NextResponse.json({
      duplicate: result.duplicate,
      ok: true,
    });
  } catch (err) {
    if (err instanceof StripeWebhookError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.status === 401 ? "Unauthorized" : "Bad request",
          },
        },
        { status: err.status }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "stripe.webhook_ingest_failed",
          message: "Webhook ingest failed",
        },
      },
      { status: 500 }
    );
  }
}

function getStripeWebhookRateLimitKey(headers: Headers) {
  const clientIp = getClientIp(headers);
  return `stripe-webhook:${clientIp || "missing-forwarded-for"}`;
}
