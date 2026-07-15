import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  hasUnsupportedApiBodyContentType,
  isUnsupportedHttpMethod,
  shouldDisableSharedApiCaching,
} from "../src/lib/request-security";
import { resolveWorkosReturnTo } from "../src/lib/workos-redirect";
import { HTTP_CONTROL_MASTER_EVIDENCE } from "./http-control-evidence";

const request = (method: string, headers: Record<string, string> = {}) => ({
  method,
  headers: new Headers(headers),
});

assert.equal(
  hasUnsupportedApiBodyContentType(
    request("POST", {
      "content-length": "2",
      "content-type": "application/json; charset=utf-8",
    }),
  ),
  false,
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("POST", {
      "content-length": "2",
      "content-type": "application/webhook+json",
    }),
  ),
  false,
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("POST", {
      "content-length": "8",
      "content-type": "application/javascript",
    }),
  ),
  true,
);
assert.equal(
  hasUnsupportedApiBodyContentType(
    request("PATCH", { "transfer-encoding": "chunked" }),
  ),
  true,
);

const proxySource = readFileSync("src/proxy.ts", "utf8");
const bootstrapSource = readFileSync("scripts/http-method-boundary.cjs", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");
const packageJson = readFileSync("package.json", "utf8");
assert.match(bootstrapSource, /http\.createServer = function createGuardedServer/);
assert.match(bootstrapSource, /if \(!isSupportedMethod\(req\.method\)\)/);
assert.match(bootstrapSource, /methodNotAllowed\(res\)/);
assert.match(bootstrapSource, /res\.writeHead\(405/);
assert.match(dockerfile, /--require", "\.\/scripts\/http-method-boundary\.cjs"/);
assert.match(packageJson, /"dev": "node --require \.\/scripts\/http-method-boundary\.cjs/);
assert.match(packageJson, /"start": "node --require \.\/scripts\/http-method-boundary\.cjs/);
assert.match(proxySource, /pathname\.startsWith\("\/api\/"\)/);
assert.match(proxySource, /isUnsupportedHttpMethod\(request\)/);
assert.match(
  proxySource,
  /securedErrorResponse\([\s\S]*405,[\s\S]*"request\.method_not_allowed"/,
);
assert.match(
  proxySource,
  /response\.headers\.set\("Allow", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"\)/,
);
assert.equal(isUnsupportedHttpMethod(request("TRACE")), true);
assert.equal(isUnsupportedHttpMethod(request("CONNECT")), true);
assert.equal(isUnsupportedHttpMethod(request("POST")), false);
assert.match(proxySource, /hasUnsupportedApiBodyContentType\(request\)/);
assert.match(proxySource, /415,[\s\S]*"request\.unsupported_media_type"/);
assert.match(proxySource, /response\.headers\.set\("Cache-Control", "no-store"\)/);
assert.match(
  proxySource,
  /shouldDisableSharedApiCaching\(request, request\.nextUrl\.pathname\)/,
);
assert.match(proxySource, /"Cache-Control", "private, no-store"/);
assert.match(proxySource, /appendVary\(response\.headers, "Cookie"\)/);
assert.match(proxySource, /appendVary\(response\.headers, "Authorization"\)/);

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
  shouldDisableSharedApiCaching(request("POST"), "/api/webhooks/stripe"),
  true,
);
assert.equal(
  shouldDisableSharedApiCaching(request("GET"), "/api/health/feeds"),
  false,
);

const mediaBlobRoute = readFileSync("src/app/api/media/[id]/blob/route.ts", "utf8");
const replayHandler = readFileSync("src/app/api/replay/stream/handler.ts", "utf8");
const exportRoute = readFileSync("src/app/api/users/me/export/route.ts", "utf8");
assert.match(mediaBlobRoute, /"Content-Disposition": "inline"/);
assert.match(mediaBlobRoute, /"X-Content-Type-Options": "nosniff"/);
assert.match(mediaBlobRoute, /"Cache-Control": "private, max-age=60"/);
assert.match(replayHandler, /"cache-control": "private, no-store"/);
assert.match(replayHandler, /"x-content-type-options": "nosniff"/);
assert.match(exportRoute, /"content-disposition": `attachment; filename=/);
assert.match(exportRoute, /const PRIVATE_NO_STORE = \{ "cache-control": USER_EXPORT_CACHE_CONTROL \}/);

assert.equal(resolveWorkosReturnTo({ returnTo: "/account?tab=billing" }), "/account?tab=billing");
assert.equal(resolveWorkosReturnTo({ returnTo: "//attacker.example" }), "/feed");
assert.equal(
  resolveWorkosReturnTo({ returnTo: "/%2f%2fattacker.example" }),
  "/feed",
);
assert.equal(resolveWorkosReturnTo({ returnTo: "/callback" }), "/feed");

const realtimeRoute = readFileSync("src/app/api/realtime/token/route.ts", "utf8");
const realtimeClient = readFileSync("src/components/realtime-refresh.tsx", "utf8");
assert.match(realtimeRoute, /export async function POST\(\)/);
assert.doesNotMatch(realtimeRoute, /export async function GET\(\)/);
assert.match(
  realtimeClient,
  /fetch\("\/api\/realtime\/token", \{[\s\S]*method: "POST"/,
);

const prohibitedDatabaseMutators = new Set([
  "create",
  "createMany",
  "delete",
  "deleteMany",
  "executeRaw",
  "executeRawUnsafe",
  "update",
  "updateMany",
  "upsert",
]);
const prohibitedBusinessMutation =
  /^(?:approve|block|cancel|delete|finalize|issue|mark|publish|react|reject|renew|remove|run|save|send|start|supersede|unblock|update|withdraw)/;
const allowedAuxiliaryGetCalls = new Set([
  "createMediaDownloadUrl",
]);

for (const routeFile of collectRouteFiles("src/app/api")) {
  const source = readFileSync(routeFile, "utf8");
  const sourceFile = ts.createSourceFile(
    routeFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (
      !ts.isFunctionDeclaration(statement) ||
      statement.name?.text !== "GET" ||
      !statement.body
    ) {
      continue;
    }

    visit(statement.body, (call) => {
      const expression = call.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        assert.equal(
          prohibitedDatabaseMutators.has(expression.name.text),
          false,
          `${routeFile}: GET calls database mutator ${expression.getText(sourceFile)}`,
        );
        return;
      }
      if (!ts.isIdentifier(expression)) return;
      if (allowedAuxiliaryGetCalls.has(expression.text)) return;
      assert.equal(
        prohibitedBusinessMutation.test(expression.text),
        false,
        `${routeFile}: GET calls business mutator ${expression.text}`,
      );
    });
  }
}

const expectedIds = Object.keys(HTTP_CONTROL_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 9);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    HTTP_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "HTTP controls passed: safe method handling, mutation-safe GET handlers, bounded media types, sensitive cache policy, safe downloads, and redirect validation",
);

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

function visit(node: ts.Node, onCall: (call: ts.CallExpression) => void) {
  if (ts.isCallExpression(node)) onCall(node);
  ts.forEachChild(node, (child) => visit(child, onCall));
}
