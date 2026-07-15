import assert from "node:assert/strict";

import {
  SECURITY_MASTER_REQUIREMENT_COUNTS,
  SECURITY_MASTER_REQUIREMENTS,
  SECURITY_REQUIREMENT_SECTIONS,
  type SecurityMasterRequirement,
} from "./security-master-requirements";

const EXPECTED_SECTIONS = [
  "engagement-role",
  "required-input-registry",
  "trace-scope",
  "standards-baseline",
  "primary-objective-trace-chain",
  "primary-objective-trace-evidence",
  "security-language",
  "risk-acceptance",
  "authorised-testing-boundary",
  "server-authority",
  "deny-by-default",
  "least-privilege",
  "explicit-data-selection",
  "secure-failure",
  "architecture-application-surface",
  "architecture-infrastructure-surface",
  "architecture-component-record",
  "trust-boundary-diagram",
  "trace-identifier",
  "trace-identifier-example",
  "security-trace-contract",
  "security-trace-enum",
  "database-operation-contract",
  "database-operation-enum",
  "action-trace-user-context",
  "action-trace-frontend",
  "action-trace-request",
  "action-trace-server-entry",
  "action-trace-authorization",
  "action-trace-database",
  "action-trace-side-effect",
  "action-trace-response",
  "action-trace-evidence",
  "api-inventory-surface",
  "api-inventory-record",
  "api-inventory-management",
  "authentication-path",
  "authentication-control",
  "cookie-control",
  "csrf-control",
  "authorization-actor",
  "authorization-dimension",
  "object-authorization",
  "property-authorization",
  "tenant-isolation",
  "administration-control",
  "external-input-surface",
  "input-validation",
  "injection-prevention",
  "database-inventory",
  "database-column-record",
  "actual-query-capture",
  "database-query-record",
  "query-safety",
  "mutation-safety",
  "row-level-security",
  "database-role-separation",
  "migration-review",
  "api-top-ten",
  "resource-control",
  "sensitive-business-flow",
  "abuse-control",
  "idempotency-control",
  "cors-control",
  "http-control",
  "webhook-control",
  "queue-worker-control",
  "scheduled-task-control",
  "realtime-control",
  "voice-video-control",
  "file-media-inventory",
  "upload-validation",
  "upload-control",
  "upload-untrusted-claim",
  "download-control",
  "ssrf-control",
  "browser-data-handling",
  "frontend-authorization",
  "xss-surface",
  "browser-security-header",
  "external-link-embed",
  "threat-model-governance",
  "threat-public",
  "threat-racing",
  "threat-community",
  "threat-messaging",
  "threat-marketplace",
  "threat-account",
  "threat-administration",
  "threat-ai",
  "threat-design-lab",
  "third-party-inventory",
  "third-party-record",
  "third-party-response-validation",
  "third-party-prohibition",
  "billing-lifecycle",
  "billing-control",
  "personal-information-record",
  "privacy-minimisation",
  "retention-schedule",
  "deletion-lifecycle",
  "incident-readiness",
  "secret-inventory",
  "secret-record",
  "secret-control",
  "cryptography-record",
  "application-log-field",
  "application-log-prohibition",
  "audit-event",
  "audit-integrity",
  "alert-event",
  "alert-record",
  "infrastructure-review",
  "infrastructure-control",
  "supply-chain-control",
  "supply-chain-review",
  "endpoint-test-authentication",
  "endpoint-test-authorization",
  "endpoint-test-validation",
  "endpoint-test-injection-output",
  "endpoint-test-resource-abuse",
  "endpoint-test-concurrency",
  "endpoint-test-database",
  "endpoint-test-error",
  "endpoint-test-audit-failure",
  "mandatory-trace",
  "ci-gate",
  "ci-gate-governance",
  "security-finding-record",
  "finding-severity",
  "required-output",
  "registry-governance",
  "final-traceability-field",
  "final-summary-metric",
  "release-criterion",
  "implementation-cycle",
  "placeholder-prohibition",
  "reviewer-answerability",
] as const;

assert.deepEqual(
  SECURITY_REQUIREMENT_SECTIONS,
  EXPECTED_SECTIONS,
  "security prompt section IDs are an exact, stable contract"
);

const ids = SECURITY_MASTER_REQUIREMENTS.map((item) => item.id);
assert.equal(new Set(ids).size, ids.length, "security requirement IDs must be unique");
assert.equal(
  SECURITY_MASTER_REQUIREMENTS.length,
  2_288,
  "atomic security prompt coverage changed; review every added or removed item"
);

for (const section of EXPECTED_SECTIONS) {
  assert.ok(
    SECURITY_MASTER_REQUIREMENTS.some((item) => item.section === section),
    `security registry must include ${section}`
  );
}

assert.equal(count("mandatory-trace"), SECURITY_MASTER_REQUIREMENT_COUNTS.mandatoryTrace);
assert.equal(count("ci-gate"), SECURITY_MASTER_REQUIREMENT_COUNTS.ciGate);
assert.equal(count("required-output"), SECURITY_MASTER_REQUIREMENT_COUNTS.requiredOutput);
assert.equal(count("release-criterion"), SECURITY_MASTER_REQUIREMENT_COUNTS.releaseCriterion);

for (const item of SECURITY_MASTER_REQUIREMENTS) {
  assert.equal(item.prompt, "security");
  assert.match(item.id, /^security\.[a-z0-9.-]+$/);
  assert.ok(item.requirement.trim().length > 0, `${item.id} must state a requirement`);
  assert.ok(item.owner.trim().length > 0, `${item.id} must have an owner`);
  assert.equal(item.releaseBlocking, true, `${item.id} must block release until assessed`);
  assert.equal(item.status, "not-assessed", `${item.id} must default honestly to not-assessed`);
  if (!["mandatory-trace", "ci-gate", "required-output", "release-criterion"].includes(item.section)) {
    assert.ok(
      item.id.startsWith(`security.${item.section}.`),
      `${item.id} must remain bound to its stable section ID`
    );
  }
  assertRequirementIntegrity(item);
}

const seed = SECURITY_MASTER_REQUIREMENTS[0];
assert.ok(seed);
assert.throws(
  () => assertRequirementIntegrity({ ...seed, status: "verified" }),
  /evidence/
);
assert.throws(
  () =>
    assertRequirementIntegrity({
      ...seed,
      status: "risk-accepted-temporarily",
      evidence: ["risk-register"],
    }),
  /risk acceptance/
);
assert.throws(
  () =>
    assertRequirementIntegrity({
      ...seed,
      status: "not-applicable-with-justification",
      evidence: ["architecture-review"],
    }),
  /justification/
);

function assertRequirementIntegrity(item: SecurityMasterRequirement) {
  if (item.status !== "not-assessed") {
    assert.ok(item.evidence.length > 0, `${item.id} needs evidence for status ${item.status}`);
  }

  if (item.status === "risk-accepted-temporarily") {
    const risk = item.riskAcceptance;
    assert.ok(risk, `${item.id} needs complete risk acceptance data`);
    assert.ok(risk.owner.trim(), `${item.id} risk acceptance needs an owner`);
    assert.ok(risk.reason.trim(), `${item.id} risk acceptance needs a reason`);
    assert.ok(risk.compensatingControls.length, `${item.id} needs compensating controls`);
    assert.match(risk.expiresOn, /^\d{4}-\d{2}-\d{2}$/, `${item.id} needs an ISO expiry date`);
    assert.ok(Date.parse(`${risk.expiresOn}T23:59:59Z`) > Date.now(), `${item.id} risk acceptance is expired`);
    assert.ok(risk.remediationPlan.trim(), `${item.id} needs a remediation plan`);
    assert.ok(risk.retestRequirement.trim(), `${item.id} needs a retest requirement`);
  }

  if (item.status === "not-applicable-with-justification") {
    assert.ok(
      item.notApplicableJustification?.trim(),
      `${item.id} needs a not-applicable justification`
    );
  }
}

function count(section: (typeof SECURITY_REQUIREMENT_SECTIONS)[number]) {
  return SECURITY_MASTER_REQUIREMENTS.filter((item) => item.section === section).length;
}

console.log("security master requirements registry tests passed");
