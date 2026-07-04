import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { runMediaMaintenance } from "@/lib/media-service";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const result = await runMediaMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run media maintenance");
  }
}
