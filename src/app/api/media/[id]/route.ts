import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  deleteMediaForCurrentUser,
  getMediaForCurrentUser,
} from "@/lib/media-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const item = await getMediaForCurrentUser(current, id);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not load media");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const item = await deleteMediaForCurrentUser(current, id);

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete media");
  }
}
