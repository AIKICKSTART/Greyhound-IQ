import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

assert.match(source, /READINESS_DB_MAX_WAIT_MS = 1_000/);
assert.match(source, /READINESS_DB_TIMEOUT_MS = 2_000/);
assert.match(source, /track\.findFirst\(\{ select: \{ id: true \} \}\)/);
assert.doesNotMatch(source, /track\.count\(/);
assert.match(source, /checks: \{ database: "configuration_error" \}/);
assert.doesNotMatch(source, /checks: \{ database: dbConfigurationError \}/);
assert.match(source, /"Cache-Control": "no-store, max-age=0"/);
assert.match(source, /GET\(request: Request\)/);
assert.match(source, /logCorrelationContextFromHeaders\(request\.headers\)/);
assert.match(source, /logCorrelatedError\(logContext, "health\.ready\.database"/);
assert.doesNotMatch(source, /console\.error/);

console.log("readiness route contract tests passed");
