import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { createMediaDownloadUrl } from "@/lib/media-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const item = await createMediaDownloadUrl(
      current,
      id,
      new URL(request.url).origin
    );

    return NextResponse.json(item);
  } catch (err) {
    return jsonError(err, "Could not sign media URL");
  }
}
