import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { readBoundedOptionalJsonRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleActorMuteForCurrentUser } from "@/lib/feed-service";
import { feedActorSelectionSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const muteSchema = feedActorSelectionSchema;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ actorId: string }> }
) {
  try {
    const [{ actorId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rate = await checkRateLimit(
      `actor:mute:${current.dbUserId}:${actorId}`,
      30,
      60 * 1000
    );
    if (!rate.allowed) {
      return rateLimitExceededResponse(
        rate,
        30,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const input = muteSchema.parse(await readBoundedOptionalJsonRequest(request));
    const item = await toggleActorMuteForCurrentUser(
      current,
      actorId,
      input.actorId
    );
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not update muted actor");
  }
}
