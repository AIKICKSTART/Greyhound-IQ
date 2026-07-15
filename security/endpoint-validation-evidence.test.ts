import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

import {
  adminOptionalDateSchema,
  adminRequiredDateSchema,
} from "../src/app/admin/admin-input-contract";

import {
  MEDIA_MIME_LIMITS,
  WEBVTT_MAX_BYTES,
  mediaFinalizeSchema,
  mediaSignUploadSchema,
  validateWebVttCaption,
} from "../src/lib/media-validation";
import {
  hasInvalidApiPathSegment,
  isUnsupportedHttpMethod,
} from "../src/lib/request-security";
import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import { discoverRouteHandlers } from "./endpoints";
import {
  ENDPOINT_VALIDATION_HOSTILE_REQUIREMENT_IDS,
  ENDPOINT_VALIDATION_JSON_ROUTES,
  ENDPOINT_VALIDATION_MASTER_EVIDENCE,
} from "./endpoint-validation-evidence";

const verifiedRequirementIds = [
  ...ENDPOINT_VALIDATION_HOSTILE_REQUIREMENT_IDS,
  "security.endpoint-test-validation.invalid-file",
  "security.endpoint-test-validation.unexpected-content-type",
  "security.endpoint-test-validation.oversized-request",
  "security.endpoint-test-validation.invalid-identifier",
  "security.endpoint-test-validation.unsupported-method",
  "security.endpoint-test-validation.invalid-date",
] as const;
assert.deepEqual(
  Object.keys(ENDPOINT_VALIDATION_MASTER_EVIDENCE).toSorted(),
  [...verifiedRequirementIds].toSorted(),
);
for (const id of verifiedRequirementIds) {
  assert.ok(
    MASTER_AUDIT_REQUIREMENTS.some((requirement) => requirement.id === id),
  );
}

for (const input of [
  {},
  { filename: null, mimeType: "image/jpeg", sizeBytes: 1 },
  { filename: "", mimeType: "image/jpeg", sizeBytes: 1 },
  { filename: "x".repeat(161), mimeType: "image/jpeg", sizeBytes: 1 },
  { filename: "race.exe", mimeType: "application/x-msdownload", sizeBytes: 1 },
  { filename: "race.jpg", mimeType: "image/jpeg", sizeBytes: 0 },
  {
    filename: "race.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1,
    storagePath: "attacker/selected/path",
  },
]) {
  assert.equal(mediaSignUploadSchema.safeParse(input).success, false);
}
assert.equal(MEDIA_MIME_LIMITS["image/jpeg"], 10 * 1024 * 1024);

for (const input of [
  { sha256: "not-a-hash" },
  { widthPx: 20_001 },
  { heightPx: 20_001 },
  { durationSec: 3_601 },
  { altText: "x".repeat(501) },
  { scanStatus: "clean" },
]) {
  assert.equal(mediaFinalizeSchema.safeParse(input).success, false);
}

const encoder = new TextEncoder();
assert.throws(() => validateWebVttCaption(encoder.encode("not webvtt")));
assert.throws(() => validateWebVttCaption(Uint8Array.of(0xff, 0xfe, 0xfd)));
assert.throws(() =>
  validateWebVttCaption(new Uint8Array(WEBVTT_MAX_BYTES + 1)),
);

const routeContracts = new Map([
  [
    "POST /api/media/sign-upload",
    [
      "src/app/api/media/sign-upload/route.ts",
      "mediaSignUploadSchema.parse(await readBoundedJsonRequest(request))",
    ],
  ],
  [
    "POST /api/media/[id]/finalize",
    [
      "src/app/api/media/[id]/finalize/route.ts",
      "mediaFinalizeSchema.parse(await readBoundedJsonRequest(request))",
    ],
  ],
  [
    "PUT /api/media/[id]/caption",
    ["src/app/api/media/[id]/caption/route.ts", "readWebVttUpload(request)"],
  ],
] as const);
for (const [endpoint, [file, marker]] of routeContracts) {
  assert.ok(
    readFileSync(file, "utf8").includes(marker),
    `${endpoint}: ${marker}`,
  );
}

const mediaService = readFileSync("src/lib/media-service.ts", "utf8");
for (const marker of [
  "assertMediaSize(",
  "assertStoredBytesMatchMimeType(",
  "sniffMatchesMimeType(",
]) {
  assert.ok(mediaService.includes(marker), `media service: ${marker}`);
}

const routeHandlers = discoverRouteHandlers();
const dynamicApiRoutes = [
  ...new Set(
    routeHandlers
      .map(({ route }) => route)
      .filter((route) => route.includes("[")),
  ),
];
assert.ok(dynamicApiRoutes.length >= 39);
for (const route of dynamicApiRoutes) {
  const validPath = route.replace(/\[[^\]]+\]/g, "valid_identifier-1");
  const invalidPath = route.replace(/\[[^\]]+\]/g, "bad!identifier");
  assert.equal(hasInvalidApiPathSegment(validPath), false, validPath);
  assert.equal(hasInvalidApiPathSegment(invalidPath), true, invalidPath);
}
for (const method of ["TRACE", "CONNECT", "PROPFIND", "INVALID"]) {
  assert.equal(
    isUnsupportedHttpMethod({ method, headers: new Headers() }),
    true,
    method,
  );
}
for (const invalidDate of [
  "not-a-date",
  "2026-02-30T12:30",
  "2026-13-01T12:30",
  "2026-07-15T24:00",
]) {
  assert.equal(adminRequiredDateSchema.safeParse(invalidDate).success, false);
}
assert.equal(adminOptionalDateSchema.safeParse(null).success, true);
const adminMutationSource = readFileSync("src/app/admin/mutations.ts", "utf8");
for (const marker of [
  "scheduledFor: adminRequiredDateSchema",
  "expiresAt: adminRequiredDateSchema",
  "expiresAt: adminOptionalDateSchema",
]) {
  assert.ok(adminMutationSource.includes(marker), marker);
}
const proxySource = readFileSync("src/proxy.ts", "utf8");
assert.match(proxySource, /hasInvalidApiPathSegment\(request\.nextUrl\.pathname\)/);
assert.match(proxySource, /400, "request\.invalid_identifier"/);
assert.match(proxySource, /isUnsupportedHttpMethod\(request\)/);
assert.match(proxySource, /405,[\s\S]*"request\.method_not_allowed"/);
const optionalJsonRoutes = new Set([
  "POST /api/actors/[actorId]/mute",
  "POST /api/feed/[postId]/reaction",
  "POST /api/feed/[postId]/save",
  "POST /api/feed/comments/[commentId]/reaction",
  "POST /api/feed/topics/[topicId]/follow",
]);
for (const routeHandler of routeHandlers) {
  const source = readFileSync(routeHandler.sourceFile, "utf8");
  const handler = namedFunctionBody(
    source,
    routeHandler.sourceFile,
    routeHandler.handler,
  );
  assert.doesNotMatch(
    handler,
    /request\.(?:json|text|formData|arrayBuffer|blob)\s*\(/,
    `${routeHandler.method} ${routeHandler.route}: direct unbounded body reader`,
  );
}

assert.equal(ENDPOINT_VALIDATION_JSON_ROUTES.length, 33);
for (const endpoint of ENDPOINT_VALIDATION_JSON_ROUTES) {
  const routeHandler = routeHandlers.find(
    ({ method, route }) => `${method} ${route}` === endpoint,
  );
  assert.ok(routeHandler, `${endpoint}: route missing`);
  const handler = namedFunctionBody(
    readFileSync(routeHandler.sourceFile, "utf8"),
    routeHandler.sourceFile,
    routeHandler.handler,
  );
  const helper =
    endpoint === "POST /api/billing/checkout"
      ? "readBoundedJsonOrFormRequest(request)"
      : optionalJsonRoutes.has(endpoint)
        ? "readBoundedOptionalJsonRequest(request)"
        : "readBoundedJsonRequest(request)";
  assert.ok(handler.includes(helper), `${endpoint}: ${helper} missing`);
}

const jsonRequestSource = readFileSync("src/lib/json-request.ts", "utf8");
for (const marker of [
  "request.unsupported_media_type",
  "request.unsupported_content_encoding",
  "request.body_too_large",
  "reader.cancel()",
  'TextDecoder("utf-8", { fatal: true })',
]) {
  assert.ok(
    jsonRequestSource.includes(marker),
    `JSON request policy: ${marker}`,
  );
}

const webhookBodySource = readFileSync(
  "src/lib/webhook-request-body.ts",
  "utf8",
);
for (const marker of [
  "WEBHOOK_BODY_MAX_BYTES",
  "content-length",
  "reader.cancel()",
]) {
  assert.ok(
    webhookBodySource.includes(marker),
    `webhook body policy: ${marker}`,
  );
}

const onboardingSource = readFileSync(
  "src/app/api/analytics/onboarding/handler.ts",
  "utf8",
);
for (const marker of [
  "isJsonContentType",
  "ONBOARDING_ANALYTICS_MAX_BODY_BYTES",
  "readBoundedBody(request",
]) {
  assert.ok(
    onboardingSource.includes(marker),
    `onboarding body policy: ${marker}`,
  );
}

const nextConfig = readFileSync("next.config.ts", "utf8");
assert.match(
  nextConfig,
  /serverActions:\s*\{[\s\S]*bodySizeLimit:\s*["']1mb["']/,
);

console.log(
  "Endpoint validation evidence passed: 16 exact hostile-input, date, identifier, method, invalid-file, content-type, and request-size gates cover all API routes plus 33 JSON/form routes and specialized uploads/webhooks",
);

function namedFunctionBody(source: string, file: string, name: string) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const matches: ts.FunctionLikeDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(matches.length <= 1, `${file}#${name}: duplicate functions`);
  return matches[0]?.getText(sourceFile) ?? source;
}
