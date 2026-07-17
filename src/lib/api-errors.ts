import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getRequestLogContext,
  logCorrelatedError,
  logCorrelatedWarn,
} from "@/lib/logger";
import { createRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

export async function jsonError(err: unknown, fallback = "Request failed") {
  const requestCorrelation = await getRequestLogContext();
  const requestId = requestCorrelation.requestId ?? createRequestId();
  const correlation = { ...requestCorrelation, requestId };

  if (err instanceof ZodError) {
    logCorrelatedWarn(correlation, "api.request_rejected", {
      code: "validation.invalid",
      status: 400,
      outcome: "denied",
    });
    return jsonFailure(
      {
        error: {
          code: "validation.invalid",
          message: "Invalid request body",
          fields: err.flatten().fieldErrors,
        },
      },
      400,
      requestId,
    );
  }

  const message = err instanceof Error ? err.message : fallback;
  const status = statusForErrorMessage(message);

  // Only surface the message when it matches a known `namespace.code` sentinel.
  // Anything unrecognized (notably raw Prisma errors, which can embed DB
  // host:port and SQL fragments) is logged server-side and returned generic.
  if (status === null) {
    logCorrelatedError(
      correlation,
      "api.internal_error",
      { code: "unclassified", status: 500, outcome: "denied" },
      err,
    );
    return jsonFailure(
      { error: { code: "internal.error", message: fallback } },
      500,
      requestId,
    );
  }

  if (status >= 500) {
    logCorrelatedError(
      correlation,
      "api.internal_error",
      { code: message, status, outcome: "denied" },
      err,
    );
  } else {
    logCorrelatedWarn(correlation, "api.request_rejected", {
      code: message,
      status,
      outcome: "denied",
    });
  }

  return jsonFailure(
    {
      error: {
        code: message,
        message: status >= 500 ? fallback : message,
      },
    },
    status,
    requestId,
  );
}

function jsonFailure(body: unknown, status: number, requestId: string) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function statusForErrorMessage(message: string): number | null {
  if (message === "auth.unauthorized") return 401;
  if (message === "request.body_too_large") return 413;
  if (
    message === "request.unsupported_media_type" ||
    message === "request.unsupported_content_encoding"
  ) {
    return 415;
  }
  if (
    message === "auth.forbidden" ||
    message === "call.blocked" ||
    message === "conversation.blocked" ||
    message === "conversation.recipient_unavailable"
  ) {
    return 403;
  }
  if (message === "payment.required") return 402;
  if (message === "rate_limit.exceeded") return 429;
  if (message === "media.too_large" || message === "media.quota_exceeded") {
    return 413;
  }
  if (message === "media.scan_pending") return 409;
  if (message === "media.infected" || message === "media.scan_failed") return 422;
  if (message.includes("_not_found") || message.includes(".not_found")) {
    return 404;
  }
  if (
    message === "internal.not_configured" ||
    message === "call.not_configured" ||
    message === "media.secret_not_configured" ||
    message === "media.storage_unavailable" ||
    message.startsWith("billing.stripe_not_configured")
  ) {
    return 503;
  }
  // Recognized app-level validation/business errors are safe to echo at 400.
  // The message must look like a deliberate sentinel, not a raw error string.
  if (/^[a-z][a-z0-9]*\.[a-z0-9_]+$/.test(message)) return 400;
  return null;
}
