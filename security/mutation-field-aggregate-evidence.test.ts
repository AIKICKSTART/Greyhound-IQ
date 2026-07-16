import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  PROPERTY_AUTHORIZATION_MASTER_EVIDENCE,
  PROPERTY_AUTHORIZATION_REQUIREMENT_IDS,
} from "./property-authorization-evidence";
import {
  buildMutationFieldAggregateMasterEvidence,
  MUTATION_FIELD_AGGREGATE_FACTS,
  MUTATION_FIELD_AGGREGATE_MASTER_EVIDENCE,
  MUTATION_FIELD_AGGREGATE_REQUIREMENT_IDS,
  type MutationFieldAggregateFacts,
} from "./mutation-field-aggregate-evidence";

const immutableRequirementIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.map(({ id }) => id),
);
assert.equal(MUTATION_FIELD_AGGREGATE_REQUIREMENT_IDS.length, 3);
assert.equal(
  Object.keys(PROPERTY_AUTHORIZATION_MASTER_EVIDENCE).length,
  PROPERTY_AUTHORIZATION_REQUIREMENT_IDS.length,
);

for (const requirementId of MUTATION_FIELD_AGGREGATE_REQUIREMENT_IDS) {
  assert.ok(
    immutableRequirementIds.has(requirementId),
    `${requirementId}: missing immutable requirement`,
  );
  const evidence = MUTATION_FIELD_AGGREGATE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "verified");
  for (const path of evidence.evidence) {
    assert.ok(existsSync(path), `${requirementId}: missing ${path}`);
  }
}

for (const fact of Object.keys(
  MUTATION_FIELD_AGGREGATE_FACTS,
) as Array<keyof MutationFieldAggregateFacts>) {
  assert.deepEqual(
    buildMutationFieldAggregateMasterEvidence({
      ...MUTATION_FIELD_AGGREGATE_FACTS,
      [fact]: false,
    }),
    {},
    `${fact}: incomplete mutation proof must withhold all aggregate evidence`,
  );
}

console.log(
  `Mutation-field aggregate passed: ${PROPERTY_AUTHORIZATION_REQUIREMENT_IDS.length} source-backed property controls close ${MUTATION_FIELD_AGGREGATE_REQUIREMENT_IDS.length} fail-closed aggregate gates.`,
);
