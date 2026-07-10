import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { searchConversationMessages } from "@/lib/conversation-service";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rate = await checkRateLimit(
      `message:search:${current.dbUserId}:${id}`,
      30,
      60 * 1000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limit.exceeded", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    const result = await searchConversationMessages(
      current,
      id,
      request.nextUrl.searchParams.get("q") ?? "",
      {
        before: request.nextUrl.searchParams.get("before"),
        limit: Number.isFinite(limit) ? limit : 20,
      }
    );
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, "Could not search messages");
  }
}
