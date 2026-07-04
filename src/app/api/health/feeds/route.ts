import { NextResponse } from "next/server";
import { getLiveFeedStatus } from "@/lib/live/status";

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

export async function GET() {
  const status = await cachedLiveFeedStatus();
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
    },
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
