import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { runNotificationDeliveryMaintenance } from "@/lib/notification-service";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const result = await runNotificationDeliveryMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run notification delivery");
  }
}
