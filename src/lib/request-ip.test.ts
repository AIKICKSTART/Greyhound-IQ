import assert from "node:assert/strict";
import { getClientIp } from "./request-ip";

function headers(xff?: string): Headers {
  const h = new Headers();
  if (xff !== undefined) h.set("x-forwarded-for", xff);
  return h;
}

// Default hops = 1: rightmost is the LB hop Cloud Run appended, so the trusted
// client is second-from-right. Leftmost entries are attacker-spoofable.
assert.equal(getClientIp(headers("1.2.3.4, 5.6.7.8, 203.0.113.9, 10.0.0.1")), "203.0.113.9");

// Single entry with hops=1: start index clamps to 0, that entry is validated.
assert.equal(getClientIp(headers("203.0.113.9")), "203.0.113.9");

// No header (local dev) -> null.
assert.equal(getClientIp(headers()), null);

// Empty / whitespace-only header -> null.
assert.equal(getClientIp(headers("")), null);
assert.equal(getClientIp(headers("   ")), null);

// Garbage at the trusted position: step further left to the first valid IP.
assert.equal(getClientIp(headers("203.0.113.9, not-an-ip, LB")), "203.0.113.9");

// All-garbage chain -> null (never fabricate an IP).
assert.equal(getClientIp(headers("junk, garbage, nope")), null);

// IPv6 client address is preserved.
assert.equal(
  getClientIp(headers("2001:db8::1, 2001:db8::abcd, 2001:db8::ff")),
  "2001:db8::abcd"
);

// Out-of-range IPv4 octet is rejected as junk; steps left to the valid one.
assert.equal(getClientIp(headers("198.51.100.7, 999.1.1.1, LB")), "198.51.100.7");

// Configurable hop count: hops=2 trusts third-from-right.
process.env.TRUSTED_PROXY_HOPS = "2";
assert.equal(getClientIp(headers("1.2.3.4, 203.0.113.9, proxy, LB")), "203.0.113.9");
delete process.env.TRUSTED_PROXY_HOPS;

console.log("request-ip tests passed");
