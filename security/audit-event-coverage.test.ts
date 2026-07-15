import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { AUDIT_EVENTS } from "./audit-events";
import {
  AUDIT_EVENT_REQUIREMENT_BINDINGS,
  auditEventRequirementIsImplemented,
} from "./audit-event-coverage";
import { AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE } from "./audit-event-coverage-evidence";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";

const masterAuditRequirementsSource = readFileSync(
  "src/components/master-audit-requirements.ts",
  "utf8",
);
const masterAuditEvidenceSource = readFileSync(
  "src/components/master-audit-evidence.ts",
  "utf8",
);

assert.match(
  masterAuditEvidenceSource,
  /import \{ AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE \} from "\.\.\/\.\.\/security\/audit-event-coverage-evidence"/,
);
assert.match(
  masterAuditEvidenceSource,
  /\.\.\.AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE/,
);
assert.match(
  masterAuditRequirementsSource,
  /\.\.\.SECURITY_MASTER_REQUIREMENTS\.map\(\(requirement\) => \(\{/,
);
assert.match(
  masterAuditRequirementsSource,
  /\.\.\.\(SECURITY_MASTER_EVIDENCE\[requirement\.id\] \?\? \{\}\)/,
);

assert.equal(AUDIT_EVENT_REQUIREMENT_BINDINGS.length, 18);
assert.equal(
  new Set(
    AUDIT_EVENT_REQUIREMENT_BINDINGS.map(({ requirementId }) => requirementId),
  ).size,
  AUDIT_EVENT_REQUIREMENT_BINDINGS.length,
);

for (const binding of AUDIT_EVENT_REQUIREMENT_BINDINGS) {
  assert.equal(auditEventRequirementIsImplemented(binding), true);

  const requirement = SECURITY_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === binding.requirementId,
  );
  assert.ok(requirement, `${binding.requirementId}: missing immutable requirement`);
  assert.equal(requirement.section, "audit-event");
  const coverage = AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE[binding.requirementId];
  assert.equal(coverage?.status, "verified");

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

  for (const evidencePath of coverage.evidence) {
    assert.ok(existsSync(evidencePath), `${binding.requirementId}: missing ${evidencePath}`);
  }
}

const sourceAssertions = {
  "AUDIT.AUTH.CALLBACK.FAILED": [
    /"auth\.callback_failed"/,
    /\{ reason, referenceId \}/,
  ],
  "AUDIT.ACCOUNT.DELETION.REQUESTED": [
    /withDbRequestContext\(current, async \(tx\)/,
    /action: "user\.delete"/,
    /graceDays: 30/,
  ],
  "AUDIT.ACCOUNT.DELETION.FINALIZED": [
    /action: "user\.delete\.finalize"/,
    /remoteProviderReferencesRetained/,
    /tx\.auditLog\.create/,
  ],
  "AUDIT.ACCOUNT.DELETION.STORAGE": [
    /action: "user\.delete\.storage"/,
    /action: "user\.delete\.storage_failed"/,
    /safeDeletionErrorCode\(err\)/,
  ],
  "AUDIT.ACCOUNT.DATA_EXPORT.DOWNLOADED": [
    /recordUserExportCompletion\(current/,
    /action: "user\.export"/,
    /sizeBytes: input\.sizeBytes/,
  ],
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
  "AUDIT.ORGANIZATION.OWNERSHIP.TRANSFERRED": [
    /action: "team\.owner\.transfer"/,
    /data: \{ ownerId: input\.targetUserId \}/,
    /tx\.auditLog\.createMany/,
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

const boundEventIds = new Set(
  AUDIT_EVENT_REQUIREMENT_BINDINGS.flatMap(({ eventIds }) => eventIds),
);
assert.equal(Object.keys(sourceAssertions).length, boundEventIds.size);
for (const eventId of boundEventIds) {
  assert.ok(sourceAssertions[eventId as keyof typeof sourceAssertions]);
}

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
assert.ok(
  SECURITY_MASTER_REQUIREMENTS.some(
    (requirement) => requirement.id === supportImpersonationId,
  ),
);
assert.equal(
  AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE[supportImpersonationId]?.status,
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
  "audit event coverage passed: 18 implemented event requirements and one support-impersonation exclusion",
);
