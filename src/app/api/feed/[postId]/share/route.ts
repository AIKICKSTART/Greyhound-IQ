import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import { shareFeedPostForCurrentUser } from "@/lib/feed-service";
import { feedShareWriteSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

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
    if (!rate.allowed) {
      return rateLimitExceededResponse(
        rate,
        20,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const input = feedShareWriteSchema.parse(await readBoundedJsonRequest(request));
    const item = await shareFeedPostForCurrentUser(current, postId, input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not share feed post");
  }
}
