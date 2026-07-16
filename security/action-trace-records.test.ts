import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  ACTION_TRACE_RECORD_FIELD_BINDINGS,
  ACTION_TRACE_RECORD_MASTER_EVIDENCE,
} from "./action-trace-record-evidence";
import {
  ACTION_TRACE_RECORDS,
  ACTION_TRACE_SECTION_FIELDS,
  validateActionTraceRecords,
} from "./action-trace-records";
import { SECURITY_TRACES } from "./traces";

const bindingGroups = Object.entries(ACTION_TRACE_RECORD_FIELD_BINDINGS);
assert.equal(
  bindingGroups.reduce(
    (total, [, bindings]) => total + Object.keys(bindings).length,
    0,
  ),
  105,
);
assert.equal(ACTION_TRACE_RECORDS.length, SECURITY_TRACES.length);
assert.deepEqual(validateActionTraceRecords(ACTION_TRACE_RECORDS), []);

const frontendNonAuthorityIds = [
  "security.action-trace-frontend.usability-control",
  "security.primary-objective-trace-evidence.frontend-not-authority",
] as const;
for (const record of ACTION_TRACE_RECORDS) {
  assert.match(
    record.frontend.frontendSecurityDecision,
    /^Frontend checks are usability controls only;/,
  );
  assert.ok(
    record.frontend.frontendSecurityDecision.includes(
      record.serverEntry.authenticationFunction,
    ),
  );
  assert.ok(
    record.frontend.frontendSecurityDecision.includes(
      record.serverEntry.authorisationFunction,
    ),
  );
}
for (const requirementId of frontendNonAuthorityIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    ACTION_TRACE_RECORD_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const [section, bindings] of bindingGroups) {
  assert.deepEqual(
    Object.values(bindings).toSorted(),
    [...ACTION_TRACE_SECTION_FIELDS[section as keyof typeof ACTION_TRACE_SECTION_FIELDS]].toSorted(),
  );
  for (const id of Object.keys(bindings)) {
    const requirement = MASTER_AUDIT_REQUIREMENTS.find(
      (candidate) => candidate.prompt === "security" && candidate.id === id,
    );
    assert.ok(requirement, `${id}: missing immutable requirement`);
    assert.deepEqual(
      SECURITY_MASTER_EVIDENCE[id],
      ACTION_TRACE_RECORD_MASTER_EVIDENCE[id],
    );
    assert.equal(isMasterRequirementComplete(requirement), true);
    for (const evidencePath of ACTION_TRACE_RECORD_MASTER_EVIDENCE[id].evidence) {
      assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
    }
  }
}

const forged = ACTION_TRACE_RECORDS.map((record) => ({
  ...record,
  response: { ...record.response },
}));
delete (forged[0].response as Partial<(typeof forged)[number]["response"]>)
  .focusBehaviour;
assert.deepEqual(validateActionTraceRecords(forged), [
  `${forged[0].traceId}:response.focusBehaviour`,
]);

console.log("action trace compatibility evidence passed: 105 fields across 18 traces");
