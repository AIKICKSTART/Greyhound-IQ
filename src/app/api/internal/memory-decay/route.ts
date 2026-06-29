import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { runMemoryMaintenance } from "@/lib/agent-service";
import { requireInternalRequest } from "@/lib/internal-auth";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const result = await runMemoryMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run memory maintenance");
  }
}
