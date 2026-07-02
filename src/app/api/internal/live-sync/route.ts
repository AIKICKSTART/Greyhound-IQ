import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { syncLiveData, type SyncScope } from "@/lib/live/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return runLiveSync(request);
}

export async function POST(request: NextRequest) {
  return runLiveSync(request);
}

async function runLiveSync(request: NextRequest) {
  try {
    requireInternalRequest(request);
    const result = await syncLiveData(
      daysFromRequest(request),
      scopeFromRequest(request)
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Could not sync live racing data");
  }
}

function scopeFromRequest(request: NextRequest): SyncScope {
  const raw = request.nextUrl.searchParams.get("scope") ?? "upcoming";
  if (raw === "upcoming" || raw === "results" || raw === "all") {
    return raw;
  }
  throw new Error("live.scope_invalid");
}

function daysFromRequest(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return 7;

  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new Error("live.days_invalid");
  }

  return days;
}
