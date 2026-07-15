import { NextResponse } from "next/server";
import { requestAccountDeletion } from "@/lib/account-service";
import { accountDeletionRequestSchema } from "@/lib/account-validation";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const deletionRequestSchema = accountDeletionRequestSchema;

const ACCOUNT_DELETE_RATE_LIMIT = 3;
const ACCOUNT_DELETE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `account-delete:request:${current.dbUserId}`,
      ACCOUNT_DELETE_RATE_LIMIT,
      ACCOUNT_DELETE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true }
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        ACCOUNT_DELETE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    deletionRequestSchema.parse(await readBoundedJsonRequest(request));

    const requestedAt = await requestAccountDeletion(current, {
      ip: getClientIp(request.headers),
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
