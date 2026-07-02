import { NextResponse } from "next/server";

import {
  ingestLagoWebhook,
  LagoWebhookError,
} from "@/lib/billing/lago-webhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const result = await ingestLagoWebhook({
      headers: request.headers,
      rawBody,
    });

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      event: result.event,
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
