import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { HEALTH_ENDPOINT_REDACTION_MASTER_EVIDENCE } from "./health-endpoint-redaction-evidence";

const root = readFileSync("src/app/api/health/route.ts", "utf8");
const billing = readFileSync("src/app/api/health/billing/route.ts", "utf8");
const feeds = readFileSync("src/app/api/health/feeds/route.ts", "utf8");
const ready = readFileSync("src/app/api/health/ready/route.ts", "utf8");

assert.match(root, /status: "ok"/);
assert.match(root, /service: "greyhoundiq-web"/);
assert.doesNotMatch(root, /process\.env|error\.stack|DATABASE_URL|password|secret/i);

assert.match(billing, /isInternalRequest\(request\)/);
assert.match(
  billing,
  /: \{ status: ready \? "ready" : "not_ready", timestamp:/,
);
assert.doesNotMatch(billing, /error\.stack|error\.message|process\.env|credential/i);

assert.match(feeds, /if \(!isInternalRequest\(request\)\)/);
assert.match(feeds, /\{ status: status\.status, timestamp: status\.timestamp \}/);
assert.match(feeds, /Public probe gets liveness only/);
assert.doesNotMatch(feeds, /error\.stack|error\.message|process\.env|credential/i);

for (const safeDatabaseState of [
  'database: "configuration_error"',
  'database: "ok"',
  'database: "error"',
]) {
  assert.match(ready, new RegExp(safeDatabaseState));
}
assert.match(ready, /logCorrelatedError\(/);
assert.doesNotMatch(
  ready,
  /NextResponse\.json\([\s\S]{0,160}(?:err|error)\.(?:message|stack)/,
);
assert.doesNotMatch(
  ready,
  /process\.env|\b(?:DATABASE_URL|password|secret|hostname|port)\b/i,
);

const requirementId = "security.api-inventory-management.health-redact";
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[requirementId],
  HEALTH_ENDPOINT_REDACTION_MASTER_EVIDENCE[requirementId],
);
const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement);
assert.equal(isMasterRequirementComplete(requirement), true);

console.log(
  "Health endpoint redaction passed: public probes expose bounded status only and diagnostics remain server-side",
);
