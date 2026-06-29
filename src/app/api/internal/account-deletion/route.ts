import { NextResponse } from "next/server";
import { runAccountDeletionMaintenance } from "@/lib/account-service";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const result = await runAccountDeletionMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run account deletion maintenance");
  }
}
