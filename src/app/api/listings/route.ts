import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { checkRateLimit } from "@/lib/rate-limit";
import { createListingForCurrentUser } from "@/lib/listing-service";
import { listingWriteSchema } from "@/lib/listing-validation";
import { getMarketplaceListings } from "@/lib/queries";
import { listingApiQuerySchema, queryParamsObject } from "@/lib/query-validation";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const LISTING_CREATE_RATE_LIMIT = 3;
const LISTING_CREATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const query = listingApiQuerySchema.parse(
      queryParamsObject(request.nextUrl.searchParams),
    );
    const listings = await getMarketplaceListings(query.limit, {
      type: query.type,
      categoryId: query.categoryId,
      categorySlug: query.category,
      state: query.state,
      dogId: query.dog ?? query.dogId,
      q: query.q,
      status: "active",
      sort: query.sort,
    });
    return NextResponse.json({ items: listings });
  } catch (err) {
    return jsonError(err, "Could not load listings");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `listing:create:${current.dbUserId}`,
      LISTING_CREATE_RATE_LIMIT,
      LISTING_CREATE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        LISTING_CREATE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = listingWriteSchema.parse(await readBoundedJsonRequest(request));
    const listing = await createListingForCurrentUser(current, parsed);

    return NextResponse.json({ item: listing }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create listing");
  }
}
