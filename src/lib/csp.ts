// Authoritative Content-Security-Policy. Built per-request in the proxy so
// script-src can carry a fresh nonce (next.config.ts headers() is static and
// cannot mint one). Keep this in sync with the origins the app actually talks
// to: Supabase (REST + realtime ws), GCS, LiveKit, and race-replay media hosts.
// Replay embeds are third-party iframes (frame-src). Replay video/HLS streams
// are proxied same-origin via /api/replay/stream, so no provider media/connect
// origins are needed here — the browser only ever talks to 'self'.
const replayFrameOrigins =
  "https://www.youtube-nocookie.com https://player.vimeo.com";

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
    join("img-src 'self' data: blob:", supa, gcs, mapHosts),
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
