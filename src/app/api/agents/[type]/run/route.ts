import { NextResponse } from "next/server";
import {
  agentRunSchema,
  normalizeAgentType,
  runAgentForCurrentUser,
} from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";

const AGENT_RUN_RATE_LIMIT = 10;
const AGENT_RUN_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const [{ type }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = checkRateLimit(
      `agent-run:${current.dbUserId}`,
      AGENT_RUN_RATE_LIMIT,
      AGENT_RUN_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit.exceeded",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const agentType = normalizeAgentType(type);
    if (!agentType) throw new Error("agent.not_found");
    const parsed = agentRunSchema.parse(await request.json());
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
