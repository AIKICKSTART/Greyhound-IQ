import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { syncDogProfilesBatch } from "@/lib/live/dog-profile-sync";
import { requireInternalRequest } from "@/lib/internal-auth";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const limitParam = new URL(request.url).searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const result = await syncDogProfilesBatch({
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not run dog profile sync");
  }
}
