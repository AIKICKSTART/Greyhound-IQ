import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { syncDogProfilesBatch } from "@/lib/live/dog-profile-sync";
import { requireInternalRequest } from "@/lib/internal-auth";
import { executeScheduledTask } from "@/lib/scheduled-task-control";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const limitParam = new URL(request.url).searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const execution = await executeScheduledTask("dog-profile-sync", () =>
      syncDogProfilesBatch({
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    );
    if (execution.status === "overlap") {
      return NextResponse.json({ ok: true, skipped: "overlap" });
    }
    const result = execution.value;
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run dog profile sync");
  }
}
