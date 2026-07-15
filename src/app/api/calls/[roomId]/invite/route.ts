import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { respondToCallInviteForCurrentUser } from "@/lib/call-service";
import { callInviteActionSchema, callRoomIdSchema } from "@/lib/call-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const CALL_INVITE_RATE_LIMIT = 20;
const CALL_INVITE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const [{ roomId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const parsedRoomId = callRoomIdSchema.parse(roomId);
    const rateLimit = await checkRateLimit(
      `call:invite:${current.dbUserId}:${parsedRoomId}`,
      CALL_INVITE_RATE_LIMIT,
      CALL_INVITE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        CALL_INVITE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = callInviteActionSchema.parse(await readBoundedJsonRequest(request));
    const invite = await respondToCallInviteForCurrentUser(
      current,
      parsedRoomId,
      parsed.action
    );
    return NextResponse.json({
      item: {
        id: invite.id,
        status: invite.status,
      },
    });
  } catch (err) {
    return jsonError(err, "Could not respond to call invite");
  }
}
