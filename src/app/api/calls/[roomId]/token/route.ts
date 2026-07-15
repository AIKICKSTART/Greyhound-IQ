import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { createCallTokenForCurrentUser } from "@/lib/call-service";
import { callRoomIdSchema } from "@/lib/call-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const CALL_TOKEN_RATE_LIMIT = 20;
const CALL_TOKEN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const [{ roomId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const parsedRoomId = callRoomIdSchema.parse(roomId);
    const rateLimit = await checkRateLimit(
      `call:token:${current.dbUserId}:${parsedRoomId}`,
      CALL_TOKEN_RATE_LIMIT,
      CALL_TOKEN_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        CALL_TOKEN_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const token = await createCallTokenForCurrentUser(current, parsedRoomId);
    return NextResponse.json(token);
  } catch (err) {
    return jsonError(err, "Could not create call token");
  }
}
