import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { setConversationBlock } from "@/lib/conversation-service";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const CONVERSATION_BLOCK_RATE_LIMIT = 5;
const CONVERSATION_BLOCK_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `conversation:block:${current.dbUserId}:${id}`,
      CONVERSATION_BLOCK_RATE_LIMIT,
      CONVERSATION_BLOCK_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        CONVERSATION_BLOCK_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const conversation = await setConversationBlock(current, id, true);
    return NextResponse.json({ item: conversation });
  } catch (err) {
    return jsonError(err, "Could not block conversation");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `conversation:unblock:${current.dbUserId}:${id}`,
      CONVERSATION_BLOCK_RATE_LIMIT,
      CONVERSATION_BLOCK_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        CONVERSATION_BLOCK_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const conversation = await setConversationBlock(current, id, false);
    return NextResponse.json({ item: conversation });
  } catch (err) {
    return jsonError(err, "Could not unblock conversation");
  }
}
