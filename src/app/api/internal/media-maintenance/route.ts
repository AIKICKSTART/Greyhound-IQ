import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireInternalRequest } from "@/lib/internal-auth";
import { runMediaMaintenance } from "@/lib/media-service";
import { runLinkPreviewMaintenance } from "@/lib/link-preview-worker";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const [media, linkPreviews] = await Promise.all([
      runMediaMaintenance(),
      runLinkPreviewMaintenance(),
    ]);
    return NextResponse.json({ ok: true, media, linkPreviews });
  } catch (err) {
    return jsonError(err, "Could not run media maintenance");
  }
}
