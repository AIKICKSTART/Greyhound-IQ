import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { readBoundedOptionalJsonRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleFeedCommentReactionForCurrentUser } from "@/lib/feed-service";
import { feedReactionWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const [{ commentId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rate = await checkRateLimit(
      `feed:comment-reaction:${current.dbUserId}`,
      60,
      60 * 1000,
      { failClosed: true },
    );
    if (!rate.allowed) {
      return rateLimitExceededResponse(
        rate,
        60,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const input = feedReactionWriteSchema.parse(
      await readBoundedOptionalJsonRequest(request),
    );
    const item = await toggleFeedCommentReactionForCurrentUser(
      current,
      commentId,
      input
    );
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not update comment reaction");
  }
}
