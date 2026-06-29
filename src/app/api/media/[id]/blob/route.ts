import { Readable } from "stream";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { getMediaBlob } from "@/lib/media-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([params, getCurrentUser()]);
    const url = new URL(request.url);
    const { media, stream } = await getMediaBlob(
      id,
      current,
      url.searchParams.get("expires"),
      url.searchParams.get("token")
    );

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, max-age=60",
        "Content-Type": media.mimeType,
        "Content-Length": media.sizeBytes.toString(),
      },
    });
  } catch (err) {
    return jsonError(err, "Could not load media file");
  }
}
