import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  ARCHITECTURE_ADAPTATION_BOUNDARIES,
  ARCHITECTURE_ADAPTATION_MASTER_EVIDENCE,
  ARCHITECTURE_ADAPTATION_REQUIREMENT_ID,
} from "./architecture-adaptation-evidence";
import { SECURITY_TRACES } from "./traces";

assert.equal(ARCHITECTURE_ADAPTATION_BOUNDARIES.length, 5);
assert.equal(
  new Set(ARCHITECTURE_ADAPTATION_BOUNDARIES.map(({ traceId }) => traceId)).size,
  ARCHITECTURE_ADAPTATION_BOUNDARIES.length,
);

for (const adapter of ARCHITECTURE_ADAPTATION_BOUNDARIES) {
  const trace = SECURITY_TRACES.find(
    (candidate) => candidate.traceId === adapter.traceId,
  );
  assert.ok(trace, `${adapter.boundary}: missing ${adapter.traceId}`);

  for (const facet of adapter.requiredFacets) {
    if (facet === "frontend") assert.ok(trace.frontend.sourceFiles.length > 0);
    if (facet === "transport") assert.ok(trace.transport.pathOrProcedure.trim());
    if (facet === "server") assert.ok(trace.server.entryFiles.length > 0);
    if (facet === "database") assert.ok(trace.databaseOperations.length > 0);
    if (facet === "background") assert.ok(trace.backgroundOperations.length > 0);
    if (facet === "external") assert.ok(trace.externalOperations.length > 0);
  }

  assert.ok(trace.tests.length > 0);
  assert.ok(trace.evidence.length > 0);
  assert.ok(trace.owner.trim());
  assert.ok(trace.verificationStatus.trim());
}

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === ARCHITECTURE_ADAPTATION_REQUIREMENT_ID,
);
assert.ok(requirement);
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[ARCHITECTURE_ADAPTATION_REQUIREMENT_ID],
  ARCHITECTURE_ADAPTATION_MASTER_EVIDENCE[
    ARCHITECTURE_ADAPTATION_REQUIREMENT_ID
  ],
);
assert.equal(isMasterRequirementComplete(requirement), true);
for (const evidencePath of SECURITY_MASTER_EVIDENCE[
  ARCHITECTURE_ADAPTATION_REQUIREMENT_ID
].evidence) {
  assert.ok(existsSync(evidencePath), `missing ${evidencePath}`);
}

console.log(
  "security trace architecture adaptation passed: 5 architecture boundaries represented",
);
