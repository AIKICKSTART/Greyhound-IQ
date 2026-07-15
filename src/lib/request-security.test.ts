import assert from "node:assert/strict";
import {
  hasUnsupportedApiBodyContentType,
  hasEncodedPathSeparator,
  hasInvalidApiPathSegment,
  isBrowserCorsPreflight,
  isCrossOriginBrowserMutation,
  isUnsupportedHttpMethod,
  shouldDisableSharedApiCaching,
} from "./request-security";

const expectedOrigin = "https://greyhoundsiq.com.au";

function request(method: string, headers: Record<string, string> = {}) {
  return { method, headers: new Headers(headers) };
}

assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { origin: expectedOrigin }),
    expectedOrigin
  ),
  false
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { origin: "https://attacker.example" }),
    expectedOrigin
  ),
  true
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { "sec-fetch-site": "cross-site" }),
    expectedOrigin
  ),
  true
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { "sec-fetch-site": "same-site" }),
    expectedOrigin
  ),
  true
);
assert.equal(
  isCrossOriginBrowserMutation(request("POST"), expectedOrigin),
  false
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { cookie: "session=opaque" }),
    expectedOrigin
  ),
  true
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", {
      cookie: "session=opaque",
      "sec-fetch-site": "same-origin",
    }),
    expectedOrigin
  ),
  false
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("GET", { origin: "https://attacker.example" }),
    expectedOrigin
  ),
  false
);
assert.equal(
  isCrossOriginBrowserMutation(request("POST", { origin: "null" }), expectedOrigin),
  true
);
assert.equal(
  isCrossOriginBrowserMutation(request("POST", { origin: expectedOrigin })),
  true
);

assert.equal(
  isBrowserCorsPreflight(
    request("OPTIONS", {
      origin: "https://attacker.example",
      "access-control-request-method": "POST",
    })
  ),
  true
);
assert.equal(
  isBrowserCorsPreflight(
    request("OPTIONS", { "access-control-request-headers": "authorization" })
  ),
  true
);
assert.equal(isBrowserCorsPreflight(request("OPTIONS")), false);
assert.equal(
  isBrowserCorsPreflight(
    request("POST", { "access-control-request-method": "POST" })
  ),
  false
);

for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
  assert.equal(isUnsupportedHttpMethod(request(method)), false, method);
}
for (const method of ["TRACE", "CONNECT", "PROPFIND", "INVALID"]) {
  assert.equal(isUnsupportedHttpMethod(request(method)), true, method);
}

assert.equal(
  hasUnsupportedApiBodyContentType(
    request("POST", { "content-length": "2", "content-type": "application/json" })
  ),
  false
);

assert.equal(
  shouldDisableSharedApiCaching(request("POST"), "/api/feed"),
  true,
);
assert.equal(
  shouldDisableSharedApiCaching(
    request("GET", { cookie: "session=opaque" }),
    "/api/feed",
  ),
  true,
);
assert.equal(
  shouldDisableSharedApiCaching(
    request("GET", { authorization: "Bearer opaque" }),
    "/api/feed",
  ),
  true,
);
assert.equal(
  shouldDisableSharedApiCaching(request("GET"), "/api/health/feeds"),
  false,
);
assert.equal(
  shouldDisableSharedApiCaching(
    request("GET", { cookie: "session=opaque" }),
    "/account",
  ),
  false,
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("POST", {
      "content-length": "2",
      "content-type": "application/problem+json; charset=utf-8",
    })
  ),
  false
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("POST", {
      "content-length": "4",
      "content-type": "application/javascript",
    })
  ),
  true
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("PATCH", { "content-length": "4" })
  ),
  true
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("POST", { "content-type": "application/javascript" })
  ),
  false,
  "a bodyless mutation may omit content type",
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("GET", {
      "content-length": "4",
      "content-type": "application/javascript",
    })
  ),
  false
);

assert.equal(
  hasEncodedPathSeparator("https://greyhoundsiq.com.au/%2Fimages/logo.webp"),
  true
);
assert.equal(
  hasEncodedPathSeparator("https://greyhoundsiq.com.au/%255Cimages/logo.webp"),
  true
);
assert.equal(
  hasEncodedPathSeparator("https://greyhoundsiq.com.au/%25252Fimages/logo.webp"),
  true
);
assert.equal(
  hasEncodedPathSeparator("https://greyhoundsiq.com.au/search?q=%2Fimages"),
  false
);

for (const pathname of [
  "/api/listings/listing_123",
  "/api/forum/categories/general-racing/threads",
  "/api/agents/race-analyst/run",
]) {
  assert.equal(hasInvalidApiPathSegment(pathname), false, pathname);
}
for (const pathname of [
  "/api/listings/bad!identifier",
  `/api/listings/${"x".repeat(161)}`,
  "/api/listings/%2e%2e",
  "/api/listings/has%20space",
  "/api/listings//enquiry",
]) {
  assert.equal(hasInvalidApiPathSegment(pathname), true, pathname);
}
assert.equal(hasInvalidApiPathSegment("/marketplace/bad!identifier"), false);

console.log("request security tests passed");
