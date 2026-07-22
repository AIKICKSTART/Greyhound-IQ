// Authoritative Content-Security-Policy. Built per-request in the proxy so
// script-src can carry a fresh nonce (next.config.ts headers() is static and
// cannot mint one). Keep this in sync with the origins the app actually talks
// to: Supabase (REST + realtime ws), GCS, LiveKit, and race-replay media hosts.
// Replay embeds are third-party iframes (frame-src). Replay video/HLS streams
// are proxied same-origin via /api/replay/stream, so no provider media/connect
// origins are needed here — the browser only ever talks to 'self'.
const replayFrameOrigins =
  "https://www.youtube-nocookie.com https://player.vimeo.com";
// GRV FastTrack photo-finish images (Race.photoFinishUrl) are static JPEGs on
// GRV's public Azure blob storage; the browser loads them directly. Shared by
// the race-detail renderer and the replay backfill as the only accepted origin.
export const PHOTO_FINISH_IMAGE_ORIGIN =
  "https://grvaueprdfasttrackstr03.blob.core.windows.net";

export function safePhotoFinishSrc(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin !== PHOTO_FINISH_IMAGE_ORIGIN ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(nonce: string) {
  const supa = safeOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supaWs = supa?.replace(/^http/, "ws");
  const gcs =
    process.env.OBJECT_STORAGE_PROVIDER?.trim().toLowerCase() === "gcs"
      ? "https://storage.googleapis.com"
      : undefined;
  const lk = safeOrigin(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const isDev = process.env.NODE_ENV !== "production";
  const allowSameOriginFrames =
    isDev || process.env.ENABLE_DEVICE_PREVIEWS === "true";
  const devWs = isDev ? "ws://localhost:* ws://127.0.0.1:*" : undefined;

  const join = (...parts: Array<string | undefined>) =>
    parts.filter(Boolean).join(" ");

  // Keyless map sources for the Vet Finder (MapLibre): OpenFreeMap vector
  // styles/tiles/glyphs/sprites, Esri World Imagery satellite, OSM raster
  // fallback. Vector tiles + style JSON + glyphs load via fetch (connect-src);
  // sprites and raster tiles are images (img-src).
  const mapHosts =
    "https://tiles.openfreemap.org https://server.arcgisonline.com https://tile.openstreetmap.org https://tiles.mapterhorn.com";

  // 'strict-dynamic' lets nonce-trusted Next bootstrap scripts load the rest of
  // the bundle graph without listing every hashed chunk. 'unsafe-eval' is only
  // needed in dev, where React uses eval for readable server error stacks.
  const scriptSrc = join(
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : undefined
  );

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    join("img-src 'self' data: blob:", supa, gcs, PHOTO_FINISH_IMAGE_ORIGIN, mapHosts),
    join("media-src 'self' blob:", supa, gcs),
    join("connect-src 'self'", supa, supaWs, gcs, lk, devWs, mapHosts),
    join("frame-src 'self'", replayFrameOrigins),
    "worker-src 'self' blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    allowSameOriginFrames
      ? "frame-ancestors 'self'"
      : "frame-ancestors 'none'",
  ].join("; ");
}

function safeOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}
