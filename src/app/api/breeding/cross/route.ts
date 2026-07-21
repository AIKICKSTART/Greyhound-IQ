import { NextResponse } from "next/server";

import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { isDogId } from "@/lib/dog-id";
import { getDogPedigree } from "@/lib/pedigree";
import { analyzePedigreeOverlap } from "@/lib/pedigree-analysis";
import { getCrossRecord } from "@/lib/queries";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const CROSS_RATE_LIMIT = 60;
const CROSS_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PEDIGREE_GENERATIONS = 5;

// Returns the historical record for a sire x dam pairing so the cross-analysis
// tool can render it client-side. Reads only — no prediction, no modelling.
export async function GET(request: Request) {
  if (isEmergencyControlActive(process.env.SEARCH_DISABLED)) {
    return emergencyControlResponse();
  }

  const clientIp = getClientIp(request.headers);
  const rateLimit = await checkRateLimit(
    `breeding-cross:${clientIp || "missing-forwarded-for"}`,
    CROSS_RATE_LIMIT,
    CROSS_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, CROSS_RATE_LIMIT, {
      code: "rate_limit.exceeded",
      message: "Too many requests",
    });
  }

  const url = new URL(request.url);
  const sireId = url.searchParams.get("sireId")?.trim();
  const damId = url.searchParams.get("damId")?.trim();
  if (
    !sireId ||
    !damId ||
    !isDogId(sireId) ||
    !isDogId(damId)
  ) {
    return NextResponse.json({ error: "invalid sireId or damId" }, { status: 400 });
  }

  const [cross, sireTree, damTree] = await Promise.all([
    getCrossRecord(sireId, damId),
    getDogPedigree(sireId),
    getDogPedigree(damId),
  ]);
  if (!cross) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Absence of a match only means outcross when both five-generation trees are
  // complete. Partial data remains explicitly incomplete.
  const pedigreeOverlap = analyzePedigreeOverlap(
    sireTree,
    damTree,
    PEDIGREE_GENERATIONS,
  );
  return NextResponse.json(
    {
      cross,
      sharedAncestors: pedigreeOverlap.commonAncestors,
      pedigreeStatus: pedigreeOverlap.status,
      sireTree,
      damTree,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
