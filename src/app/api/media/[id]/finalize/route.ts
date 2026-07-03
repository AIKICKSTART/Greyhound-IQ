import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { finalizeMediaUpload } from "@/lib/media-service";
import { mediaFinalizeSchema } from "@/lib/media-validation";

const MEDIA_FINALIZE_RATE_LIMIT = 5;
const MEDIA_FINALIZE_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = checkRateLimit(
      `media:finalize:${current.dbUserId}:${id}`,
      MEDIA_FINALIZE_RATE_LIMIT,
      MEDIA_FINALIZE_RATE_LIMIT_WINDOW_MS
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

    const body = await request.json().catch(() => ({}));
    const parsed = mediaFinalizeSchema.parse(body);
    const item = await finalizeMediaUpload(current, id, parsed);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not finalize media");
  }
}
