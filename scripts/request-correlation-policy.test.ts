import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  auditLogCorrelationPolicy,
  type LogCallsiteRegistryEntry,
} from "./request-correlation-policy";

const fixtureParent = realpathSync(tmpdir());
const fixtureRoot = mkdtempSync(
  join(fixtureParent, "greyhoundiq-correlation-policy-"),
);

const fixtureRegistry: LogCallsiteRegistryEntry[] = [
  entry(
    "src/lib/request.ts",
    "requestPath",
    "request.failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/mixed.ts",
    "mixedPath",
    "mixed.slow",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/boot.ts",
    "register",
    "boot.degraded",
    "logBackgroundWarn",
    "boot",
  ),
  entry(
    "src/lib/correlated.ts",
    "correlatedPath",
    "route.failed",
    "logCorrelatedError",
    "request",
  ),
  entry(
    "src/lib/dynamic-alias.ts",
    "dynamicAliasPath",
    "dynamic.alias_failed",
    "logRequestError",
    "request",
  ),
];

try {
  writeFixture(
    "src/lib/request.ts",
    [
      'import { logRequestError as requestLog } from "@/lib/logger";',
      "export async function requestPath() {",
      '  await requestLog("request.failed", { code: "SAFE" });',
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/mixed.ts",
    [
      'import * as logger from "./logger";',
      "export const mixedPath = async () => {",
      '  await logger.logExecutionWarn("mixed.slow", { durationMs: 25 });',
      "};",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/boot.ts",
    [
      "export async function register() {",
      '  const { logBackgroundWarn: bootLog } = await import("./logger");',
      '  bootLog("boot.degraded", { component: "cache" });',
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/correlated.ts",
    [
      'import { logCorrelatedError } from "@/lib/logger";',
      "export function correlatedPath() {",
      '  const correlation = { requestId: "req-1", traceId: null };',
      '  logCorrelatedError(correlation, "route.failed", { code: "SAFE" });',
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/dynamic-alias.ts",
    [
      "export async function dynamicAliasPath() {",
      '  const loggerModule = await import("./logger");',
      "  const firstAlias = loggerModule.logRequestError;",
      "  const secondAlias = firstAlias;",
      '  await secondAlias("dynamic.alias_failed", { code: "SAFE" });',
      "}",
      "",
    ].join("\n"),
  );

  assert.deepEqual(
    auditLogCorrelationPolicy(fixtureRoot, fixtureRegistry),
    [],
    "registered request, mixed, boot and explicit correlation calls must pass",
  );

  writeFixture(
    "src/lib/dynamic.ts",
    [
      'import { logRequestWarn } from "@/lib/logger";',
      "export async function dynamicEvent(event: string) {",
      '  await logRequestWarn(event, { code: "SAFE" });',
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/forbidden.ts",
    [
      'import { logRequestError } from "@/lib/logger";',
      "export async function forbiddenContext() {",
      '  await logRequestError("request.body", { body: "sensitive" });',
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/scope.ts",
    [
      'import { logRequestError } from "@/lib/logger";',
      "export async function wrongScope() {",
      '  await logRequestError("scope.wrong", { code: "SAFE" });',
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/unclassified.ts",
    [
      'import { logError } from "@/lib/logger";',
      "export function unclassified() {",
      '  logError("raw.unclassified", { code: "SAFE" });',
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/lib/unawaited.ts",
    [
      'import { logRequestError } from "@/lib/logger";',
      "export async function unawaitedRequestLog() {",
      '  logRequestError("request.unawaited", { code: "SAFE" });',
      "}",
      "",
    ].join("\n"),
  );

  const negativeRegistry: LogCallsiteRegistryEntry[] = [
    ...fixtureRegistry.slice(1),
    fixtureRegistry[1],
    { ...fixtureRegistry[0], count: 2 },
    entry(
      "src/lib/dynamic.ts",
      "dynamicEvent",
      "<dynamic>",
      "logRequestWarn",
      "request",
    ),
    entry(
      "src/lib/forbidden.ts",
      "forbiddenContext",
      "request.body",
      "logRequestError",
      "request",
    ),
    entry(
      "src/lib/scope.ts",
      "wrongScope",
      "scope.wrong",
      "logRequestError",
      "background",
    ),
    entry(
      "src/lib/missing.ts",
      "missing",
      "missing.event",
      "logRequestError",
      "request",
    ),
    entry(
      "src/lib/unawaited.ts",
      "unawaitedRequestLog",
      "request.unawaited",
      "logRequestError",
      "request",
    ),
  ];
  const issueKinds = auditLogCorrelationPolicy(fixtureRoot, negativeRegistry)
    .map((issue) => issue.kind)
    .sort();
  assert.deepEqual(issueKinds, [
    "count-mismatch",
    "duplicate-registry-entry",
    "dynamic-event",
    "forbidden-context-field",
    "scope-api-mismatch",
    "stale-registry-entry",
    "unawaited-async-call",
    "unclassified-callsite",
  ]);
} finally {
  const resolvedFixtureRoot = realpathSync(fixtureRoot);
  assert.equal(
    dirname(resolvedFixtureRoot),
    fixtureParent,
    "recursive cleanup target must remain a direct child of the temp directory",
  );
  assert.match(
    basename(resolvedFixtureRoot),
    /^greyhoundiq-correlation-policy-/,
    "recursive cleanup target must retain the fixture prefix",
  );
  rmSync(resolvedFixtureRoot, { recursive: true, force: true });
}

assert.deepEqual(
  auditLogCorrelationPolicy(process.cwd()),
  [],
  "every production logger callsite must retain an explicit execution scope",
);

console.log("request correlation policy tests passed");

function writeFixture(path: string, source: string) {
  const fullPath = join(fixtureRoot, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, source, "utf8");
}

function entry(
  file: string,
  owner: string,
  event: string,
  api: string,
  scope: LogCallsiteRegistryEntry["scope"],
): LogCallsiteRegistryEntry {
  return { file, owner, event, api, scope };
}
