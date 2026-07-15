import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { createListingForCurrentUser } from "@/lib/listing-service";
import { listingWriteSchema } from "@/lib/listing-validation";
import { getMarketplaceListings } from "@/lib/queries";

import { listingApiQuerySchema, queryParamsObject } from "@/lib/query-validation";
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
      LISTING_CREATE_RATE_LIMIT_WINDOW_MS
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

    const parsed = listingWriteSchema.parse(await request.json());
    const listing = await createListingForCurrentUser(current, parsed);

    return NextResponse.json({ item: listing }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create listing");
  }
}
