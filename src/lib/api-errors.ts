import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logError } from "@/lib/logger";

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

  // Only surface the message when it matches a known `namespace.code` sentinel.
  // Anything unrecognized (notably raw Prisma errors, which can embed DB
  // host:port and SQL fragments) is logged server-side and returned generic.
  if (status === null) {
    logError("api.internal_error", { code: "unclassified" }, err);
    return NextResponse.json(
      { error: { code: "internal.error", message: fallback } },
      { status: 500 }
    );
  }

  if (status >= 500) {
    logError("api.internal_error", { code: message }, err);
  }

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

function statusForErrorMessage(message: string): number | null {
  if (message === "auth.unauthorized") return 401;
  if (
    message === "auth.forbidden" ||
    message === "call.blocked" ||
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
    message === "call.not_configured" ||
    message === "media.secret_not_configured" ||
    message.startsWith("billing.stripe_not_configured")
  ) {
    return 503;
  }
  // Recognized app-level validation/business errors are safe to echo at 400.
  // The message must look like a deliberate sentinel, not a raw error string.
  if (/^[a-z][a-z0-9]*\.[a-z0-9_]+$/.test(message)) return 400;
  return null;
}
