import { NextResponse } from "next/server";
import {
  getAgentContextForCurrentUser,
  normalizeAgentType,
} from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const url = new URL(request.url);
    const agentType = normalizeAgentType(
      url.searchParams.get("type") ?? "race_analyst"
    );
    if (!agentType) throw new Error("agent.not_found");

    const item = await getAgentContextForCurrentUser(current, agentType);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not load agent context");
  }
}
