import { createHmac, timingSafeEqual } from "node:crypto";

// Turns a provider stream URL into an opaque same-origin path so the browser
// never sees where the data actually comes from (thedogs CDN, skyracing, S3).
// The URL is HMAC-signed so the proxy route can't be used as an open relay.
//
// Allowed provider hosts. Only these can be signed/proxied — anything else is
// rejected before signing and again at fetch time (SSRF guard).
const ALLOWED_STREAM_HOSTS = new Set([
  "d2w8yyjcswa0zt.cloudfront.net",
  "mediatdogs.skyracing.com.au",
  "mediarqs.skyracing.com.au",
  "tasracing-race-replays.s3.ap-southeast-2.amazonaws.com",
  "www.thedogs.com.au",
]);

export function isAllowedStreamHost(hostname: string) {
  return ALLOWED_STREAM_HOSTS.has(hostname);
}

function secret() {
  const value = process.env.INTERNAL_API_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("replay-proxy.secret_not_configured");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

// Returns a same-origin path like /api/replay/stream?u=..&s.. , or null if the
// URL is not a proxiable provider stream (caller falls back to no replay).
export function proxiedStreamPath(streamUrl: string | null | undefined): string | null {
  if (!streamUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(streamUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!isAllowedStreamHost(parsed.hostname)) return null;
  const u = Buffer.from(parsed.toString(), "utf8").toString("base64url");
  return `/api/replay/stream?u=${u}&s=${sign(u)}`;
}

// Verifies the signed token and returns the provider URL, or null if tampered
// or not an allowed host.
export function verifyStreamToken(u: string, s: string): string | null {
  if (!u || !s) return null;
  const expected = Buffer.from(sign(u));
  const received = Buffer.from(s);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(u, "base64url").toString("utf8");
    const parsed = new URL(decoded);
    if (!isAllowedStreamHost(parsed.hostname)) return null;
  } catch {
    return null;
  }
  return decoded;
}
