import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { toggleFeedPostReactionForCurrentUser } from "@/lib/feed-service";
import { feedReactionWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const FEED_REACTION_RATE_LIMIT = 60;
const FEED_REACTION_RATE_LIMIT_WINDOW_MS = 60 * 1000;

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
      `feed:reaction:${current.dbUserId}`,
      FEED_REACTION_RATE_LIMIT,
      FEED_REACTION_RATE_LIMIT_WINDOW_MS
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

    const raw = await request.text();
    const parsed = feedReactionWriteSchema.parse(raw ? JSON.parse(raw) : {});
    const reaction = await toggleFeedPostReactionForCurrentUser(
      current,
      postId,
      parsed
    );
    return NextResponse.json({ item: reaction });
  } catch (err) {
    return jsonError(err, "Could not update feed reaction");
  }
}
