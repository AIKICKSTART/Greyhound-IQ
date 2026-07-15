import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { isCrossOriginBrowserMutation } from "../src/lib/request-security";
import { resolveWorkosReturnTo } from "../src/lib/workos-redirect";
import {
  ENDPOINT_AUTHENTICATION_NEGATIVE_BOUNDARY,
  ENDPOINT_AUTHENTICATION_NEGATIVE_EVIDENCE,
  ENDPOINT_AUTHENTICATION_NEGATIVE_MASTER_EVIDENCE,
  ENDPOINT_AUTHENTICATION_NEGATIVE_REQUIREMENT_IDS,
} from "./endpoint-authentication-negative-evidence";

const expectedOrigin = "https://greyhoundsiq.com.au";
const request = (headers: Record<string, string>) => ({
  method: "POST",
  headers: new Headers(headers),
});

assert.equal(
  resolveWorkosReturnTo({ returnTo: "https://attacker.example/account" }),
  "/feed",
);
assert.equal(resolveWorkosReturnTo({ returnTo: "//attacker.example" }), "/feed");
assert.equal(
  resolveWorkosReturnTo({ returnTo: "/callback?code=attacker" }),
  "/feed",
);
assert.equal(
  resolveWorkosReturnTo({ returnTo: "/account/profile?tab=media" }),
  "/account/profile?tab=media",
);

assert.equal(
  isCrossOriginBrowserMutation(
    request({ cookie: "session=opaque" }),
    expectedOrigin,
  ),
  true,
);
assert.equal(
  isCrossOriginBrowserMutation(
    request({ cookie: "session=opaque", origin: "https://attacker.example" }),
    expectedOrigin,
  ),
  true,
);
assert.equal(
  isCrossOriginBrowserMutation(
    request({ cookie: "session=opaque", origin: expectedOrigin }),
    expectedOrigin,
  ),
  false,
);

const signInRoute = read("src/app/sign-in/route.ts");
assert.match(
  signInRoute,
  /resolveWorkosReturnTo\(\{[\s\S]*returnTo: request\.nextUrl\.searchParams\.get\("returnTo"\)/,
);

const proxy = read("src/proxy.ts");
const csrfCheck = proxy.indexOf("isCrossOriginBrowserMutation(");
const authBoundary = proxy.indexOf("authkitProxy({");
assert.ok(csrfCheck >= 0 && authBoundary > csrfCheck);
assert.match(proxy, /securedErrorResponse\(403, "auth\.forbidden"/);
assert.match(proxy, /matcher:\s*\[\s*"\/\(\(\?!_next\/static\|_next\/image/);

assert.deepEqual(Object.keys(ENDPOINT_AUTHENTICATION_NEGATIVE_MASTER_EVIDENCE), [
  ...ENDPOINT_AUTHENTICATION_NEGATIVE_REQUIREMENT_IDS,
]);
assert.match(ENDPOINT_AUTHENTICATION_NEGATIVE_BOUNDARY, /local evidence only/i);
assert.match(ENDPOINT_AUTHENTICATION_NEGATIVE_BOUNDARY, /does not claim deployed/i);

for (const requirementId of ENDPOINT_AUTHENTICATION_NEGATIVE_REQUIREMENT_IDS) {
  assert.ok(
    SECURITY_MASTER_REQUIREMENTS.some(({ id }) => id === requirementId),
    `${requirementId}: missing immutable requirement`,
  );
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    ENDPOINT_AUTHENTICATION_NEGATIVE_MASTER_EVIDENCE[requirementId],
  );
}

for (const evidencePath of ENDPOINT_AUTHENTICATION_NEGATIVE_EVIDENCE) {
  assert.ok(existsSync(evidencePath), `missing evidence ${evidencePath}`);
}

console.log(
  "Endpoint authentication negative evidence passed: 3 local controls verified",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}
