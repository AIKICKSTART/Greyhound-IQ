import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { refreshAggregateMaterializedViews } from "@/lib/live/sync";
import { executeScheduledTask } from "@/lib/scheduled-task-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Hobby caps functions at 300s. Self-hosted/Cloud Run deployments apply
// their own request timeout, so this portable value does not shorten that path.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    requireInternalRequest(request);
    const execution = await executeScheduledTask("aggregate-refresh", () =>
      refreshAggregateMaterializedViews(),
    );
    if (execution.status === "overlap") {
      return NextResponse.json({ ok: true, skipped: "overlap" });
    }
    const result = execution.value;
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not refresh aggregate racing data");
  }
}
