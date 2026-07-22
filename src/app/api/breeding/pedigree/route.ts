import { NextResponse } from "next/server";

import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { getDogPedigree } from "@/lib/pedigree";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const PEDIGREE_RATE_LIMIT = 60;
const PEDIGREE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Returns the multi-generation pedigree tree for a dog so the breeding explorer
// can render it client-side without a full page navigation.
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
  if (!dogId || dogId.length > 64 || !/^[a-z0-9-]+$/iu.test(dogId)) {
    return NextResponse.json({ error: "invalid dogId" }, { status: 400 });
  }

  const pedigree = await getDogPedigree(dogId);
  return NextResponse.json(
    { pedigree },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
