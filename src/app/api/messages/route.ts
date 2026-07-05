import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  listConversationsForProfile,
  sendConversationMessage,
  startOrGetConversation,
} from "@/lib/conversation-service";
import { conversationMessageSchema } from "@/lib/conversation-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const MESSAGE_SEND_RATE_LIMIT = 10;
const MESSAGE_SEND_RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Legacy route: delegates to the conversation service like /api/conversations.
const sendMessageSchema = conversationMessageSchema.extend({
  recipientProfileId: z.string().trim().min(1),
});

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const conversations = await listConversationsForProfile(current.profileId);
    const items = conversations.flatMap(
      (conversation) => conversation.messages
    );
    return NextResponse.json({ items, conversations });
  } catch (err) {
    return jsonError(err, "Could not load messages");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `message:send:${current.dbUserId}`,
      MESSAGE_SEND_RATE_LIMIT,
      MESSAGE_SEND_RATE_LIMIT_WINDOW_MS
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

    const parsed = sendMessageSchema.parse(await request.json());
    const conversation = await startOrGetConversation(
      current,
      parsed.recipientProfileId
    );
    const message = await sendConversationMessage(current, conversation.id, {
      body: parsed.body,
      mediaIds: parsed.mediaIds,
    });

    return NextResponse.json({ item: message }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not send message");
  }
}
