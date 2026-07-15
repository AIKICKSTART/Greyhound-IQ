import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { discoverRouteHandlers } from "./endpoints";
import {
  RATE_LIMITS,
  type ApiRateLimitMethod,
  type RateLimitContract,
} from "./rate-limits";

const HTTP_METHODS = new Set<ApiRateLimitMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
const LIMITER_FUNCTIONS = new Set(["checkRateLimit", "checkLocalRateLimit"]);
type LimiterFunctionName = "checkRateLimit" | "checkLocalRateLimit";
const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "src", "app", "api");

type LimiterCall = {
  callSiteId: string;
  limiterKind: RateLimitContract["limiterKind"];
  sourceKeyExpression: string;
  configuredMaximums: readonly number[];
  windowMilliseconds: number;
  failClosed: boolean;
};

type DiscoveredApiOperation = {
  route: string;
  method: ApiRateLimitMethod;
  sourceFile: string;
  handler: string;
  limiterCall?: LimiterCall;
};

const DELEGATED_LIMITER_CALLS: Readonly<Record<string, LimiterCall>> = {
  "POST /api/analytics/onboarding": {
    callSiteId:
      "src/app/api/analytics/onboarding/route.ts#handleOnboardingAnalyticsPost",
    limiterKind: "database-distributed",
    sourceKeyExpression: "ONBOARDING_ANALYTICS_RATE_LIMIT_KEY",
    configuredMaximums: [6_000],
    windowMilliseconds: 60_000,
    failClosed: true,
  },
  "GET /api/replay/stream": {
    callSiteId: "src/app/api/replay/stream/handler.ts#handleReplayStreamGet",
    limiterKind: "process-local",
    sourceKeyExpression: "`replay:stream:${clientKey}`",
    configuredMaximums: [30, 120],
    windowMilliseconds: 60_000,
    failClosed: false,
  },
};
const DELEGATED_LIMITER_CONSUMER_FILES = new Set(
  Object.values(DELEGATED_LIMITER_CALLS).map(
    ({ callSiteId }) => callSiteId.split("#", 1)[0],
  ),
);

assertNoUnmodelledLimiterWrappers(path.join(repoRoot, "src"));
assertLimiterImportBindingFixtures();

const discoveredApiOperations = discoverApiOperations(apiRoot);
const discoveredLimitedOperations = discoveredApiOperations.filter(
  (operation) => operation.limiterCall
);
const allRouteHandlers = discoverRouteHandlers(repoRoot);
const existingApiHandlerKeys = allRouteHandlers
  .filter((entry) => entry.route.startsWith("/api/"))
  .map((entry) => operationKey(entry.method, entry.route))
  .sort();

assert.deepEqual(
  discoveredApiOperations
    .map((operation) => operationKey(operation.method, operation.route))
    .sort(),
  existingApiHandlerKeys,
  "the rate-limit parity scanner must see every existing src/app/api route method"
);

assertUnique(RATE_LIMITS, (entry) => entry.rateLimitId, "rate-limit ID");
assertUnique(RATE_LIMITS, (entry) => entry.operationId, "operation ID");
assertUnique(RATE_LIMITS, (entry) => operationKey(entry.method, entry.route), "operation");

const discoveredByOperation = new Map(
  discoveredLimitedOperations.map((operation) => [
    operationKey(operation.method, operation.route),
    operation,
  ])
);
const registeredByOperation = new Map(
  RATE_LIMITS.map((entry) => [operationKey(entry.method, entry.route), entry])
);

assert.deepEqual(
  [...registeredByOperation.keys()].sort(),
  [...discoveredByOperation.keys()].sort(),
  "every API operation that reaches a runtime limiter must be registered, and every registry entry must reach one"
);

const openApi = JSON.parse(readFileSync(path.join(repoRoot, "openapi.json"), "utf8")) as {
  paths?: Record<string, Record<string, { operationId?: string }>>;
};

for (const entry of RATE_LIMITS) {
  const key = operationKey(entry.method, entry.route);
  const actual = discoveredByOperation.get(key);
  assert.ok(actual?.limiterCall, `${key} must reach a limiter call`);

  assert.equal(entry.scope, "api-operation");
  assert.equal(entry.sourceFile, actual.sourceFile, `${key} source file drifted`);
  assert.equal(entry.sourceSymbol, entry.method, `${key} source symbol must be its method`);
  assert.equal(entry.limiterKind, actual.limiterCall.limiterKind, `${key} limiter kind drifted`);
  assert.equal(
    entry.sourceKeyExpression,
    actual.limiterCall.sourceKeyExpression,
    `${key} limiter key expression drifted`
  );

  const registeredMaximums = (
    entry.configuredMaximums ?? [entry.maximum]
  ).toSorted((left, right) => left - right);
  assert.deepEqual(
    registeredMaximums,
    actual.limiterCall.configuredMaximums,
    `${key} configured maximum drifted`
  );
  assert.equal(
    entry.maximum,
    Math.max(...registeredMaximums),
    `${key} maximum must be the highest configured tier`
  );
  assert.equal(
    entry.windowMilliseconds,
    actual.limiterCall.windowMilliseconds,
    `${key} limiter window drifted`
  );
  assert.equal(
    entry.failMode,
    actual.limiterCall.failClosed ? "closed" : "not verified",
    `${key} fail-mode metadata drifted`
  );

  assert.ok(entry.keyShape.trim(), `${key} must describe its key shape`);
  assert.ok(entry.owner.trim(), `${key} must have an owner`);
  assert.equal(
    entry.verificationStatus,
    "Partially verified",
    `${key} is source-level evidence and must not claim runtime verification`
  );
  assert.ok(
    entry.evidence.some(
      (evidence) =>
        evidence.sourceFile === entry.sourceFile &&
        evidence.sourceSymbol === entry.sourceSymbol &&
        /deployed behavior is not verified/i.test(evidence.note)
    ),
    `${key} must retain explicit source-only evidence scope`
  );

  const openApiPath = toOpenApiPath(entry.route);
  const openApiOperation = openApi.paths?.[openApiPath]?.[entry.method.toLowerCase()];
  assert.ok(openApiOperation, `${key} must exist in openapi.json`);
  assert.equal(
    entry.operationId,
    openApiOperation.operationId,
    `${key} operationId must match openapi.json`
  );
}

const replayRateLimit = registeredByOperation.get("GET /api/replay/stream");
assert.ok(replayRateLimit, "GET /api/replay/stream must remain registered");
assert.equal(
  replayRateLimit.keyShape,
  "replay:stream:<trusted-client-ip-or-missing-forwarded-for>",
);
assert.equal(replayRateLimit.sourceKeyExpression, "`replay:stream:${clientKey}`");
assert.doesNotMatch(
  replayRateLimit.sourceKeyExpression,
  /token|secret|target|params|capability/i,
  "replay limiter keys must never contain bearer capabilities or provider secrets",
);
assert.match(
  replayRateLimit.evidence.map((entry) => entry.note).join(" "),
  /trusted client-IP extractor.*capability tokens and provider secrets are excluded/i,
);
const replayRouteSource = readFileSync(
  path.join(repoRoot, "src", "app", "api", "replay", "stream", "route.ts"),
  "utf8",
);
const replayHandlerSource = readFileSync(
  path.join(repoRoot, "src", "app", "api", "replay", "stream", "handler.ts"),
  "utf8",
);
assert.match(
  replayHandlerSource,
  /const clientKey = clientIp \?\? MISSING_REPLAY_CLIENT_KEY;/,
  "replay clientKey must come only from trusted client-IP extraction or its fixed bucket",
);
assert.doesNotMatch(
  replayHandlerSource,
  /\b(?:console|logger)\s*\./,
  "the replay handler must not log bearer capabilities or provider URLs",
);
assert.match(
  replayRouteSource,
  /return handleReplayStreamGet\(request\);/,
  "the replay route must retain its modelled handler delegation",
);

const sharedLimiterCallSites = groupBy(
  discoveredLimitedOperations,
  (operation) => operation.limiterCall!.callSiteId
);
assert.ok(
  [...sharedLimiterCallSites.values()].some((operations) => operations.length > 1),
  "shared handlers must remain represented once per exported HTTP operation"
);

const distributedCount = RATE_LIMITS.filter(
  (entry) => entry.limiterKind === "database-distributed"
).length;
const localCount = RATE_LIMITS.filter(
  (entry) => entry.limiterKind === "process-local"
).length;

console.log(
  `rate-limit registry parity passed: ${RATE_LIMITS.length}/${discoveredApiOperations.length} API operations limited (${distributedCount} database-distributed, ${localCount} process-local; ${allRouteHandlers.length} total route methods including non-API handlers)`
);

function discoverApiOperations(directory: string): DiscoveredApiOperation[] {
  return walkFiles(directory)
    .filter((file) => path.basename(file) === "route.ts")
    .flatMap(discoverRouteFileOperations)
    .sort((left, right) =>
      operationKey(left.method, left.route).localeCompare(
        operationKey(right.method, right.route)
      )
    );
}

function discoverRouteFileOperations(file: string): DiscoveredApiOperation[] {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const callables = collectTopLevelCallables(sourceFile);
  const methodExports = collectMethodExports(sourceFile);
  const variableInitializers = collectVariableInitializers(sourceFile);
  const route = routeForFile(file);
  const sourcePath = repoPath(file);
  const limiterImports = collectLimiterImports(sourceFile, sourcePath);

  const operations = [...methodExports.entries()].map(([method, handler]) => {
    const limiterCalls = reachableLimiterCalls(
      handler,
      callables,
      sourceFile,
      limiterImports,
      sourcePath
    );
    assert.ok(
      limiterCalls.length <= 1,
      `${method} ${route} reaches multiple limiter calls; model the policy explicitly before proceeding`
    );
    const limiterCall = limiterCalls[0]
      ? describeLimiterCall(
          limiterCalls[0],
          sourceFile,
          sourcePath,
          variableInitializers
        )
      : DELEGATED_LIMITER_CALLS[operationKey(method, route)];
    return { route, method, sourceFile: sourcePath, handler, limiterCall };
  });

  const usedLimiterNames = new Set(
    operations.flatMap((operation) => {
      const functionName = operation.limiterCall?.limiterKind === "process-local"
        ? "checkLocalRateLimit"
        : operation.limiterCall
          ? "checkRateLimit"
          : undefined;
      return functionName ? [functionName] : [];
    })
  );
  for (const importedName of limiterImports.keys()) {
    assert.ok(
      usedLimiterNames.has(importedName),
      `${sourcePath} imports ${importedName} but no exported HTTP operation reaches it`
    );
  }

  return operations;
}

function collectLimiterImports(sourceFile: ts.SourceFile, sourcePath: string) {
  const imports = new Map<string, LimiterFunctionName>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (!isRateLimitModuleSpecifier(statement.moduleSpecifier.text, sourcePath)) {
      continue;
    }

    const importClause = statement.importClause;
    assert.ok(importClause, `${sourcePath} must use an explicit named rate-limit import`);
    assert.equal(
      importClause.name,
      undefined,
      `${sourcePath} must not default-import the rate-limit module`
    );
    assert.ok(
      importClause.namedBindings && ts.isNamedImports(importClause.namedBindings),
      `${sourcePath} must use named rate-limit imports; namespace imports are not modelled`
    );

    for (const element of importClause.namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      if (!isLimiterFunctionName(importedName)) continue;
      assert.equal(
        element.name.text,
        importedName,
        `${sourcePath} must import ${importedName} without aliasing`
      );
      assert.ok(
        !imports.has(importedName),
        `${sourcePath} imports ${importedName} more than once`
      );
      imports.set(importedName, importedName);
    }
  }

  return imports;
}

function collectTopLevelCallables(sourceFile: ts.SourceFile) {
  const callables = new Map<string, ts.Node>();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      callables.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        callables.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  return callables;
}

function collectMethodExports(sourceFile: ts.SourceFile) {
  const exports = new Map<ApiRateLimitMethod, string>();
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      isHttpMethod(statement.name.text) &&
      hasExportModifier(statement)
    ) {
      exports.set(statement.name.text, statement.name.text);
      continue;
    }
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && isHttpMethod(declaration.name.text)) {
          exports.set(declaration.name.text, declaration.name.text);
        }
      }
      continue;
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (!isHttpMethod(element.name.text)) continue;
        exports.set(element.name.text, (element.propertyName ?? element.name).text);
      }
    }
  }
  return exports;
}

function reachableLimiterCalls(
  handler: string,
  callables: ReadonlyMap<string, ts.Node>,
  sourceFile: ts.SourceFile,
  limiterImports: ReadonlyMap<string, LimiterFunctionName>,
  sourcePath: string,
  visited = new Set<string>()
): ts.CallExpression[] {
  if (visited.has(handler)) return [];
  const nextVisited = new Set(visited).add(handler);
  const callable = callables.get(handler);
  if (!callable) return [];
  if (ts.isIdentifier(callable)) {
    return reachableLimiterCalls(
      callable.text,
      callables,
      sourceFile,
      limiterImports,
      sourcePath,
      nextVisited
    );
  }

  const calls = new Map<number, ts.CallExpression>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const called = node.expression.text;
      if (LIMITER_FUNCTIONS.has(called)) {
        assert.equal(
          limiterImports.get(called),
          called,
          `${sourcePath} ${handler} calls ${called} without an exact named import from @/lib/rate-limit; local substitutes, aliases, and external wrappers are not modelled`
        );
        calls.set(node.getStart(sourceFile), node);
      } else if (callables.has(called)) {
        for (const nested of reachableLimiterCalls(
          called,
          callables,
          sourceFile,
          limiterImports,
          sourcePath,
          nextVisited
        )) {
          calls.set(nested.getStart(sourceFile), nested);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(callable);
  return [...calls.values()].sort(
    (left, right) => left.getStart(sourceFile) - right.getStart(sourceFile)
  );
}

function assertNoUnmodelledLimiterWrappers(directory: string) {
  for (const file of walkFiles(directory).filter((entry) => /\.[cm]?[jt]sx?$/.test(entry))) {
    const sourcePath = repoPath(file);
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    for (const statement of sourceFile.statements) {
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        isRateLimitModuleSpecifier(statement.moduleSpecifier.text, sourcePath)
      ) {
        assert.ok(
          isAllowedDirectLimiterConsumer(sourcePath),
          `${sourcePath} imports or re-exports the rate-limit module outside an explicitly modelled direct consumer; external wrappers are forbidden until the registry scanner models their call graph`
        );
      }
    }
  }
}

function isAllowedDirectLimiterConsumer(sourcePath: string) {
  return (
    (sourcePath.startsWith("src/app/api/") && sourcePath.endsWith("/route.ts")) ||
    DELEGATED_LIMITER_CONSUMER_FILES.has(sourcePath) ||
    sourcePath === "src/app/actions.ts" ||
    sourcePath === "src/app/account/team/actions.ts" ||
    sourcePath === "src/app/admin/users/actions.ts" ||
    sourcePath === "src/app/p/[handle]/actions.ts" ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(sourcePath)
  );
}

function isRateLimitModuleSpecifier(moduleSpecifier: string, sourcePath: string) {
  const withoutExtension = moduleSpecifier.replace(/\.[cm]?[jt]sx?$/, "");
  if (withoutExtension === "@/lib/rate-limit") return true;
  if (!withoutExtension.startsWith(".")) return false;

  const absoluteSource = path.join(repoRoot, ...sourcePath.split("/"));
  const resolved = path.resolve(path.dirname(absoluteSource), withoutExtension);
  return resolved === path.join(repoRoot, "src", "lib", "rate-limit");
}

function isLimiterFunctionName(value: string): value is LimiterFunctionName {
  return LIMITER_FUNCTIONS.has(value);
}

function assertLimiterImportBindingFixtures() {
  const exact = fixtureSource(
    'import { checkRateLimit } from "@/lib/rate-limit"; export async function GET() { return checkRateLimit("key", 1, 1000); }'
  );
  assert.equal(
    collectLimiterImports(exact, "src/app/api/fixture/route.ts").get("checkRateLimit"),
    "checkRateLimit"
  );

  assert.throws(
    () => collectLimiterImports(
      fixtureSource('import { checkRateLimit as admit } from "@/lib/rate-limit";'),
      "src/app/api/fixture/route.ts"
    ),
    /without aliasing/
  );
  assert.throws(
    () => collectLimiterImports(
      fixtureSource('import * as limiter from "@/lib/rate-limit";'),
      "src/app/api/fixture/route.ts"
    ),
    /namespace imports are not modelled/
  );

  const localSubstitute = fixtureSource(
    "function checkRateLimit() { return true; } export function GET() { return checkRateLimit(); }"
  );
  assert.throws(
    () => reachableLimiterCalls(
      "GET",
      collectTopLevelCallables(localSubstitute),
      localSubstitute,
      new Map(),
      "src/app/api/fixture/route.ts"
    ),
    /local substitutes, aliases, and external wrappers are not modelled/
  );
}

function fixtureSource(source: string) {
  return ts.createSourceFile(
    "fixture.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

function describeLimiterCall(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  sourcePath: string,
  variableInitializers: ReadonlyMap<string, readonly ts.Expression[]>
): LimiterCall {
  assert.ok(ts.isIdentifier(call.expression));
  const functionName = call.expression.text;
  assert.ok(LIMITER_FUNCTIONS.has(functionName));
  const maximums = resolveNumericValues(call.arguments[1], variableInitializers);
  const windows = resolveNumericValues(call.arguments[2], variableInitializers);
  assert.ok(maximums.length > 0, `${sourcePath} limiter maximum must resolve`);
  assert.equal(windows.length, 1, `${sourcePath} limiter window must resolve once`);
  const options = normalizeSource(call.arguments[3]?.getText(sourceFile) ?? "");

  return {
    callSiteId: `${sourcePath}:${call.getStart(sourceFile)}`,
    limiterKind:
      functionName === "checkLocalRateLimit"
        ? "process-local"
        : "database-distributed",
    sourceKeyExpression: normalizeSource(call.arguments[0]?.getText(sourceFile) ?? ""),
    configuredMaximums: maximums,
    windowMilliseconds: windows[0],
    failClosed: /\bfailClosed\s*:\s*true\b/.test(options),
  };
}

function collectVariableInitializers(sourceFile: ts.SourceFile) {
  const initializers = new Map<string, ts.Expression[]>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const values = initializers.get(node.name.text) ?? [];
      values.push(node.initializer);
      initializers.set(node.name.text, values);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return initializers;
}

function resolveNumericValues(
  expression: ts.Expression | undefined,
  initializers: ReadonlyMap<string, readonly ts.Expression[]>,
  visited = new Set<string>()
): number[] {
  if (!expression) return [];
  if (ts.isParenthesizedExpression(expression)) {
    return resolveNumericValues(expression.expression, initializers, visited);
  }
  if (
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return resolveNumericValues(expression.expression, initializers, visited);
  }
  if (ts.isNumericLiteral(expression)) {
    return [Number(expression.text.replaceAll("_", ""))];
  }
  if (ts.isPrefixUnaryExpression(expression)) {
    const values = resolveNumericValues(expression.operand, initializers, visited);
    return expression.operator === ts.SyntaxKind.MinusToken
      ? values.map((value) => -value)
      : values;
  }
  if (ts.isIdentifier(expression)) {
    if (visited.has(expression.text)) return [];
    const nextVisited = new Set(visited).add(expression.text);
    return uniqueNumbers(
      (initializers.get(expression.text) ?? []).flatMap((initializer) =>
        resolveNumericValues(initializer, initializers, nextVisited)
      )
    );
  }
  if (ts.isConditionalExpression(expression)) {
    return uniqueNumbers([
      ...resolveNumericValues(expression.whenTrue, initializers, visited),
      ...resolveNumericValues(expression.whenFalse, initializers, visited),
    ]);
  }
  if (ts.isBinaryExpression(expression)) {
    const left = resolveNumericValues(expression.left, initializers, visited);
    const right = resolveNumericValues(expression.right, initializers, visited);
    const values: number[] = [];
    for (const leftValue of left) {
      for (const rightValue of right) {
        switch (expression.operatorToken.kind) {
          case ts.SyntaxKind.PlusToken:
            values.push(leftValue + rightValue);
            break;
          case ts.SyntaxKind.MinusToken:
            values.push(leftValue - rightValue);
            break;
          case ts.SyntaxKind.AsteriskToken:
            values.push(leftValue * rightValue);
            break;
          case ts.SyntaxKind.SlashToken:
            values.push(leftValue / rightValue);
            break;
        }
      }
    }
    return uniqueNumbers(values);
  }
  return [];
}

function uniqueNumbers(values: readonly number[]) {
  return [...new Set(values)].toSorted((left, right) => left - right);
}

function hasExportModifier(node: ts.Node) {
  return (
    ts.canHaveModifiers(node) &&
    Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
  );
}

function isHttpMethod(value: string): value is ApiRateLimitMethod {
  return HTTP_METHODS.has(value as ApiRateLimitMethod);
}

function operationKey(method: string, route: string) {
  return `${method} ${route}`;
}

function routeForFile(file: string) {
  return `/${path
    .relative(path.join(repoRoot, "src", "app"), path.dirname(file))
    .split(path.sep)
    .join("/")}`;
}

function toOpenApiPath(route: string) {
  return route
    .replace(/\[\[?\.\.\.([^\]]+)\]\]?/g, "{$1}")
    .replace(/\[([^\]]+)\]/g, "{$1}");
}

function normalizeSource(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function assertUnique<T>(
  entries: readonly T[],
  keyFor: (entry: T) => string,
  label: string
) {
  const keys = entries.map(keyFor);
  assert.equal(new Set(keys).size, keys.length, `${label}s must be unique`);
}

function groupBy<T>(entries: readonly T[], keyFor: (entry: T) => string) {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = keyFor(entry);
    const values = groups.get(key) ?? [];
    values.push(entry);
    groups.set(key, values);
  }
  return groups;
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function repoPath(file: string) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}
