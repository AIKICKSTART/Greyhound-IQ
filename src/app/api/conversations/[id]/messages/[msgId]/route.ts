import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { softDeleteConversationMessage } from "@/lib/conversation-service";
import { checkRateLimit } from "@/lib/rate-limit";

const MESSAGE_DELETE_RATE_LIMIT = 5;
const MESSAGE_DELETE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const [{ id, msgId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = checkRateLimit(
      `conversation:message:delete:${current.dbUserId}:${msgId}`,
      MESSAGE_DELETE_RATE_LIMIT,
      MESSAGE_DELETE_RATE_LIMIT_WINDOW_MS
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

    const message = await softDeleteConversationMessage(current, id, msgId);
    return NextResponse.json({ item: message });
  } catch (err) {
    return jsonError(err, "Could not delete message");
  }
}
