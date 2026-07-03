import { NextResponse } from "next/server";
import { cancelAgentRunForCurrentUser } from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";

const AGENT_RUN_CANCEL_RATE_LIMIT = 10;
const AGENT_RUN_CANCEL_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = checkRateLimit(
      `agent-run:cancel:${current.dbUserId}`,
      AGENT_RUN_CANCEL_RATE_LIMIT,
      AGENT_RUN_CANCEL_RATE_LIMIT_WINDOW_MS
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

    const cancelled = await cancelAgentRunForCurrentUser(current, id);

    return NextResponse.json({ item: cancelled });
  } catch (err) {
    return jsonError(err, "Could not cancel agent run");
  }
}
