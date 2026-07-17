import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { checkRateLimit } from "@/lib/rate-limit";
import { finalizeMediaUpload } from "@/lib/media-service";
import { mediaFinalizeSchema } from "@/lib/media-validation";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

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
    const rateLimit = await checkRateLimit(
      `media:finalize:${current.dbUserId}:${id}`,
      MEDIA_FINALIZE_RATE_LIMIT,
      MEDIA_FINALIZE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MEDIA_FINALIZE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = mediaFinalizeSchema.parse(await readBoundedJsonRequest(request));
    const item = await finalizeMediaUpload(current, id, parsed);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not finalize media");
  }
}
