import { NextResponse } from "next/server";
import { proxiedStreamPath, verifyStreamToken } from "@/lib/live/replay-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Same-origin media proxy: hides the provider origin from the browser. The
// target is HMAC-signed (see replay-proxy.ts) so this is not an open relay.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const target = verifyStreamToken(params.get("u") ?? "", params.get("s") ?? "");
  if (!target) {
    return NextResponse.json({ error: "invalid stream token" }, { status: 403 });
  }

  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept: "*/*",
        ...(range ? { range } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const isManifest =
    target.toLowerCase().includes(".m3u8") ||
    contentType.includes("mpegurl");

  if (isManifest) {
    const body = rewriteManifest(await upstream.text(), target);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  // Segments / progressive mp4: stream bytes through, preserving range support.
  const headers = new Headers();
  copyHeader(upstream, headers, "content-type");
  copyHeader(upstream, headers, "content-length");
  copyHeader(upstream, headers, "content-range");
  copyHeader(upstream, headers, "accept-ranges");
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

// Rewrites every URI in an HLS playlist to route back through this proxy, so
// nested playlists and segments also stay same-origin. Relative URIs are
// resolved against the manifest URL first.
function rewriteManifest(manifest: string, manifestUrl: string): string {
  return manifest
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      // URI="..." inside tags (e.g. EXT-X-KEY, EXT-X-MAP, MEDIA).
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
          const proxied = proxyAbsolute(uri, manifestUrl);
          return proxied ? `URI="${proxied}"` : `URI="${uri}"`;
        });
      }
      // Bare URI line (segment or variant playlist).
      const proxied = proxyAbsolute(trimmed, manifestUrl);
      return proxied ?? line;
    })
    .join("\n");
}

function proxyAbsolute(uri: string, baseUrl: string): string | null {
  try {
    const absolute = new URL(uri, baseUrl).toString();
    return proxiedStreamPath(absolute);
  } catch {
    return null;
  }
}

function copyHeader(from: Response, to: Headers, name: string) {
  const value = from.headers.get(name);
  if (value) to.set(name, value);
}
