import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { markListingSoldForCurrentUser } from "@/lib/listing-service";

const LISTING_SOLD_RATE_LIMIT = 3;
const LISTING_SOLD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

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
      `listing:sold:${current.dbUserId}:${id}`,
      LISTING_SOLD_RATE_LIMIT,
      LISTING_SOLD_RATE_LIMIT_WINDOW_MS
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

    const listing = await markListingSoldForCurrentUser(current, id);
    return NextResponse.json({ item: listing });
  } catch (err) {
    return jsonError(err, "Could not mark listing sold");
  }
}
