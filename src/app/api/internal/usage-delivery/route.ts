import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { runUsageDeliveryMaintenance } from "@/lib/billing/usage-delivery-service";
import { requireInternalRequest } from "@/lib/internal-auth";
import { executeScheduledTask } from "@/lib/scheduled-task-control";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const execution = await executeScheduledTask("usage-delivery", () =>
      runUsageDeliveryMaintenance(),
    );
    if (execution.status === "overlap") {
      return NextResponse.json({ ok: true, skipped: "overlap" });
    }
    return NextResponse.json({ ok: true, ...execution.value });
  } catch (error) {
    return jsonError(error, "Could not deliver usage events");
  }
}
