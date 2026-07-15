import assert from "node:assert/strict";

import {
  applyAuthRedirectContract,
  MAX_AUTH_REDIRECT_LOCATION_LENGTH,
} from "./auth-redirect-contract";

const response = new Response(null, {
  status: 307,
  headers: { location: "https://id.example.test/authorize" },
});
assert.equal(
  applyAuthRedirectContract(response, "https://greyhoundsiq.com.au"),
  true
);
assert.equal(
  response.headers.get("access-control-allow-origin"),
  "https://greyhoundsiq.com.au"
);

const oversized = new Response(null, {
  status: 307,
  headers: {
    location: `https://id.example.test/?q=${"x".repeat(
      MAX_AUTH_REDIRECT_LOCATION_LENGTH
    )}`,
  },
});
assert.equal(
  applyAuthRedirectContract(oversized, "https://greyhoundsiq.com.au"),
  false
);

const nonRedirect = new Response(null, { status: 200 });
assert.equal(
  applyAuthRedirectContract(nonRedirect, "https://greyhoundsiq.com.au"),
  true
);
assert.equal(nonRedirect.headers.has("access-control-allow-origin"), false);

console.log("auth redirect contract tests passed");
