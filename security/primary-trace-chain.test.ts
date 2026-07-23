import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  PRIMARY_TRACE_CHAIN_FIELD_BINDINGS,
  PRIMARY_TRACE_CHAIN_MASTER_EVIDENCE,
} from "./primary-trace-chain-evidence";
import {
  PRIMARY_TRACE_CHAIN_FIELDS,
  PRIMARY_TRACE_CHAINS,
  validatePrimaryTraceChains,
} from "./primary-trace-chain";
import { SECURITY_TRACES } from "./traces";

const bindings = Object.entries(PRIMARY_TRACE_CHAIN_FIELD_BINDINGS);
assert.equal(bindings.length, 30);
assert.deepEqual(
  bindings.map(([, field]) => field).toSorted(),
  [...PRIMARY_TRACE_CHAIN_FIELDS].toSorted(),
);
assert.equal(PRIMARY_TRACE_CHAINS.length, SECURITY_TRACES.length);
assert.deepEqual(validatePrimaryTraceChains(PRIMARY_TRACE_CHAINS), []);

for (const [id] of bindings) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    PRIMARY_TRACE_CHAIN_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of PRIMARY_TRACE_CHAIN_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

const forged = PRIMARY_TRACE_CHAINS.map((record) => ({ ...record }));
delete (forged[0] as Partial<(typeof forged)[number]>).authorization;
assert.deepEqual(validatePrimaryTraceChains(forged), [
  `${forged[0].traceId}:authorization`,
]);

console.log(
  "primary trace chain evidence passed: 30 fields across 9 trace records",
);
