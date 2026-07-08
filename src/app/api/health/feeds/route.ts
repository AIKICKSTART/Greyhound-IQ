import { NextResponse } from "next/server";
import { getLiveFeedStatus } from "@/lib/live/status";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FEED_STATUS_CACHE_MS = 60_000;
let cachedFeedStatus:
  | {
      expiresAt: number;
      value: Awaited<ReturnType<typeof getLiveFeedStatus>>;
    }
  | null = null;
let pendingFeedStatus:
  | Promise<Awaited<ReturnType<typeof getLiveFeedStatus>>>
  | null = null;

export async function GET(request: Request) {
  const status = await cachedLiveFeedStatus();
  // Public probe gets liveness only; provider names, missing-env, scheduler
  // cadence, and data counts are operational detail behind the internal secret.
  if (!isInternalRequest(request)) {
    return NextResponse.json(
      { status: status.status, timestamp: status.timestamp },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  }
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function cachedLiveFeedStatus() {
  const now = Date.now();
  if (cachedFeedStatus && cachedFeedStatus.expiresAt > now) {
    return cachedFeedStatus.value;
  }

  pendingFeedStatus ??= getLiveFeedStatus().finally(() => {
    pendingFeedStatus = null;
  });

  const value = await pendingFeedStatus;
  cachedFeedStatus = {
    expiresAt: Date.now() + FEED_STATUS_CACHE_MS,
    value,
  };
  return value;
}
