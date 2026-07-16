import { NextResponse } from "next/server";
import type { WebhookEvent } from "livekit-server-sdk";
import { jsonError } from "@/lib/api-errors";
import { handleLiveKitWebhookEvent } from "@/lib/call-service";
import { receiveLiveKitWebhook } from "@/lib/livekit-admin";
import { logRequestWarn } from "@/lib/logger";
import {
  readBoundedWebhookText,
  webhookBodyErrorResponse,
} from "@/lib/webhook-request-body";

// Signature-authed by the LiveKit API key/secret pair; no rate limit needed.
export async function POST(request: Request) {
  try {
    const body = await readBoundedWebhookText(request);
    const auth = request.headers.get("authorization");

    let event: WebhookEvent;
    try {
      event = await receiveLiveKitWebhook(body, auth);
    } catch (err) {
      if (err instanceof Error && err.message === "call.not_configured") {
        throw err;
      }
      await logRequestWarn("livekit.webhook_verify_failed", undefined, err);
      return NextResponse.json(
        {
          error: {
            code: "auth.unauthorized",
            message: "Invalid webhook signature",
          },
        },
        { status: 401 },
      );
    }

    await handleLiveKitWebhookEvent(event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const bodyErrorResponse = webhookBodyErrorResponse(err);
    if (bodyErrorResponse) return bodyErrorResponse;
    return jsonError(err, "Could not process LiveKit webhook");
  }
}
