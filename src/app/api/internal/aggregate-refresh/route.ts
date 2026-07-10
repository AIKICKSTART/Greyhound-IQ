import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { refreshAggregateMaterializedViews } from "@/lib/live/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(request: NextRequest) {
  try {
    requireInternalRequest(request);
    const result = await refreshAggregateMaterializedViews();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not refresh aggregate racing data");
  }
}
