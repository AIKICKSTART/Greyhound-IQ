import { NextResponse } from "next/server";
import { getCurrentUser, requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import {
  createFeedCommentForCurrentUser,
  getFeedCommentsForViewer,
} from "@/lib/feed-service";
import { feedCommentWriteSchema } from "@/lib/feed-validation";
import {
  feedCommentPageQuerySchema,
  queryParamsObject,
} from "@/lib/query-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const FEED_COMMENT_RATE_LIMIT = 30;
const FEED_COMMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const [{ postId }, user] = await Promise.all([params, getCurrentUser()]);
    const url = new URL(request.url);
    const query = feedCommentPageQuerySchema.parse(
      queryParamsObject(url.searchParams),
    );
    const current = user?.dbUserId && user.profileId
      ? {
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
      FEED_COMMENT_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        FEED_COMMENT_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = feedCommentWriteSchema.parse(
      await readBoundedJsonRequest(request),
    );
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
