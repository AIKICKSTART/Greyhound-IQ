import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { renewListingForCurrentUser } from "@/lib/listing-service";
import { checkRateLimit } from "@/lib/rate-limit";

const LISTING_RENEW_RATE_LIMIT = 3;
const LISTING_RENEW_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = checkRateLimit(
      `listing:renew:${current.dbUserId}:${id}`,
      LISTING_RENEW_RATE_LIMIT,
      LISTING_RENEW_RATE_LIMIT_WINDOW_MS
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

    const listing = await renewListingForCurrentUser(current, id);
    return NextResponse.json({ item: listing });
  } catch (err) {
    return jsonError(err, "Could not renew listing");
  }
}
