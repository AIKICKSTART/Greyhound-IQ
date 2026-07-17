import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { issueRealtimeAuthorization } from "@/lib/realtime-service";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const current = await requireCurrentUserProfile();
    const rate = await checkRateLimit(
      `realtime:token:${current.dbUserId}`,
      30,
      60 * 1000
    );
    if (!rate.allowed) {
      return rateLimitExceededResponse(
        rate,
        30,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }
    const authorization = await issueRealtimeAuthorization(current);
    return NextResponse.json(authorization, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return jsonError(err, "Could not authorize realtime");
  }
}
