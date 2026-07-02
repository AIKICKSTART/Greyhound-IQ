import { NextResponse } from "next/server";
import { z } from "zod";
import { requestAccountDeletion } from "@/lib/account-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";

const deletionRequestSchema = z.object({
  confirm: z.literal("DELETE"),
});

const ACCOUNT_DELETE_RATE_LIMIT = 3;
const ACCOUNT_DELETE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = checkRateLimit(
      `account-delete:request:${current.dbUserId}`,
      ACCOUNT_DELETE_RATE_LIMIT,
      ACCOUNT_DELETE_RATE_LIMIT_WINDOW_MS
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
