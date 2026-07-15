import { NextResponse } from "next/server";

type RateLimitDecision = {
  remaining: number;
  resetAt: number;
};

type PublicRateLimitError = {
  code: string;
  message: string;
};

export function rateLimitExceededResponse(
  decision: RateLimitDecision,
  limit: number,
  error: PublicRateLimitError,
  nowMs = Date.now()
) {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("rate_limit_response.limit_invalid");
  }
  if (!Number.isFinite(decision.remaining)) {
    throw new Error("rate_limit_response.remaining_invalid");
  }
  if (!Number.isFinite(decision.resetAt) || !Number.isFinite(nowMs)) {
    throw new Error("rate_limit_response.reset_invalid");
  }

  const remaining = Math.min(
    limit,
    Math.max(0, Math.floor(decision.remaining))
  );
  const resetSeconds = Math.max(
    1,
    Math.ceil((decision.resetAt - nowMs) / 1000)
  );
  const reset = resetSeconds.toString();

  return NextResponse.json(
    { error },
    {
      status: 429,
      headers: {
        "Access-Control-Allow-Origin": "https://greyhoundsiq.com.au",
        "Cache-Control": "private, no-store",
        "RateLimit-Limit": limit.toString(),
        "RateLimit-Remaining": remaining.toString(),
        "RateLimit-Reset": reset,
        "Retry-After": reset,
      },
    }
  );
}
