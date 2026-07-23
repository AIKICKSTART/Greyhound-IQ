import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { readBoundedOptionalJsonRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleActorTopicFollowForCurrentUser } from "@/lib/feed-service";
import { feedActorSelectionSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const followSchema = feedActorSelectionSchema;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const [{ topicId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rate = await checkRateLimit(
      `feed:topic-follow:${current.dbUserId}`,
      30,
      60 * 1000,
      { failClosed: true },
    );
    if (!rate.allowed) {
      return rateLimitExceededResponse(
        rate,
        30,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const input = followSchema.parse(await readBoundedOptionalJsonRequest(request));
    const item = await toggleActorTopicFollowForCurrentUser(
      current,
      topicId,
      input.actorId
    );
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not update followed topic");
  }
}
