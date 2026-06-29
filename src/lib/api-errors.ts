import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(err: unknown, fallback = "Request failed") {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation.invalid",
          message: "Invalid request body",
          fields: err.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const message = err instanceof Error ? err.message : fallback;
  const status = statusForErrorMessage(message);

  return NextResponse.json(
    {
      error: {
        code: message,
        message: status >= 500 ? fallback : message,
      },
    },
    { status }
  );
}

function statusForErrorMessage(message: string) {
  if (message === "auth.unauthorized") return 401;
  if (
    message === "auth.forbidden" ||
    message === "conversation.blocked" ||
    message === "conversation.recipient_unavailable"
  ) {
    return 403;
  }
  if (message === "payment.required") return 402;
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
    message === "media.secret_not_configured"
  ) {
    return 503;
  }
  return 400;
}
