import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleActorTopicFollowForCurrentUser } from "@/lib/feed-service";
import { checkRateLimit } from "@/lib/rate-limit";

const followSchema = z.object({
  actorId: z.string().trim().min(1).max(120).optional().nullable(),
});

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
      60 * 1000
    );
    if (!rate.allowed) throw new Error("rate_limit.exceeded");
    const raw = await request.text();
    const input = followSchema.parse(raw ? JSON.parse(raw) : {});
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
