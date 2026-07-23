import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { getTipsPreview } from "@/lib/tips-preview";

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const response = NextResponse.json(getTipsPreview(current));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return jsonError(error, "Could not load the Tips preview");
  }
}
