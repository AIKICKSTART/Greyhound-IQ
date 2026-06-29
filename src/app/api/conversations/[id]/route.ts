import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { getConversationForProfile } from "@/lib/conversation-service";

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
    return NextResponse.json({ item: conversation });
  } catch (err) {
    return jsonError(err, "Could not load conversation");
  }
}
