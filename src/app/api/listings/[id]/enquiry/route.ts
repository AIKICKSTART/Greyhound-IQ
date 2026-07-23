import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { createListingEnquiryForCurrentUser } from "@/lib/listing-service";
import { listingEnquirySchema } from "@/lib/listing-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

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
      LISTING_ENQUIRY_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        LISTING_ENQUIRY_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = listingEnquirySchema.parse(await readBoundedJsonRequest(request));
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
