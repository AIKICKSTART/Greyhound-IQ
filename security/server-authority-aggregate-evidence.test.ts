import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { FRONTEND_AUTHORIZATION_MASTER_EVIDENCE } from "./frontend-authorization-evidence";
import {
  buildServerAuthorityAggregateMasterEvidence,
  SERVER_AUTHORITY_AGGREGATE_FACTS,
  SERVER_AUTHORITY_AGGREGATE_MASTER_EVIDENCE,
  SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS,
  type ServerAuthorityAggregateFacts,
} from "./server-authority-aggregate-evidence";

const immutableRequirementIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.map(({ id }) => id),
);
assert.equal(Object.keys(FRONTEND_AUTHORIZATION_MASTER_EVIDENCE).length, 6);
assert.equal(SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS.length, 2);

for (const requirementId of SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS) {
  assert.ok(
    immutableRequirementIds.has(requirementId),
    `${requirementId}: missing immutable requirement`,
  );
  const evidence = SERVER_AUTHORITY_AGGREGATE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "verified");
  for (const path of evidence.evidence) {
    assert.ok(existsSync(path), `${requirementId}: missing ${path}`);
  }
}

for (const fact of Object.keys(
  SERVER_AUTHORITY_AGGREGATE_FACTS,
) as Array<keyof ServerAuthorityAggregateFacts>) {
  assert.deepEqual(
    buildServerAuthorityAggregateMasterEvidence({
      ...SERVER_AUTHORITY_AGGREGATE_FACTS,
      [fact]: false,
    }),
    {},
    `${fact}: incomplete server-authority proof must withhold all aggregate evidence`,
  );
}

console.log(
  `Server-authority aggregate passed: ${Object.keys(FRONTEND_AUTHORIZATION_MASTER_EVIDENCE).length} source-backed controls close ${SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS.length} fail-closed aggregate gates.`,
);
