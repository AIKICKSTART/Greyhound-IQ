import { NextResponse } from "next/server";
import { cancelAgentRunForCurrentUser } from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const cancelled = await cancelAgentRunForCurrentUser(current, id);

    return NextResponse.json({ item: cancelled });
  } catch (err) {
    return jsonError(err, "Could not cancel agent run");
  }
}
