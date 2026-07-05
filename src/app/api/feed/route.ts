import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserProfile, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  createFeedPostForCurrentUser,
  getFeedPostsForViewer,
} from "@/lib/feed-service";
import { feedPostWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const FEED_POST_RATE_LIMIT = 10;
const FEED_POST_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const limit = boundedLimit(request.nextUrl.searchParams.get("limit"));
  const posts = await getFeedPostsForViewer(limit, user?.profileId ?? null);
  return NextResponse.json({ items: posts });
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `feed:post:${current.dbUserId}`,
      FEED_POST_RATE_LIMIT,
      FEED_POST_RATE_LIMIT_WINDOW_MS
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

    const parsed = feedPostWriteSchema.parse(await request.json());
    const post = await createFeedPostForCurrentUser(current, parsed);
    return NextResponse.json({ item: post }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create feed post");
  }
}

function boundedLimit(raw: string | null) {
  const parsed = Number(raw ?? 30);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}
