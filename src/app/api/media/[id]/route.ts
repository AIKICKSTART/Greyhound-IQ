import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deleteMediaForCurrentUser,
  getMediaForCurrentUser,
} from "@/lib/media-service";

const MEDIA_DELETE_RATE_LIMIT = 3;
const MEDIA_DELETE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const item = await getMediaForCurrentUser(current, id);

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
    const rateLimit = checkRateLimit(
      `media:delete:${current.dbUserId}:${id}`,
      MEDIA_DELETE_RATE_LIMIT,
      MEDIA_DELETE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit.exceeded",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const item = await deleteMediaForCurrentUser(current, id);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete media");
  }
}
