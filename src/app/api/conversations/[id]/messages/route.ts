import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import {
  getConversationForProfile,
  sendConversationMessage,
} from "@/lib/conversation-service";
import { conversationMessageSchema } from "@/lib/conversation-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const MESSAGE_SEND_RATE_LIMIT = 10;
const MESSAGE_SEND_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MESSAGE_PAGE_SIZE = 50;

const messagesQuerySchema = z.object({
  before: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGE_PAGE_SIZE).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const { searchParams } = new URL(request.url);
    const query = messagesQuerySchema.parse({
      before: searchParams.get("before") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const conversation = await getConversationForProfile(
      current,
      id,
      query
    );
    const pageSize = query.limit ?? MESSAGE_PAGE_SIZE;
    const nextBefore =
      conversation.messages.length === pageSize
        ? conversation.messages[0].id
        : null;
    return NextResponse.json({ items: conversation.messages, nextBefore });
  } catch (err) {
    return jsonError(err, "Could not load messages");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `conversation:message:${current.dbUserId}:${id}`,
      MESSAGE_SEND_RATE_LIMIT,
      MESSAGE_SEND_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MESSAGE_SEND_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = conversationMessageSchema.parse(await readBoundedJsonRequest(request));
    const message = await sendConversationMessage(current, id, parsed);
    return NextResponse.json({ item: message }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not send message");
  }
}
