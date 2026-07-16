import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { callRoomCreateSchema } from "@/lib/call-validation";
import { createCallRoomForConversation } from "@/lib/call-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const CALL_ROOM_RATE_LIMIT = 10;
const CALL_ROOM_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `call:room:${current.dbUserId}`,
      CALL_ROOM_RATE_LIMIT,
      CALL_ROOM_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        CALL_ROOM_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = callRoomCreateSchema.parse(await readBoundedJsonRequest(request));
    const room = await createCallRoomForConversation(
      current,
      parsed.conversationId,
      parsed.callType
    );

    return NextResponse.json(
      {
        item: {
          id: room.id,
          roomName: room.roomName,
          status: room.status,
          callType: room.callType,
          startsAt: room.startsAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(err, "Could not create call room");
  }
}
