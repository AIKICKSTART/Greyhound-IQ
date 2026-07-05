import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { createListingEnquiryForCurrentUser } from "@/lib/listing-service";
import { listingEnquirySchema } from "@/lib/listing-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const LISTING_ENQUIRY_RATE_LIMIT = 5;
const LISTING_ENQUIRY_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `listing:enquiry:${current.dbUserId}:${id}`,
      LISTING_ENQUIRY_RATE_LIMIT,
      LISTING_ENQUIRY_RATE_LIMIT_WINDOW_MS
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

    const parsed = listingEnquirySchema.parse(await request.json());
    const result = await createListingEnquiryForCurrentUser(
      current,
      id,
      parsed.message
    );
    return NextResponse.json({
      item: {
        conversationId: result.conversationId,
        enquiryId: result.enquiry.id,
      },
    });
  } catch (err) {
    return jsonError(err, "Could not send listing enquiry");
  }
}
