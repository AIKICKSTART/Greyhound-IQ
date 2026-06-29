import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  getPublicListingById,
  updateListingForCurrentUser,
} from "@/lib/listing-service";
import { listingPatchSchema } from "@/lib/listing-validation";

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
    const parsed = listingPatchSchema.parse(await request.json());
    const listing = await updateListingForCurrentUser(current, id, parsed);
    return NextResponse.json({ item: listing });
  } catch (err) {
    return jsonError(err, "Could not update listing");
  }
}
