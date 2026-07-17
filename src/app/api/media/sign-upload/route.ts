import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSignedUploadIntent } from "@/lib/media-service";
import { mediaSignUploadSchema } from "@/lib/media-validation";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const SIGN_UPLOAD_RATE_LIMIT = 20;
const SIGN_UPLOAD_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  if (isEmergencyControlActive(process.env.UPLOAD_DISABLED)) {
    return emergencyControlResponse();
  }

  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `media:sign-upload:${current.dbUserId}`,
      SIGN_UPLOAD_RATE_LIMIT,
      SIGN_UPLOAD_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        SIGN_UPLOAD_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = mediaSignUploadSchema.parse(await readBoundedJsonRequest(request));
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
