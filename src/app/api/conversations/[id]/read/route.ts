import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { markConversationRead } from "@/lib/conversation-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const count = await markConversationRead(current, id);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return jsonError(err, "Could not mark conversation read");
  }
}
