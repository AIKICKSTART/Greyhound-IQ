import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserProfile, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import {
  createFeedPostForCurrentUser,
  getFeedPageForViewer,
} from "@/lib/feed-service";
import { feedPostWriteSchema } from "@/lib/feed-validation";
import { feedPageQuerySchema, queryParamsObject } from "@/lib/query-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const FEED_POST_RATE_LIMIT = 10;
const FEED_POST_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const query = feedPageQuerySchema.parse(
      queryParamsObject(request.nextUrl.searchParams),
    );
    const current =
      user?.dbUserId && user.profileId
        ? {
            ...user,
            dbUserId: user.dbUserId,
            profileId: user.profileId,
            displayName: user.name,
            profileRole: user.role ?? "member",
            verified: false,
          }
        : null;
    const page = await getFeedPageForViewer({
      mode: query.mode,
      actorId: query.actorId,
      cursor: query.cursor,
      limit: query.limit,
      current,
    });
    return NextResponse.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return jsonError(err, "Could not load feed");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `feed:post:${current.dbUserId}`,
      FEED_POST_RATE_LIMIT,
      FEED_POST_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        FEED_POST_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = feedPostWriteSchema.parse(await readBoundedJsonRequest(request));
    const post = await createFeedPostForCurrentUser(current, parsed);
    return NextResponse.json({ item: post }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create feed post");
  }
}
