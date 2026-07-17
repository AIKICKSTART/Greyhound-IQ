import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const API_ROOT = fileURLToPath(new URL("../app/api", import.meta.url));
const EXPECTED_LIMITED_ROUTE_FILES = 57;
const EXPECTED_LIMITER_CALLS = 59;
const EXPECTED_LIMITED_OPERATIONS = 62;

// A future exception must name the exact route and explain why the shared
// contract cannot represent it. Empty today: every API limiter uses the helper.
const RAW_429_EXCLUSIONS = new Map<string, string>();
const RATE_LIMIT_THROW_EXCLUSIONS = new Map<string, string>();
const HELPER_ONLY_EXCLUSIONS = new Map<string, string>([
  [
    "replay/stream/route.ts",
    "Root-owned replay work uses the separate in-process checkLocalRateLimit admission path.",
  ],
]);
const DELEGATED_LIMITER_ROUTES = new Map<
  string,
  { handler: string; reason: string }
>([
  [
    "analytics/onboarding/route.ts",
    {
      handler: "analytics/onboarding/handler.ts",
      reason:
        "The exported route injects the exact shared limiter into the provider-free handler used by its hostile-body tests.",
    },
  ],
]);

function routeFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(path));
    else if (entry.name === "route.ts") files.push(path);
  }
  return files.sort();
}

let limitedFiles = 0;
let limiterCalls = 0;
let limitedOperations = 0;
let responseHelperCalls = 0;
const publicErrors = new Map<string, number>();

for (const path of routeFiles(API_ROOT)) {
  const source = readFileSync(path, "utf8");
  const route = relative(API_ROOT, path).replaceAll("\\", "/");
  const delegatedLimiter = DELEGATED_LIMITER_ROUTES.get(route);
  const contractPath = delegatedLimiter
    ? join(API_ROOT, delegatedLimiter.handler)
    : path;
  const contractSource = delegatedLimiter
    ? readFileSync(contractPath, "utf8")
    : source;
  const auditedSource = delegatedLimiter
    ? `${source}\n${contractSource}`
    : source;
  const hasLimiter =
    source.includes("checkRateLimit(") || Boolean(delegatedLimiter);
  const hasResponseHelper = contractSource.includes("rateLimitExceededResponse(");

  if (/\b429\b/.test(auditedSource) && !RAW_429_EXCLUSIONS.has(route)) {
    assert.fail(`${route} contains a raw HTTP 429 instead of the shared helper`);
  }
  if (
    /throw\s+new\s+Error\(["']rate_limit\.exceeded["']\)/.test(auditedSource) &&
    !RATE_LIMIT_THROW_EXCLUSIONS.has(route)
  ) {
    assert.fail(`${route} throws a headerless rate-limit error`);
  }

  if (hasResponseHelper && !hasLimiter) {
    assert.ok(
      HELPER_ONLY_EXCLUSIONS.has(route),
      `${route} uses the response helper without the shared runtime limiter`
    );
  } else {
    assert.equal(
      hasResponseHelper,
      hasLimiter,
      `${route} must use the response helper exactly when it owns a runtime limiter`
    );
  }
  if (!hasLimiter) continue;

  if (delegatedLimiter) {
    assert.match(source, /await import\("@\/lib\/rate-limit"\)/);
    assert.match(source, /checkLimit: checkRateLimit/);
    assert.match(contractSource, /const rateLimit = await checkLimit\(/);
    assert.match(contractSource, /\{ failClosed: true \}/);
  }

  limitedFiles += 1;
  limiterCalls += delegatedLimiter
    ? 1
    : (source.match(/\bcheckRateLimit\(/g)?.length ?? 0);
  assert.match(
    contractSource,
    /from ["']@\/lib\/rate-limit-response["']/,
    `${route} must import the shared response helper`
  );

  const file = ts.createSourceFile(
    contractPath,
    contractSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const inspect = (node: ts.Node) => {
    if (ts.isIfStatement(node) && /^![A-Za-z_$][\w$]*\.allowed$/.test(
      node.expression.getText(file)
    )) {
      limitedOperations += 1;
      assert.match(
        node.thenStatement.getText(file),
        /\brateLimitExceededResponse\(/,
        `${route} has a limiter denial branch that bypasses the shared helper`
      );
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(file) === "rateLimitExceededResponse"
    ) {
      responseHelperCalls += 1;
      const error = node.arguments[2];
      assert.ok(
        error && ts.isObjectLiteralExpression(error),
        `${route} must provide a literal public rate-limit error contract`
      );
      let code: string | undefined;
      let message: string | undefined;
      for (const property of error.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isStringLiteralLike(property.initializer)
        ) {
          continue;
        }
        const name = property.name.getText(file);
        if (name === "code") code = property.initializer.text;
        if (name === "message") message = property.initializer.text;
      }
      assert.ok(code && message, `${route} must pin its public error code and message`);
      const key = `${code}|${message}`;
      publicErrors.set(key, (publicErrors.get(key) ?? 0) + 1);
    }
    ts.forEachChild(node, inspect);
  };
  inspect(file);
}

assert.equal(limitedFiles, EXPECTED_LIMITED_ROUTE_FILES);
assert.equal(limiterCalls, EXPECTED_LIMITER_CALLS);
assert.equal(limitedOperations, EXPECTED_LIMITED_OPERATIONS);
assert.equal(responseHelperCalls, EXPECTED_LIMITED_OPERATIONS);
assert.deepEqual(
  [...publicErrors.entries()].sort(([left], [right]) => left.localeCompare(right)),
  [
    ["rate_limit.exceeded|rate_limit.exceeded", 11],
    ["rate_limit.exceeded|Too many requests", 49],
    ["rate_limited|Too many requests", 2],
  ]
);

console.log(
  `rate-limit route contract passed (${limitedOperations} operations in ${limitedFiles} files)`
);
