import { NextResponse } from "next/server";
import {
  agentRunSchema,
  normalizeAgentType,
  runAgentForCurrentUser,
} from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const AGENT_RUN_RATE_LIMIT = 10;
const AGENT_RUN_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  if (isEmergencyControlActive(process.env.AI_DISABLED)) {
    return emergencyControlResponse();
  }

  try {
    const [{ type }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `agent-run:${current.dbUserId}`,
      AGENT_RUN_RATE_LIMIT,
      AGENT_RUN_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        AGENT_RUN_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const agentType = normalizeAgentType(type);
    if (!agentType) throw new Error("agent.not_found");
    const parsed = agentRunSchema.parse(await readBoundedJsonRequest(request));
    const run = await runAgentForCurrentUser(current, agentType, parsed);

    return NextResponse.json(
      {
        runId: run.id,
        status: run.status,
        createdAt: run.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(err, "Could not run agent");
  }
}
