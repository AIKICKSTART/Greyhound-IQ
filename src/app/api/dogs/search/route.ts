import { NextResponse } from "next/server";
import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { searchDogs } from "@/lib/queries";
import {
  directorySearchQuerySchema,
  queryParamsObject,
} from "@/lib/query-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const DOG_SEARCH_RATE_LIMIT = 60;
// No trusted client IP means everyone shares one bucket; keep it small so a
// spoofed/missing header cannot rent the full per-IP allowance.
const DOG_SEARCH_NO_IP_RATE_LIMIT = 10;
const DOG_SEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  if (isEmergencyControlActive(process.env.SEARCH_DISABLED)) {
    return emergencyControlResponse();
  }

  const clientIp = getClientIp(request.headers);
  const rateLimit = await checkRateLimit(
    `dog:search:${clientIp || "missing-forwarded-for"}`,
    clientIp ? DOG_SEARCH_RATE_LIMIT : DOG_SEARCH_NO_IP_RATE_LIMIT,
    DOG_SEARCH_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(
      rateLimit,
      clientIp ? DOG_SEARCH_RATE_LIMIT : DOG_SEARCH_NO_IP_RATE_LIMIT,
      { code: "rate_limit.exceeded", message: "Too many requests" }
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
  // Breeding surfaces pass ?breeding=1 to include studbook sires/dams that
  // never raced; the default directory stays racing-only.
  const includeNonRacing = searchParams.get("breeding") === "1";
  const results = await searchDogs(query.data.q, query.data.limit, includeNonRacing);
  return NextResponse.json(results);
}
