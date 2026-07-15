import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { runMediaMaintenance } from "@/lib/media-service";
import { runLinkPreviewMaintenance } from "@/lib/link-preview-worker";
import { executeScheduledTask } from "@/lib/scheduled-task-control";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const execution = await executeScheduledTask("media-maintenance", () =>
      Promise.all([runMediaMaintenance(), runLinkPreviewMaintenance()]),
    );
    if (execution.status === "overlap") {
      return NextResponse.json({ ok: true, skipped: "overlap" });
    }
    const [media, linkPreviews] = execution.value;
    return NextResponse.json({ ok: true, media, linkPreviews });
  } catch (err) {
    return jsonError(err, "Could not run media maintenance");
  }
}
