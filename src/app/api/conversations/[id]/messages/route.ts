import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  getConversationForProfile,
  sendConversationMessage,
} from "@/lib/conversation-service";
import { conversationMessageSchema } from "@/lib/conversation-validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const conversation = await getConversationForProfile(id, current.profileId);
    return NextResponse.json({ items: conversation.messages });
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
    const parsed = conversationMessageSchema.parse(await request.json());
    const message = await sendConversationMessage(current, id, parsed);
    return NextResponse.json({ item: message }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not send message");
  }
}
