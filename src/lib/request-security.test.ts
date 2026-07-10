import assert from "node:assert/strict";
import {
  hasEncodedPathSeparator,
  isCrossOriginBrowserMutation,
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
  isCrossOriginBrowserMutation(request("POST"), expectedOrigin),
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

console.log("request security tests passed");
