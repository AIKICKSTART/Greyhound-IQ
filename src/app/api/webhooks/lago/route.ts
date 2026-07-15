import { NextResponse } from "next/server";

import {
  ingestLagoWebhook,
  LagoWebhookError,
} from "@/lib/billing/lago-webhooks";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";
import {
  readBoundedWebhookBody,
  webhookBodyErrorResponse,
} from "@/lib/webhook-request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LAGO_WEBHOOK_RATE_LIMIT = 1000;
const LAGO_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(
      getLagoWebhookRateLimitKey(request.headers),
      LAGO_WEBHOOK_RATE_LIMIT,
      LAGO_WEBHOOK_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, LAGO_WEBHOOK_RATE_LIMIT, {
        code: "rate_limited",
        message: "Too many requests",
      });
    }

    const rawBody = Buffer.from(await readBoundedWebhookBody(request));
    const result = await ingestLagoWebhook({
      headers: request.headers,
      rawBody,
    });

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
    });
  } catch (err) {
    const bodyErrorResponse = webhookBodyErrorResponse(err);
    if (bodyErrorResponse) return bodyErrorResponse;

    if (err instanceof LagoWebhookError) {
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
          code: "lago.webhook_ingest_failed",
          message: "Webhook ingest failed",
        },
      },
      { status: 500 },
    );
  }
}

function getLagoWebhookRateLimitKey(headers: Headers) {
  const clientIp = getClientIp(headers);
  return `lago-webhook:${clientIp || "missing-forwarded-for"}`;
}
