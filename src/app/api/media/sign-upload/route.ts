import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSignedUploadIntent } from "@/lib/media-service";
import { mediaSignUploadSchema } from "@/lib/media-validation";

const SIGN_UPLOAD_RATE_LIMIT = 20;
const SIGN_UPLOAD_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = checkRateLimit(
      `media:sign-upload:${current.dbUserId}`,
      SIGN_UPLOAD_RATE_LIMIT,
      SIGN_UPLOAD_RATE_LIMIT_WINDOW_MS
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

    const parsed = mediaSignUploadSchema.parse(await request.json());
    const intent = await createSignedUploadIntent(
      current,
      parsed,
      new URL(request.url).origin
    );

    return NextResponse.json(intent, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not sign upload");
  }
}
