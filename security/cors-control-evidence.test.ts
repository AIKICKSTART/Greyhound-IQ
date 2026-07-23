import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  isBrowserCorsPreflight,
  isCrossOriginBrowserMutation,
} from "../src/lib/request-security";
import { CORS_CONTROL_MASTER_EVIDENCE } from "./cors-control-evidence";

const productionOrigin = "https://greyhoundsiq.com.au";
const request = (method: string, headers: Record<string, string> = {}) => ({
  method,
  headers: new Headers(headers),
});

assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { origin: "https://attacker.example" }),
    productionOrigin,
  ),
  true,
);
assert.equal(
  isCrossOriginBrowserMutation(
    request("POST", { origin: productionOrigin }),
    productionOrigin,
  ),
  false,
);
assert.equal(
  isBrowserCorsPreflight(
    request("OPTIONS", {
      origin: "https://attacker.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization",
    }),
  ),
  true,
);
assert.equal(isBrowserCorsPreflight(request("OPTIONS")), false);

const proxySource = readFileSync("src/proxy.ts", "utf8");
assert.match(proxySource, /pathname\.startsWith\("\/api\/"\)/);
assert.match(proxySource, /isBrowserCorsPreflight\(request\)/);
assert.match(proxySource, /securedErrorResponse\(403, "cors\.not_allowed"/);
assert.match(proxySource, /authkitProxy\(/);
assert.match(
  proxySource,
  /pathname\.startsWith\("\/api\/"\)[\s\S]*isCrossOriginBrowserMutation\([\s\S]*resolveWorkosBaseUrl\(request\.url\)/,
);
assert.match(proxySource, /matcher:[\s\S]*\/\(\(\?!_next\/static/);
assert.match(proxySource, /response\.headers\.set\("Cache-Control", "no-store"\)/);

const productionFiles = collectTypeScriptFiles("src").filter(
  (file) => !/\.test\.(?:ts|tsx)$/.test(file),
);
const sourceText = productionFiles
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
assert.doesNotMatch(
  sourceText,
  /access-control-allow-(?:credentials|methods|headers)/i,
  "same-origin browser APIs must not opt into credentialed CORS, methods, or headers",
);
assert.doesNotMatch(
  sourceText,
  /access-control-allow-origin[\s\S]{0,80}["']\*["']/i,
  "CORS responses must never use a wildcard origin",
);

const originHeaderFiles = productionFiles.filter((file) =>
  /access-control-allow-origin/i.test(readFileSync(file, "utf8")),
);
assert.deepEqual(originHeaderFiles.sort(), [
  join("src", "lib", "auth-redirect-contract.ts"),
  join("src", "lib", "rate-limit-response.ts"),
]);
assert.match(
  readFileSync("src/lib/auth-redirect-contract.ts", "utf8"),
  /new URL\(allowedBaseUrl\)\.origin/,
);
assert.match(
  readFileSync("src/lib/rate-limit-response.ts", "utf8"),
  /"Access-Control-Allow-Origin": "https:\/\/greyhoundsiq\.com\.au"/,
);
assert.match(
  readFileSync("src/lib/workos-redirect.test.ts", "utf8"),
  /WORKOS_REDIRECT_URI: "https:\/\/localhost:8080\/callback"[\s\S]*resolveWorkosBaseUrl\(\), "https:\/\/staging\.greyhoundsiq\.com\.au"/,
);

const expectedIds = Object.keys(CORS_CONTROL_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 8);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    CORS_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

const realtimeTokenRoute = readFileSync(
  "src/app/api/realtime/token/route.ts",
  "utf8",
);
assert.match(realtimeTokenRoute, /export async function POST/);
assert.match(realtimeTokenRoute, /requireCurrentUserProfile\(\)/);
assert.match(realtimeTokenRoute, /issueRealtimeAuthorization\(current\)/);
assert.match(realtimeTokenRoute, /Cache-Control": "private, no-store"/);

const realtimeService = readFileSync("src/lib/realtime-service.ts", "utf8");
assert.match(realtimeService, /REALTIME_AUTH_TTL_SECONDS = 5 \* 60/);
assert.match(realtimeService, /config: \{ private: isPrivateRealtimeChannel/);
assert.match(realtimeService, /giq_replace_realtime_topic_grants/);
assert.match(realtimeService, /canProfileAccessConversationRealtime/);

const callTokenRoute = readFileSync(
  join("src", "app", "api", "calls", "[roomId]", "token", "route.ts"),
  "utf8",
);
assert.match(callTokenRoute, /export async function POST/);
assert.match(callTokenRoute, /requireCurrentUserProfile\(\)/);
assert.match(callTokenRoute, /createCallTokenForCurrentUser/);
const callService = readFileSync("src/lib/call-service.ts", "utf8");
assert.match(callService, /callRoomJoinWhere\(roomId, current\.profileId\)/);
assert.match(callService, /assertProfilesCanInteract/);
const callToken = readFileSync("src/lib/call-token.ts", "utf8");
assert.match(callToken, /LIVEKIT_TOKEN_TTL_SECONDS = 10 \* 60/);
assert.match(callToken, /roomJoin: true/);
assert.match(callToken, /canPublishData: false/);

const csp = readFileSync("src/lib/csp.ts", "utf8");
assert.match(
  csp,
  /OBJECT_STORAGE_PROVIDER[\s\S]*?=== "gcs"[\s\S]*?"https:\/\/storage\.googleapis\.com"/,
);
// mapHosts: fixed keyless origins for the Vet Finder map (OpenFreeMap, Esri,
// OSM, Mapterhorn) — reviewed, no wildcards.
assert.match(
  csp,
  /join\("connect-src 'self'", supa, supaWs, gcs, lk, devWs, mapHosts\)/,
);
assert.doesNotMatch(csp, /connect-src[^\n]*\*/);

const routeSources = collectTypeScriptFiles(join("src", "app", "api"))
  .filter((file) => !/\.test\.ts$/.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
assert.doesNotMatch(
  routeSources,
  /\b(?:WebSocketServer|upgradeWebSocket|new WebSocket)\b/,
  "GreyhoundIQ must not silently introduce an app-hosted WebSocket handshake outside the reviewed provider boundary",
);
assert.match(
  readFileSync("docs/security/websocket-origin-boundary.md", "utf8"),
  /Origin is an abuse signal, not an authorization boundary/,
);

console.log(
  "CORS controls passed: seven same-origin API controls plus the separately reviewed provider WebSocket origin boundary are verified",
);

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}
