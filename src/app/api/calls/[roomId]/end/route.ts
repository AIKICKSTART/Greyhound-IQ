import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { endCallRoomForCurrentUser } from "@/lib/call-service";
import { callRoomIdSchema } from "@/lib/call-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const CALL_END_RATE_LIMIT = 20;
const CALL_END_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

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
    const rateLimit = checkRateLimit(
      `call:end:${current.dbUserId}:${parsedRoomId}`,
      CALL_END_RATE_LIMIT,
      CALL_END_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit.exceeded",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const room = await endCallRoomForCurrentUser(current, parsedRoomId);
    return NextResponse.json({
      item: {
        id: room.id,
        status: room.status,
        endedAt: room.endedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    return jsonError(err, "Could not end call room");
  }
}
