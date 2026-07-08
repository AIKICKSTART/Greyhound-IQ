// Trusted client-IP extraction for requests behind our proxy chain.
//
// Topology: browser -> GCP global external HTTPS LB (serverless NEG) -> Cloud Run.
// Cloud Run's own front-end proxy appends the immediate upstream (the LB/GFE hop)
// as the RIGHTMOST X-Forwarded-For entry. Everything to the left of the trusted
// hops is client-controlled and spoofable, so we must NOT trust the leftmost
// entry. We walk in from the right by exactly TRUSTED_PROXY_HOPS and take the
// entry the trusted proxies observed as the client.
//
// Default TRUSTED_PROXY_HOPS = 1: with a chain "<spoofed...>, REAL, LB", the
// rightmost (index length-1) is the LB hop Cloud Run appended, and index
// length-2 is the real client IP the LB saw. Override via TRUSTED_PROXY_HOPS
// when the proxy count changes. In local dev there is no proxy (no XFF header),
// so getClientIp returns null and callers fall back to "unknown".

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) return DEFAULT_TRUSTED_PROXY_HOPS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_TRUSTED_PROXY_HOPS;
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIp(value: string): boolean {
  if (IPV4.test(value)) {
    return value.split(".").every((octet) => Number.parseInt(octet, 10) <= 255);
  }
  // IPv6: hex groups and ":" separators, optionally with a "::" run or an
  // embedded IPv4 tail. Reject anything with other characters (junk tokens).
  return value.includes(":") && /^[0-9a-fA-F:.]+$/.test(value) && value.length <= 45;
}

/**
 * Returns the trusted client IP from X-Forwarded-For, or null when the header
 * is absent (local dev) or contains no valid IP. Never trusts the leftmost
 * (spoofable) entry: it indexes in from the right by TRUSTED_PROXY_HOPS and
 * steps further left past any junk until it finds a valid IP literal.
 */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;

  const entries = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) return null;

  const start = Math.max(0, entries.length - 1 - trustedProxyHops());
  for (let i = start; i >= 0; i--) {
    if (isValidIp(entries[i])) return entries[i];
  }
  return null;
}
