import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";
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
  return { id, current, rateLimit };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id, current, rateLimit } = await captionRequestContext(
      params,
      "replace"
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MEDIA_CAPTION_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
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
    const { id, current, rateLimit } = await captionRequestContext(
      params,
      "delete"
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MEDIA_CAPTION_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const item = await deleteMediaCaptionForCurrentUser(current, id);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not remove captions");
  }
}
