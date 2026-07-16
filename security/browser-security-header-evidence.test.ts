import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import nextConfig from "../next.config";
import { contentSecurityPolicy } from "../src/lib/csp";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  BROWSER_SECURITY_HEADER_MASTER_EVIDENCE,
  VERIFIED_BROWSER_SECURITY_HEADER_IDS,
} from "./browser-security-header-evidence";

async function main() {
const originalNodeEnvironment = process.env.NODE_ENV;
const originalDevicePreviews = process.env.ENABLE_DEVICE_PREVIEWS;
let csp = "";
Reflect.set(process.env, "NODE_ENV", "production");
delete process.env.ENABLE_DEVICE_PREVIEWS;
try {
  const headerGroups = await nextConfig.headers?.();
  assert.ok(headerGroups);
  const globalHeaders = headerGroups.find((group) => group.source === "/:path*");
  assert.ok(globalHeaders);
  const headers = new Map(
    globalHeaders.headers.map(({ key, value }) => [key, value]),
  );
  assert.equal(
    headers.get("Strict-Transport-Security"),
    "max-age=63072000; includeSubDomains",
  );
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("Cross-Origin-Opener-Policy"), "same-origin");
  assert.equal(headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.equal(headers.has("Cross-Origin-Embedder-Policy"), false);
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(
    headers.get("Permissions-Policy"),
    "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
  );
  csp = contentSecurityPolicy("evidence-nonce");
} finally {
  if (originalNodeEnvironment === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Reflect.set(process.env, "NODE_ENV", originalNodeEnvironment);
  if (originalDevicePreviews === undefined) delete process.env.ENABLE_DEVICE_PREVIEWS;
  else process.env.ENABLE_DEVICE_PREVIEWS = originalDevicePreviews;
}

assert.match(csp, /default-src 'self'/);
assert.match(
  csp,
  /script-src 'self' 'nonce-evidence-nonce' 'strict-dynamic'/,
);
assert.match(csp, /frame-ancestors 'none'/);
assert.match(csp, /object-src 'none'/);
assert.match(csp, /base-uri 'self'/);
assert.match(csp, /form-action 'self'/);
const scriptDirective = csp
  .split(";")
  .find((directive) => directive.trim().startsWith("script-src"));
assert.ok(scriptDirective);
assert.doesNotMatch(scriptDirective, /'unsafe-inline'|'unsafe-eval'/);

const proxySource = readFileSync("src/proxy.ts", "utf8");
assert.match(
  proxySource,
  /requestHeaders\.set\("Content-Security-Policy", csp\)/,
);
assert.match(
  proxySource,
  /response\.headers\.set\("Content-Security-Policy", csp\)/,
);
assert.match(
  proxySource,
  /response\.headers\.set\("Cache-Control", "no-store"\)/,
);

const authkitSessionSource = readFileSync(
  "node_modules/@workos-inc/authkit-nextjs/dist/esm/session.js",
  "utf8",
);
const authkitUtilitySource = readFileSync(
  "node_modules/@workos-inc/authkit-nextjs/dist/esm/utils.js",
  "utf8",
);
assert.match(
  authkitSessionSource,
  /request\.cookies\.has\(cookieName\)[\s\S]*request\.headers\.has\('authorization'\)/,
);
assert.match(authkitSessionSource, /varyValues = new Set\(\['cookie'\]\)/);
assert.match(authkitSessionSource, /setCachePreventionHeaders\(headers\)/);
assert.match(
  authkitUtilitySource,
  /Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0'/,
);

const workosCookieSource = readFileSync(
  "node_modules/@workos-inc/authkit-nextjs/dist/esm/cookie.js",
  "utf8",
);
assert.match(workosCookieSource, /const sameSite = WORKOS_COOKIE_SAMESITE \|\| 'lax'/);
assert.match(workosCookieSource, /path: '\/'/);
assert.match(workosCookieSource, /httpOnly: true/);
assert.match(workosCookieSource, /secure,/);
assert.match(workosCookieSource, /sameSite,/);
assert.match(workosCookieSource, /secure = url\.protocol === 'https:'/);

const workosPolicySource = readFileSync("src/lib/workos-env.ts", "utf8");
assert.match(workosPolicySource, /sameSite !== "lax" && sameSite !== "strict"/);
assert.match(
  workosPolicySource,
  /redirect\.protocol !== "https:" && !loopback/,
);
assert.match(
  readFileSync(".env.example", "utf8"),
  /WORKOS_COOKIE_SAMESITE="lax"/,
);

assert.equal(VERIFIED_BROWSER_SECURITY_HEADER_IDS.length, 10);
for (const requirementId of VERIFIED_BROWSER_SECURITY_HEADER_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    BROWSER_SECURITY_HEADER_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "browser security headers passed: all 10 source controls tested",
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
