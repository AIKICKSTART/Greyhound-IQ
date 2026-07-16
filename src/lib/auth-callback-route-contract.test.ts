import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const callbackRoute = readFileSync("src/app/callback/route.ts", "utf8");
const recoveryPage = readFileSync("src/app/auth/error/page.tsx", "utf8");

assert.match(callbackRoute, /onError:/);
assert.match(callbackRoute, /classifyAuthCallbackFailure/);
assert.match(callbackRoute, /new URL\("\/auth\/error", baseUrl\)/);
assert.match(callbackRoute, /resolveWorkosBaseUrl\(request\.url\)/);
assert.match(callbackRoute, /crypto\.randomUUID\(\)/);
assert.match(callbackRoute, /recoveryUrl\.searchParams\.set\("ref", referenceId\)/);
assert.doesNotMatch(callbackRoute, /logError\("auth\.callback_failed", \{ reason, referenceId \}, error\)/);
assert.match(
  callbackRoute,
  /await logRequestError\("auth\.callback_sync_failed", \{\s*errorCode: "auth\.local_acceptance_failed",\s*errorClass: "local_acceptance",\s*\}\)/
);
assert.doesNotMatch(
  callbackRoute,
  /logRequestError\("auth\.callback_sync_failed",[\s\S]{0,240}\},\s*(?:err|error)\s*\)/
);
assert.doesNotMatch(
  callbackRoute,
  /catch\s*\(\s*(?:err|error)\s*\)\s*\{[\s\S]{0,240}auth\.callback_sync_failed/
);
assert.match(recoveryPage, /AUTH\.CALLBACK\.RECOVER/);
assert.match(recoveryPage, /robots: \{ index: false, follow: false \}/);
assert.match(recoveryPage, /Try sign-in again/);
assert.doesNotMatch(recoveryPage, /error_description|stack|error\.message/);

console.log("authentication callback recovery route contract tests passed");
