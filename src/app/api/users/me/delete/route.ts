import { NextResponse } from "next/server";
import { z } from "zod";
import { requestAccountDeletion } from "@/lib/account-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";

const deletionRequestSchema = z.object({
  confirm: z.literal("DELETE"),
});

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    deletionRequestSchema.parse(await request.json());

    const requestedAt = await requestAccountDeletion(current, {
      ip: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      deletionRequestedAt: requestedAt,
      graceDays: 30,
    });
  } catch (err) {
    return jsonError(err, "Could not request account deletion");
  }
}
