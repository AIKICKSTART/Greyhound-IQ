import { NextResponse } from "next/server";
import { runAccountDeletionMaintenance } from "@/lib/account-service";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { executeScheduledTask } from "@/lib/scheduled-task-control";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const execution = await executeScheduledTask("account-deletion", () =>
      runAccountDeletionMaintenance(),
    );
    if (execution.status === "overlap") {
      return NextResponse.json({ ok: true, skipped: "overlap" });
    }
    const result = execution.value;
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run account deletion maintenance");
  }
}
