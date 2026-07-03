import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { markConversationRead } from "@/lib/conversation-service";
import { checkRateLimit } from "@/lib/rate-limit";

const CONVERSATION_READ_RATE_LIMIT = 10;
const CONVERSATION_READ_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = checkRateLimit(
      `conversation:read:${current.dbUserId}:${id}`,
      CONVERSATION_READ_RATE_LIMIT,
      CONVERSATION_READ_RATE_LIMIT_WINDOW_MS
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

    const count = await markConversationRead(current, id);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return jsonError(err, "Could not mark conversation read");
  }
}
