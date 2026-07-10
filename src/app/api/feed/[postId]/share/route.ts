import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { shareFeedPostForCurrentUser } from "@/lib/feed-service";
import { feedShareWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";

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
      `feed:share:${current.dbUserId}`,
      20,
      60 * 1000
    );
    if (!rate.allowed) throw new Error("rate_limit.exceeded");
    const input = feedShareWriteSchema.parse(await request.json());
    const item = await shareFeedPostForCurrentUser(current, postId, input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not share feed post");
  }
}
