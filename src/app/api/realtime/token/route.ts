import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { issueRealtimeAuthorization } from "@/lib/realtime-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const rate = await checkRateLimit(
      `realtime:token:${current.dbUserId}`,
      30,
      60 * 1000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limit.exceeded", message: "Too many requests" } },
        { status: 429 }
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
