import assert from "node:assert/strict";
import {
  sanitizeWorkosClientId,
  workosCookiePolicyError,
} from "./workos-env";

assert.equal(
  sanitizeWorkosClientId(`\uFEFFclient_123 \n`),
  "client_123"
);

const production = {
  NODE_ENV: "production",
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://greyhoundsiq.com.au/callback",
};
assert.equal(workosCookiePolicyError(production), null);
assert.equal(
  workosCookiePolicyError({
    ...production,
    WORKOS_COOKIE_SAMESITE: "none",
  }),
  "WORKOS_COOKIE_SAMESITE must be lax or strict in production"
);
assert.equal(
  workosCookiePolicyError({
    ...production,
    WORKOS_COOKIE_DOMAIN: ".greyhoundsiq.com.au",
  }),
  "WORKOS_COOKIE_DOMAIN must be empty so production sessions remain host-only"
);
assert.equal(
  workosCookiePolicyError({
    ...production,
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://greyhoundsiq.com.au/callback",
  }),
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI must use HTTPS outside loopback"
);
assert.equal(
  workosCookiePolicyError({
    ...production,
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://127.0.0.1:3000/callback",
  }),
  null
);

console.log("workos env tests passed");
