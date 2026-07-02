import { NextResponse } from "next/server";
import { searchDogs } from "@/lib/queries";
import { checkRateLimit } from "@/lib/rate-limit";

const DOG_SEARCH_RATE_LIMIT = 60;
const DOG_SEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateLimit = checkRateLimit(
    `dog:search:${forwardedFor || "missing-forwarded-for"}`,
    DOG_SEARCH_RATE_LIMIT,
    DOG_SEARCH_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limit.exceeded",
          message: "Too many requests",
        },
      },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchDogs(q, 20);
  return NextResponse.json(results);
}
