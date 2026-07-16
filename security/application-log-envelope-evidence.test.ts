import assert from "node:assert/strict";

import { logCorrelatedInfo } from "../src/lib/logger";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  APPLICATION_LOG_ENVELOPE_MASTER_EVIDENCE,
  APPLICATION_LOG_ENVELOPE_REQUIREMENT_IDS,
} from "./application-log-envelope-evidence";

const lines: string[] = [];
const originalInfo = console.info;
const originalEnvironment = process.env.GREYHOUNDIQ_ENV;
console.info = (line: string) => lines.push(line);
process.env.GREYHOUNDIQ_ENV = "evidence-test";
try {
  logCorrelatedInfo(
    {
      requestId: "request-evidence-123",
      traceId: "105445aa7843bc8bf206b12000100000",
    },
    "security.evidence_action",
    {
      actorId: "user-123",
      tenantId: "organization-456",
      targetType: "listing",
      targetId: "listing-789",
      outcome: "denied",
      errorClass: "authorization",
      durationMs: 17,
      securityMetadata: {
        policy: "listing.owner",
        authorization: "Bearer never-log-this",
      },
    },
  );
} finally {
  console.info = originalInfo;
  if (originalEnvironment === undefined) delete process.env.GREYHOUNDIQ_ENV;
  else process.env.GREYHOUNDIQ_ENV = originalEnvironment;
}

assert.equal(lines.length, 1);
const record = JSON.parse(lines[0]) as Record<string, unknown>;
assert.equal(record.environment, "evidence-test");
assert.equal(record.requestId, "request-evidence-123");
assert.equal(record.traceId, "105445aa7843bc8bf206b12000100000");
assert.equal(record.event, "security.evidence_action");
assert.match(String(record.timestamp), /^\d{4}-\d{2}-\d{2}T/);
assert.equal(record.actorId, "user-123");
assert.equal(record.tenantId, "organization-456");
assert.equal(record.targetType, "listing");
assert.equal(record.targetId, "listing-789");
assert.equal(record.outcome, "denied");
assert.equal(record.errorClass, "authorization");
assert.equal(record.durationMs, 17);
assert.deepEqual(record.securityMetadata, {
  policy: "listing.owner",
  authorization: "[REDACTED]",
});

assert.equal(APPLICATION_LOG_ENVELOPE_REQUIREMENT_IDS.length, 13);
for (const requirementId of APPLICATION_LOG_ENVELOPE_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    APPLICATION_LOG_ENVELOPE_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log("application log envelope passed: 13 mandatory fields emitted");
