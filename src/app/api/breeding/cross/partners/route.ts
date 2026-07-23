import { NextResponse } from "next/server";

import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { getCurrentUser } from "@/lib/auth";
import { getDamSirePartners, getSireDamPartners } from "@/lib/queries";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";
import { hasTier } from "@/lib/tier-access";

const PARTNERS_RATE_LIMIT = 60;
const PARTNERS_RATE_LIMIT_WINDOW_MS = 60 * 1000;
// Dog ids span cuid, uuid and legacy hist_dog_* imports — underscores included.
const ID_PATTERN = /^[a-z0-9_-]+$/iu;

// Top real breeding partners for a chosen parent: pass sireId to get the dams it
// has produced progeny with (or damId for the reverse). Powers the "top dam
// picks" suggestions in cross analysis. Reads only — historical, not a prediction.
export async function GET(request: Request) {
  if (isEmergencyControlActive(process.env.SEARCH_DISABLED)) {
    return emergencyControlResponse();
  }

  const clientIp = getClientIp(request.headers);
  const rateLimit = await checkRateLimit(
    `breeding-partners:${clientIp || "missing-forwarded-for"}`,
    PARTNERS_RATE_LIMIT,
    PARTNERS_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, PARTNERS_RATE_LIMIT, {
      code: "rate_limit.exceeded",
      message: "Too many requests",
    });
  }

  // Test mating is a Pro plan feature; the page upsells, the API enforces.
  const user = await getCurrentUser();
  if (!user || !hasTier(user.tier, "pro")) {
    return NextResponse.json(
      { error: { code: "tier.pro_required", message: "Test mating is a Pro feature" } },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const sireId = url.searchParams.get("sireId")?.trim();
  const damId = url.searchParams.get("damId")?.trim();
  const id = sireId || damId;
  if (!id || id.length > 64 || !ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "invalid sireId or damId" }, { status: 400 });
  }

  const partners = sireId
    ? await getSireDamPartners(sireId)
    : await getDamSirePartners(id);
  return NextResponse.json(
    { partners },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
