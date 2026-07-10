import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { getCurrentUser, requireCurrentUserProfile } from "@/lib/auth";
import {
  deleteFeedPostForCurrentUser,
  editFeedPostForCurrentUser,
  getFeedPostForViewer,
} from "@/lib/feed-service";
import { feedPostEditSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const FEED_MUTATION_LIMIT = 30;
const FEED_MUTATION_WINDOW_MS = 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const [{ postId }, user] = await Promise.all([params, getCurrentUser()]);
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
    const actorId = new URL(request.url).searchParams.get("actorId");
    const item = await getFeedPostForViewer(postId, { current, actorId });
    return NextResponse.json(
      { item },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return jsonError(err, "Could not load feed post");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const [{ postId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    await assertMutationRate(current.dbUserId);
    const input = feedPostEditSchema.parse(await request.json());
    const item = await editFeedPostForCurrentUser(current, postId, input);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not edit feed post");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const [{ postId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    await assertMutationRate(current.dbUserId);
    const item = await deleteFeedPostForCurrentUser(current, postId);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete feed post");
  }
}

async function assertMutationRate(userId: string) {
  const result = await checkRateLimit(
    `feed:mutation:${userId}`,
    FEED_MUTATION_LIMIT,
    FEED_MUTATION_WINDOW_MS
  );
  if (!result.allowed) throw new Error("rate_limit.exceeded");
}
