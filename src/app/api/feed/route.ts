import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserProfile, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  createFeedPostForCurrentUser,
  getFeedPageForViewer,
} from "@/lib/feed-service";
import { feedPostWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const FEED_POST_RATE_LIMIT = 10;
const FEED_POST_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const mode = request.nextUrl.searchParams.get("mode") ?? "for-you";
    if (mode !== "for-you" && mode !== "latest") {
      return NextResponse.json(
        { error: { code: "feed.invalid_mode", message: "Invalid feed mode" } },
        { status: 400 }
      );
    }
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
      mode,
      actorId: request.nextUrl.searchParams.get("actorId"),
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: boundedLimit(request.nextUrl.searchParams.get("limit")),
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
  const parsed = Number(raw ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}
