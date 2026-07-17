import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getPublicListingById,
  updateListingForCurrentUser,
} from "@/lib/listing-service";
import { listingPatchSchema } from "@/lib/listing-validation";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const LISTING_UPDATE_RATE_LIMIT = 10;
const LISTING_UPDATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listing = await getPublicListingById(id);
    return NextResponse.json({ item: listing });
  } catch (err) {
    return jsonError(err, "Could not load listing");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `listing:update:${current.dbUserId}:${id}`,
      LISTING_UPDATE_RATE_LIMIT,
      LISTING_UPDATE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        LISTING_UPDATE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = listingPatchSchema.parse(await readBoundedJsonRequest(request));
    const listing = await updateListingForCurrentUser(current, id, parsed);
    return NextResponse.json({ item: listing });
  } catch (err) {
    return jsonError(err, "Could not update listing");
  }
}
