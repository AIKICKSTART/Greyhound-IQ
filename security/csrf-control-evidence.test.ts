import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { isCrossOriginBrowserMutation } from "../src/lib/request-security";
import {
  APPLICATION_SURFACE_INVENTORY,
  APPLICATION_SURFACE_SUMMARY,
} from "./application-surface-inventory";
import { CSRF_CONTROL_MASTER_EVIDENCE } from "./csrf-control-evidence";

const expectedOrigin = "https://greyhoundsiq.com.au";
const request = (method: string, headers: Record<string, string> = {}) => ({
  method,
  headers: new Headers(headers),
});

// Browser cookie mutations fail closed when both Origin and a same-origin
// Fetch Metadata signal are missing. Bearer-authenticated native/server clients
// remain compatible because they do not carry the browser session cookie.
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { cookie: "session=opaque" }),
    expectedOrigin,
  ),
  true,
);
assert.equal(isCrossOriginBrowserMutation(request("POST"), expectedOrigin), false);
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", {
      cookie: "session=opaque",
      "sec-fetch-site": "same-origin",
    }),
    expectedOrigin,
  ),
  false,
);

const rejectedBrowserHeaders: ReadonlyArray<Record<string, string>> = [
  { origin: "https://attacker.example", cookie: "session=opaque" },
  { origin: "null", cookie: "session=opaque" },
  { origin: "not a URL", cookie: "session=opaque" },
  { "sec-fetch-site": "cross-site", cookie: "session=opaque" },
  { "sec-fetch-site": "same-site", cookie: "session=opaque" },
];
for (const headers of rejectedBrowserHeaders) {
  assert.equal(
    isCrossOriginBrowserMutation(request("POST", headers), expectedOrigin),
    true,
  );
}
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { origin: expectedOrigin, cookie: "session=opaque" }),
    expectedOrigin,
  ),
  false,
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("GET", { origin: "https://attacker.example", cookie: "session=opaque" }),
    expectedOrigin,
  ),
  false,
);

const proxySource = readFileSync("src/proxy.ts", "utf8");
const csrfCall = proxySource.indexOf("isCrossOriginBrowserMutation(");
const authProxyCall = proxySource.indexOf("authkitProxy({");
assert.ok(csrfCall >= 0 && authProxyCall > csrfCall);
assert.match(proxySource, /securedErrorResponse\(403, "auth\.forbidden"/);
assert.match(
  proxySource,
  /matcher:\s*\[\s*"\/\(\(\?!_next\/static\|_next\/image/,
);

const serverAction = APPLICATION_SURFACE_INVENTORY.find(
  (record) => record.key === "server-action",
);
const uploads = APPLICATION_SURFACE_INVENTORY.find(
  (record) => record.key === "upload",
);
const rpc = APPLICATION_SURFACE_INVENTORY.find((record) => record.key === "rpc");
assert.ok(serverAction?.status === "verified");
assert.equal(serverAction.members.length, APPLICATION_SURFACE_SUMMARY.serverActions);
assert.ok(serverAction.members.length > 0);
assert.ok(uploads?.status === "verified" && uploads.members.length > 0);
assert.ok(rpc?.status === "verified");
assert.match(rpc.boundary, /outbound Supabase RPC callsite/i);
assert.ok(rpc.members.every((member) => member.startsWith("RPC src/lib/")));

const httpEvidence = SECURITY_MASTER_EVIDENCE["security.http-control.no-get-mutation"];
assert.equal(httpEvidence?.status, "verified");
assert.ok(httpEvidence.evidence.includes("security/http-control-evidence.test.ts"));

const expectedIds = Object.keys(CSRF_CONTROL_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 12);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    CSRF_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "CSRF controls passed: 10 verified Origin/Fetch-Metadata controls and 2 justified non-applicable token/RPC cases",
);
