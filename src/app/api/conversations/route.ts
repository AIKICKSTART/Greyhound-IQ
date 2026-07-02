import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  listConversationsForProfile,
  startOrGetConversation,
} from "@/lib/conversation-service";
import { conversationStartSchema } from "@/lib/conversation-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const CONVERSATION_START_RATE_LIMIT = 5;
const CONVERSATION_START_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const conversations = await listConversationsForProfile(current.profileId);
    return NextResponse.json({ items: conversations });
  } catch (err) {
    return jsonError(err, "Could not load conversations");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = checkRateLimit(
      `conversation:start:${current.dbUserId}`,
      CONVERSATION_START_RATE_LIMIT,
      CONVERSATION_START_RATE_LIMIT_WINDOW_MS
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

    const parsed = conversationStartSchema.parse(await request.json());
    const recipientId = parsed.recipientProfileId ?? parsed.recipientId;
    if (!recipientId) throw new Error("conversation.recipient_required");

    const conversation = await startOrGetConversation(current, recipientId);
    return NextResponse.json({ item: conversation }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not start conversation");
  }
}
