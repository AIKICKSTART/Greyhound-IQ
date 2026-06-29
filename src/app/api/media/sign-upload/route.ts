import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { createSignedUploadIntent } from "@/lib/media-service";
import { mediaSignUploadSchema } from "@/lib/media-validation";

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
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
