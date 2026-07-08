// Authoritative Content-Security-Policy. Built per-request in the proxy so
// script-src can carry a fresh nonce (next.config.ts headers() is static and
// cannot mint one). Keep this in sync with the origins the app actually talks
// to: Supabase (REST + realtime ws), LiveKit, and the race-replay media hosts.
const replayFrameOrigins =
  "https://www.youtube-nocookie.com https://player.vimeo.com";
const replayMediaOrigins =
  "https://www.thedogs.com.au https://mediarqs.skyracing.com.au https://tasracing-race-replays.s3.ap-southeast-2.amazonaws.com";

export function contentSecurityPolicy(nonce: string) {
  const supa = safeOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supaWs = supa?.replace(/^http/, "ws");
  const lk = safeOrigin(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const isDev = process.env.NODE_ENV !== "production";
  const devWs = isDev ? "ws://localhost:* ws://127.0.0.1:*" : undefined;

  const join = (...parts: Array<string | undefined>) =>
    parts.filter(Boolean).join(" ");

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
    join("img-src 'self' data: blob:", supa),
    join("media-src 'self' blob:", supa, replayMediaOrigins),
    join("connect-src 'self'", supa, supaWs, lk, devWs),
    join("frame-src 'self'", replayFrameOrigins),
    "worker-src 'self' blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
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
