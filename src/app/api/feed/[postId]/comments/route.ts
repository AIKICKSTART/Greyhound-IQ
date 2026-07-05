import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { createFeedCommentForCurrentUser } from "@/lib/feed-service";
import { feedCommentWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const FEED_COMMENT_RATE_LIMIT = 30;
const FEED_COMMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const [{ postId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `feed:comment:${current.dbUserId}:${postId}`,
      FEED_COMMENT_RATE_LIMIT,
      FEED_COMMENT_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit.exceeded",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const parsed = feedCommentWriteSchema.parse(await request.json());
    const comment = await createFeedCommentForCurrentUser(
      current,
      postId,
      parsed
    );
    return NextResponse.json({ item: comment }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create feed comment");
  }
}
