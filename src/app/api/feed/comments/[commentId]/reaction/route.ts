import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleFeedCommentReactionForCurrentUser } from "@/lib/feed-service";
import { feedReactionWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

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
      60 * 1000
    );
    if (!rate.allowed) throw new Error("rate_limit.exceeded");
    const raw = await request.text();
    const input = feedReactionWriteSchema.parse(raw ? JSON.parse(raw) : {});
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
