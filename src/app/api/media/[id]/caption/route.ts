import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deleteMediaCaptionForCurrentUser,
  replaceMediaCaptionForCurrentUser,
} from "@/lib/media-service";
import { readWebVttUpload } from "@/lib/media-validation";

const MEDIA_CAPTION_RATE_LIMIT = 5;
const MEDIA_CAPTION_RATE_LIMIT_WINDOW_MS = 60_000;

async function captionRequestContext(
  params: Promise<{ id: string }>,
  operation: "replace" | "delete"
) {
  const [{ id }, current] = await Promise.all([
    params,
    requireCurrentUserProfile(),
  ]);
  const rateLimit = await checkRateLimit(
    `media:caption:${operation}:${current.dbUserId}:${id}`,
    MEDIA_CAPTION_RATE_LIMIT,
    MEDIA_CAPTION_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");
  return { id, current };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id, current } = await captionRequestContext(params, "replace");
    const bytes = await readWebVttUpload(request);
    const item = await replaceMediaCaptionForCurrentUser(current, id, bytes);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not attach captions");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id, current } = await captionRequestContext(params, "delete");
    const item = await deleteMediaCaptionForCurrentUser(current, id);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not remove captions");
  }
}
