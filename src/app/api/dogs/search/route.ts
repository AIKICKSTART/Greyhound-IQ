import { NextResponse } from "next/server";
import { searchDogs } from "@/lib/queries";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const DOG_SEARCH_RATE_LIMIT = 60;
import {
  directorySearchQuerySchema,
  queryParamsObject,
} from "@/lib/query-validation";
// No trusted client IP means everyone shares one bucket; keep it small so a
// spoofed/missing header cannot rent the full per-IP allowance.
const DOG_SEARCH_NO_IP_RATE_LIMIT = 10;
const DOG_SEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  const clientIp = getClientIp(request.headers);
  const rateLimit = await checkRateLimit(
    `dog:search:${clientIp || "missing-forwarded-for"}`,
    clientIp ? DOG_SEARCH_RATE_LIMIT : DOG_SEARCH_NO_IP_RATE_LIMIT,
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
  const query = directorySearchQuerySchema.safeParse(
    queryParamsObject(searchParams),
  );
  if (!query.success) {
    return NextResponse.json(
      { error: { code: "validation.invalid", message: "Invalid search query" } },
      { status: 400 },
    );
  }
  const results = await searchDogs(query.data.q, 20);
  return NextResponse.json(results);
}
