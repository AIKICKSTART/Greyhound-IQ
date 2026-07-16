import { NextResponse } from "next/server";

import { ONBOARDING_ANALYTICS_CONSENT_HEADER } from "@/components/onboarding-analytics-client";
import {
  ONBOARDING_ANALYTICS_MAX_BODY_BYTES,
  parseOnboardingAnalyticsEvent,
} from "@/components/onboarding-analytics";
import { resolveInteractiveHelpProductArea } from "@/components/interactive-help-state";
import { logRequestInfo } from "@/lib/logger";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

export const ONBOARDING_ANALYTICS_RATE_LIMIT = 6_000;
export const ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS = 60_000;
export const ONBOARDING_ANALYTICS_RATE_LIMIT_KEY =
  "analytics:onboarding:global";

type OnboardingAnalyticsRateLimitResult =
  Parameters<typeof rateLimitExceededResponse>[0] & { allowed: boolean };

type OnboardingAnalyticsRouteDependencies = Readonly<{
  checkLimit?: (
    key: string,
    limit: number,
    windowMs: number,
    options: { failClosed: true },
  ) => Promise<OnboardingAnalyticsRateLimitResult>;
  record?: (
    event: string,
    context: Record<string, unknown>,
  ) => Promise<void>;
}>;

export async function handleOnboardingAnalyticsPost(
  request: Request,
  dependencies: OnboardingAnalyticsRouteDependencies = {},
) {
  if (!isSameOriginAnalyticsRequest(request)) {
    return analyticsError(403, "analytics.origin_rejected", "Request rejected");
  }
  if (request.headers.get(ONBOARDING_ANALYTICS_CONSENT_HEADER) !== "accepted") {
    return analyticsError(403, "analytics.consent_required", "Request rejected");
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return analyticsError(
      415,
      "analytics.content_type_invalid",
      "Content type must be application/json",
    );
  }
  if (!isIdentityEncoding(request.headers.get("content-encoding"))) {
    return analyticsError(
      415,
      "analytics.content_encoding_invalid",
      "Compressed request bodies are not accepted",
    );
  }

  const declaredLength = parseContentLength(request.headers.get("content-length"));
  if (declaredLength === "invalid") {
    return analyticsError(400, "analytics.length_invalid", "Invalid request length");
  }
  if (declaredLength !== null && declaredLength > ONBOARDING_ANALYTICS_MAX_BODY_BYTES) {
    return analyticsError(413, "analytics.body_too_large", "Request body is too large");
  }

  const checkLimit = dependencies.checkLimit;
  if (!checkLimit) {
    return analyticsError(503, "analytics.limiter_unavailable", "Analytics unavailable");
  }
  const rateLimit = await checkLimit(
    ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
    ONBOARDING_ANALYTICS_RATE_LIMIT,
    ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
    { failClosed: true },
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, ONBOARDING_ANALYTICS_RATE_LIMIT, {
      code: "rate_limit.exceeded",
      message: "Too many requests",
    });
  }

  const body = await readBoundedBody(request, ONBOARDING_ANALYTICS_MAX_BODY_BYTES);
  if (body.status === "too-large") {
    return analyticsError(413, "analytics.body_too_large", "Request body is too large");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(body.value);
  } catch {
    return analyticsError(400, "analytics.json_invalid", "Invalid JSON request");
  }
  const analyticsEvent = parseOnboardingAnalyticsEvent(candidate);
  if (!analyticsEvent) {
    return analyticsError(400, "analytics.schema_invalid", "Invalid analytics event");
  }

  const record = dependencies.record ?? logRequestInfo;
  await record("onboarding.analytics.recorded", {
    onboardingEvent: analyticsEvent.event,
    onboardingTour: analyticsEvent.tourId,
    onboardingStep: analyticsEvent.stepId ?? null,
    productArea: resolveInteractiveHelpProductArea(analyticsEvent.tourId),
    schemaVersion: analyticsEvent.schemaVersion,
    targetType: "onboarding-tour",
    targetId: analyticsEvent.tourId,
    outcome: "recorded",
  });

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function isSameOriginAnalyticsRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin")) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function isJsonContentType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function isIdentityEncoding(value: string | null) {
  return value === null || value.trim().toLowerCase() === "identity";
}

function parseContentLength(value: string | null): number | null | "invalid" {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return "invalid";
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : "invalid";
}

async function readBoundedBody(request: Request, maximumBytes: number) {
  if (!request.body) return { status: "ok" as const, value: "" };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let value = "";

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel("analytics body limit exceeded");
        return { status: "too-large" as const };
      }
      value += decoder.decode(chunk.value, { stream: true });
    }
    value += decoder.decode();
    return { status: "ok" as const, value };
  } catch {
    return { status: "ok" as const, value: "" };
  } finally {
    reader.releaseLock();
  }
}

function analyticsError(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
