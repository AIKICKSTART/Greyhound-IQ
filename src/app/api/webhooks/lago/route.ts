import { NextResponse } from "next/server";

import {
  ingestLagoWebhook,
  LagoWebhookError,
} from "@/lib/billing/lago-webhooks";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LAGO_WEBHOOK_RATE_LIMIT = 1000;
const LAGO_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(
      getLagoWebhookRateLimitKey(request.headers),
      LAGO_WEBHOOK_RATE_LIMIT,
      LAGO_WEBHOOK_RATE_LIMIT_WINDOW_MS
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
    const result = await ingestLagoWebhook({
      headers: request.headers,
      rawBody,
    });

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
    });
  } catch (err) {
    if (err instanceof LagoWebhookError) {
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
          code: "lago.webhook_ingest_failed",
          message: "Webhook ingest failed",
        },
      },
      { status: 500 }
    );
  }
}

function getLagoWebhookRateLimitKey(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `lago-webhook:${forwardedFor || "missing-forwarded-for"}`;
}
