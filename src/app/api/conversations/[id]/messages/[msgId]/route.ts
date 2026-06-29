import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { softDeleteConversationMessage } from "@/lib/conversation-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const [{ id, msgId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const message = await softDeleteConversationMessage(current, id, msgId);
    return NextResponse.json({ item: message });
  } catch (err) {
    return jsonError(err, "Could not delete message");
  }
}
