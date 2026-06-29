import { NextResponse } from "next/server";
import { listAgentRunsForCurrentUser } from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const runs = await listAgentRunsForCurrentUser(current);
    return NextResponse.json({ items: runs });
  } catch (err) {
    return jsonError(err, "Could not load agent runs");
  }
}
