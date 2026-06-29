import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { renewListingForCurrentUser } from "@/lib/listing-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const listing = await renewListingForCurrentUser(current, id);
    return NextResponse.json({ item: listing });
  } catch (err) {
    return jsonError(err, "Could not renew listing");
  }
}
