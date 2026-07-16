import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { readBoundedOptionalJsonRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleSavedFeedPostForCurrentUser } from "@/lib/feed-service";
import { feedActorSelectionSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const actorSchema = feedActorSelectionSchema;

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
    if (!rate.allowed) {
      return rateLimitExceededResponse(
        rate,
        60,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const { actorId } = actorSchema.parse(
      await readBoundedOptionalJsonRequest(request),
    );
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
