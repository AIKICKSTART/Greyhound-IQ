import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { runCallMaintenance } from "@/lib/call-service";
import { requireInternalRequest } from "@/lib/internal-auth";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const result = await runCallMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run call maintenance");
  }
}
