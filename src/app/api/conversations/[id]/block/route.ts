import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { setConversationBlock } from "@/lib/conversation-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
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
    const conversation = await setConversationBlock(current, id, false);
    return NextResponse.json({ item: conversation });
  } catch (err) {
    return jsonError(err, "Could not unblock conversation");
  }
}
