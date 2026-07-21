import { NextResponse } from "next/server";

import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { isDogId } from "@/lib/dog-id";
import { getDogPedigree } from "@/lib/pedigree";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";
import { getClientIp } from "@/lib/request-ip";

const PEDIGREE_RATE_LIMIT = 60;
const PEDIGREE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  if (isEmergencyControlActive(process.env.SEARCH_DISABLED)) {
    return emergencyControlResponse();
  }

  const clientIp = getClientIp(request.headers);
  const rateLimit = await checkRateLimit(
    `breeding-pedigree:${clientIp || "missing-forwarded-for"}`,
    PEDIGREE_RATE_LIMIT,
    PEDIGREE_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, PEDIGREE_RATE_LIMIT, {
      code: "rate_limit.exceeded",
      message: "Too many requests",
    });
  }

  const dogId = new URL(request.url).searchParams.get("dogId")?.trim();
  if (!dogId || !isDogId(dogId)) {
    return NextResponse.json({ error: "invalid dogId" }, { status: 400 });
  }

  const pedigree = await getDogPedigree(dogId);
  return NextResponse.json(
    { pedigree },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
