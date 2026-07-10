import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleSavedFeedPostForCurrentUser } from "@/lib/feed-service";
import { feedReactionWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const actorSchema = feedReactionWriteSchema.pick({ actorId: true });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const [{ postId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rate = await checkRateLimit(
      `feed:save:${current.dbUserId}`,
      60,
      60 * 1000
    );
    if (!rate.allowed) throw new Error("rate_limit.exceeded");
    const raw = await request.text();
    const { actorId } = actorSchema.parse(raw ? JSON.parse(raw) : {});
    const item = await toggleSavedFeedPostForCurrentUser(
      current,
      postId,
      actorId
    );
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not update saved post");
  }
}
