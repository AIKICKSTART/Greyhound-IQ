import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { AUDIT_EVENTS } from "./audit-events";
import {
  AUDIT_EVENT_REQUIREMENT_BINDINGS,
  auditEventRequirementIsImplemented,
} from "./audit-event-coverage";
import { AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE } from "./audit-event-coverage-evidence";

assert.equal(AUDIT_EVENT_REQUIREMENT_BINDINGS.length, 15);
assert.equal(
  new Set(
    AUDIT_EVENT_REQUIREMENT_BINDINGS.map(({ requirementId }) => requirementId),
  ).size,
  AUDIT_EVENT_REQUIREMENT_BINDINGS.length,
);

for (const binding of AUDIT_EVENT_REQUIREMENT_BINDINGS) {
  assert.equal(auditEventRequirementIsImplemented(binding), true);

  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === binding.requirementId,
  );
  assert.ok(requirement, `${binding.requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[binding.requirementId],
    AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE[binding.requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);

  for (const eventId of binding.eventIds) {
    const event = AUDIT_EVENTS.find((candidate) => candidate.eventId === eventId);
    assert.ok(event, `${binding.requirementId}: missing ${eventId}`);
    assert.notEqual(event.persistence, "missing");
    assert.ok(event.owner.trim());
    assert.ok(event.safeFields.length > 0);
    assert.ok(event.prohibitedFields.length > 0);
    assert.ok(event.evidence.length > 0);
    for (const sourceFile of event.sourceFiles) {
      assert.ok(existsSync(sourceFile), `${eventId}: missing ${sourceFile}`);
    }
  }

  for (const evidencePath of SECURITY_MASTER_EVIDENCE[binding.requirementId]
    .evidence) {
    assert.ok(existsSync(evidencePath), `${binding.requirementId}: missing ${evidencePath}`);
  }
}

const sourceAssertions = {
  "AUDIT.ACCOUNT.PRIVACY.MARKETING_CHANGED": [
    /action: "marketing_preference\.update"/,
    /tx\.auditLog\.create/,
  ],
  "AUDIT.ADMIN.USER.ACCESS_CHANGED": [
    /action: "admin\.user\.access_update"/,
    /banned: input\.banned/,
  ],
  "AUDIT.ADMIN.TEAM.INVITATION.CREATED": [
    /action: "admin\.invitation\.create"/,
    /emailHash: await sha256/,
  ],
  "AUDIT.MARKETPLACE.LISTING.MODERATED": [
    /"listing\.approve"/,
    /"listing\.reject"/,
    /"listing\.remove"/,
  ],
  "AUDIT.DOG.OWNERSHIP.VERIFICATION_DECIDED": [
    /action: "dog\.ownership\.approve"/,
    /action: "dog\.ownership\.reject"/,
  ],
  "AUDIT.BILLING.PAYMENT.CHANGED": [
    /case "paymentRecord"/,
    /action: `admin\.\$\{input\.resource\}\.update`/,
  ],
  "AUDIT.BILLING.ENTITLEMENT.CHANGED": [
    /action: "admin\.entitlement\.upsert"/,
    /featureKey: input\.featureKey/,
  ],
  "AUDIT.ADMIN.PRIVILEGED_MUTATION": [
    /tx\.adminAction\.create/,
    /tx\.auditLog\.create/,
  ],
  "AUDIT.AI.TOOL.MUTATION": [
    /action: "agent\.run"/,
    /action: "dog_card\.generate"/,
  ],
  "AUDIT.ADMIN.POLICY.CHANGED": [
    /action: "admin\.retention_policy\.upsert"/,
    /action: "platform_setting\.update"/,
  ],
} as const;

for (const [eventId, patterns] of Object.entries(sourceAssertions)) {
  const event = AUDIT_EVENTS.find((candidate) => candidate.eventId === eventId);
  assert.ok(event, `${eventId}: source assertion has no event`);
  const source = event.sourceFiles
    .map((sourceFile) => readFileSync(sourceFile, "utf8"))
    .join("\n");
  for (const pattern of patterns) {
    assert.match(source, pattern, `${eventId}: missing ${pattern}`);
  }
}

const supportImpersonationId =
  "security.audit-event.support-impersonation-where-supported";
const supportImpersonation = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === supportImpersonationId,
);
assert.ok(supportImpersonation);
assert.equal(isMasterRequirementComplete(supportImpersonation), true);
assert.equal(
  SECURITY_MASTER_EVIDENCE[supportImpersonationId]?.status,
  "not-applicable-with-justification",
);
const adminService = readFileSync("src/lib/admin-service.ts", "utf8");
assert.match(adminService, /userId: current\.dbUserId/);
assert.doesNotMatch(adminService, /impersonat|assumeUser|switchUserSession/i);

const mutation = {
  ...AUDIT_EVENT_REQUIREMENT_BINDINGS[0],
  eventIds: ["AUDIT.DOES.NOT.EXIST"],
};
assert.equal(auditEventRequirementIsImplemented(mutation), false);

console.log(
  "audit event coverage passed: 15 implemented event requirements and one support-impersonation exclusion",
);
