import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { searchConversationMessages } from "@/lib/conversation-service";
import {
  messageSearchQuerySchema,
  queryParamsObject,
} from "@/lib/query-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

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
      return rateLimitExceededResponse(
        rate,
        30,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }
    const query = messageSearchQuerySchema.parse(
      queryParamsObject(request.nextUrl.searchParams),
    );
    const result = await searchConversationMessages(
      current,
      id,
      query.q,
      {
        before: query.before,
        limit: query.limit,
      }
    );
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, "Could not search messages");
  }
}
