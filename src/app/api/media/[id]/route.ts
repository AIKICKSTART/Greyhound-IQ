import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deleteMediaForCurrentUser,
  getMediaStatusForCurrentUser,
  updateMediaMetadataForCurrentUser,
} from "@/lib/media-service";
import { mediaMetadataUpdateSchema } from "@/lib/media-validation";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const MEDIA_DELETE_RATE_LIMIT = 3;
const MEDIA_DELETE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MEDIA_METADATA_RATE_LIMIT = 30;
const MEDIA_METADATA_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const item = await getMediaStatusForCurrentUser(current, id);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not load media");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `media:delete:${current.dbUserId}:${id}`,
      MEDIA_DELETE_RATE_LIMIT,
      MEDIA_DELETE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MEDIA_DELETE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const item = await deleteMediaForCurrentUser(current, id);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete media");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `media:metadata:${current.dbUserId}:${id}`,
      MEDIA_METADATA_RATE_LIMIT,
      MEDIA_METADATA_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MEDIA_METADATA_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }
    const input = mediaMetadataUpdateSchema.parse(
      await readBoundedJsonRequest(request),
    );
    const item = await updateMediaMetadataForCurrentUser(current, id, input);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not update media metadata");
  }
}
