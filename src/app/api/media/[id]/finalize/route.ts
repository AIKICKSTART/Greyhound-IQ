import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { finalizeMediaUpload } from "@/lib/media-service";
import { mediaFinalizeSchema } from "@/lib/media-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const body = await request.json().catch(() => ({}));
    const parsed = mediaFinalizeSchema.parse(body);
    const item = await finalizeMediaUpload(current, id, parsed);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not finalize media");
  }
}
