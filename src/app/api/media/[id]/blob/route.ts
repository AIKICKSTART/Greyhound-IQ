import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  getMediaBlob,
  MediaRangeNotSatisfiableError,
} from "@/lib/media-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([params, getCurrentUser()]);
    const url = new URL(request.url);
    const { body, delivery } = await getMediaBlob(
      id,
      current,
      {
        variant: url.searchParams.get("variant"),
        range: request.headers.get("range"),
        signal: request.signal,
      }
    );

    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
      "Content-Length": delivery.contentLength.toString(),
      "Content-Type": delivery.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    });
    if (delivery.contentRange) {
      headers.set("Content-Range", delivery.contentRange);
    }
    return new Response(body, {
      headers,
      status: delivery.status,
    });
  } catch (err) {
    if (err instanceof MediaRangeNotSatisfiableError) {
      return new Response(null, {
        status: 416,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${err.sizeBytes}`,
        },
      });
    }
    return jsonError(err, "Could not load media file");
  }
}
