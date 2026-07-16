import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { markConversationDelivered } from "@/lib/conversation-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const DELIVERY_ACK_RATE_LIMIT = 20;
const DELIVERY_ACK_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `conversation:delivered:${current.dbUserId}:${id}`,
      DELIVERY_ACK_RATE_LIMIT,
      DELIVERY_ACK_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, DELIVERY_ACK_RATE_LIMIT, {
        code: "rate_limit.exceeded",
        message: "Too many requests",
      });
    }

    const result = await markConversationDelivered(current, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, "Could not acknowledge message delivery");
  }
}
