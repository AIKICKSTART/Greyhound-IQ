import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { runAgentCleanup } from "@/lib/agent-service";
import { requireInternalRequest } from "@/lib/internal-auth";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const result = await runAgentCleanup();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run agent cleanup");
  }
}
