import { NextResponse } from "next/server";
import { getCurrentUser, requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  createFeedCommentForCurrentUser,
  getFeedCommentsForViewer,
} from "@/lib/feed-service";
import { feedCommentWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  feedCommentPageQuerySchema,
  queryParamsObject,
} from "@/lib/query-validation";

const FEED_COMMENT_RATE_LIMIT = 30;
const FEED_COMMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const [{ postId }, user] = await Promise.all([params, getCurrentUser()]);
    const url = new URL(request.url);
    const current = user?.dbUserId && user.profileId
      ? {
    const query = feedCommentPageQuerySchema.parse(
      queryParamsObject(url.searchParams),
    );
          ...user,
          dbUserId: user.dbUserId,
          profileId: user.profileId,
          displayName: user.name,
          profileRole: user.role ?? "member",
          verified: false,
        }
      : null;
    const result = await getFeedCommentsForViewer(postId, {
      current,
      cursor: query.cursor,
      limit: query.limit,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return jsonError(err, "Could not load feed comments");
  }
}

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
      `feed:comment:${current.dbUserId}`,
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
