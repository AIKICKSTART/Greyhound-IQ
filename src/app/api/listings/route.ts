import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { createListingForCurrentUser } from "@/lib/listing-service";
import { listingWriteSchema } from "@/lib/listing-validation";
import { getMarketplaceListings } from "@/lib/queries";

const STATES = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"]);
const TYPES = new Set([
  "pup_for_sale",
  "dog_for_sale",
  "stud_service",
  "wanted",
  "share",
]);
const SORTS = new Set(["created_at", "price", "expires_at"]);
const LISTING_CREATE_RATE_LIMIT = 3;
const LISTING_CREATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = boundedLimit(searchParams.get("limit"));
  const listings = await getMarketplaceListings(limit, {
    type: valueFromSet(searchParams.get("type"), TYPES),
    state: valueFromSet(searchParams.get("state"), STATES),
    dogId: searchParams.get("dog") || searchParams.get("dogId"),
    q: searchParams.get("q"),
    status: searchParams.get("status") === "sold" ? "sold" : "active",
    sort: valueFromSet(searchParams.get("sort"), SORTS) as
      | "created_at"
      | "price"
      | "expires_at"
      | null,
  });
  return NextResponse.json({ items: listings });
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = checkRateLimit(
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

function boundedLimit(raw: string | null) {
  const parsed = Number(raw ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function valueFromSet(value: string | null, allowed: Set<string>) {
  return value && allowed.has(value) ? value : null;
}
