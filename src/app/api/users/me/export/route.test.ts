import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ENDPOINTS } from "../../../../../../security/endpoints";
import { RATE_LIMITS } from "../../../../../../security/rate-limits";
import { SECURITY_TRACES } from "../../../../../../security/traces";

const routeSource = readFileSync(
  "src/app/api/users/me/export/route.ts",
  "utf8",
);
const formSource = readFileSync(
  "src/components/user-data-export-form.tsx",
  "utf8",
);

assert.match(routeSource, /export async function POST\(request: Request\)/);
assert.doesNotMatch(
  routeSource,
  /export async function GET\(/,
  "user export must not create audit and artifact rows through GET",
);
assert.match(
  routeSource,
  /await recordUserExportCompletion\(current, \{/,
  "the POST route must delegate the paired writes to the atomic completion boundary",
);
assert.match(
  routeSource,
  /await readUserExportData\(current\)/,
  "the POST route must delegate bounded database reads to the export service",
);
assert.doesNotMatch(
  routeSource,
  /await createAuditLog\(|tx\.exportArtifact\.create\(|withDbRequestContext\(/,
  "the route must not own database reads or split export completion writes",
);
assert.match(
  formSource,
  /<form onSubmit=\{downloadExport\}/,
);
assert.match(formSource, /fetch\("\/api\/users\/me\/export", \{/);
assert.match(formSource, /method: "POST"/);
assert.match(formSource, /<button\s+type="submit"/);
assert.match(formSource, /if \(!response\.ok\)/);

assert.ok(ENDPOINTS.some((entry) => entry.endpointId === "HTTP.POST.API_USERS_ME_EXPORT"));
assert.ok(!ENDPOINTS.some((entry) => entry.endpointId === "HTTP.GET.API_USERS_ME_EXPORT"));

const rateLimit = RATE_LIMITS.find(
  (entry) => entry.route === "/api/users/me/export",
);
assert.equal(rateLimit?.method, "POST");
assert.equal(rateLimit?.operationId, "postUsersMeExport");

const trace = SECURITY_TRACES.find(
  (entry) => entry.traceId === "ACCOUNT.DATA_EXPORT.DOWNLOAD",
);
assert.equal(trace?.transport.method, "POST");
assert.deepEqual(trace?.server.handlers, [
  "POST",
  "privateJson",
  "readUserExportData",
  "recordUserExportCompletion",
]);
assert.ok(
  trace?.frontend.sourceFiles.includes(
    "src/components/user-data-export-form.tsx",
  ),
);

console.log("user export route method contract tests passed");
