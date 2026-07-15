import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { syncLiveData, type SyncScope } from "@/lib/live/sync";
import { executeScheduledTask } from "@/lib/scheduled-task-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return runLiveSync(request);
}

async function runLiveSync(request: NextRequest) {
  try {
    requireInternalRequest(request);
    const scope = scopeFromRequest(request);
    const execution = await executeScheduledTask("live-sync", () =>
      syncLiveData(daysFromRequest(request, scope), scope),
    );
    if (execution.status === "overlap") {
      return NextResponse.json({ ok: true, skipped: "overlap" });
    }
    const result = execution.value;
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

function daysFromRequest(request: NextRequest, scope: SyncScope) {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return scope === "results" ? 7 : 31;

  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 31) {
    throw new Error("live.days_invalid");
  }

  return days;
}
