import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { toggleSavedListingForCurrentUser } from "@/lib/listing-service";
import { checkRateLimit } from "@/lib/rate-limit";

const LISTING_SAVE_RATE_LIMIT = 30;
const LISTING_SAVE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

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
      `listing:save:${current.dbUserId}:${id}`,
      LISTING_SAVE_RATE_LIMIT,
      LISTING_SAVE_RATE_LIMIT_WINDOW_MS
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

    const result = await toggleSavedListingForCurrentUser(current, id);
    return NextResponse.json({ item: result });
  } catch (err) {
    return jsonError(err, "Could not save listing");
  }
}
