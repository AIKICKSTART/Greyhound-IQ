import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { acceptLocalUpload } from "@/lib/media-service";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const item = await acceptLocalUpload(
      id,
      url.searchParams.get("expires"),
      url.searchParams.get("token"),
      request
    );

    return NextResponse.json(item);
  } catch (err) {
    return jsonError(err, "Could not upload media");
  }
}
