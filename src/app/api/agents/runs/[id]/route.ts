import { NextResponse } from "next/server";
import { getAgentRunForCurrentUser } from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const run = await getAgentRunForCurrentUser(current, id);
    return NextResponse.json({ item: run });
  } catch (err) {
    return jsonError(err, "Could not load agent run");
  }
}
