import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { z } from "zod";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  ENDPOINT_VALIDATION_FIXTURES,
  type EndpointValidationFixture,
} from "./endpoint-validation-fixtures";
import { PROPERTY_AUTHORIZATION_FACTS } from "./property-authorization-evidence";
import {
  buildUnknownInputFieldMasterEvidence,
  UNKNOWN_INPUT_FIELD_FACTS,
  UNKNOWN_INPUT_FIELD_MASTER_EVIDENCE,
  UNKNOWN_INPUT_FIELD_REQUIREMENT_ID,
  UNKNOWN_INPUT_FIELD_SCOPE,
  unknownFieldsAreContained,
  type UnknownInputFieldFacts,
} from "./unknown-input-field-aggregate-evidence";

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === UNKNOWN_INPUT_FIELD_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable unknown-input-field requirement missing");
assert.equal(requirement.requirement, "Define unknown-field behavior.");

const evidence =
  UNKNOWN_INPUT_FIELD_MASTER_EVIDENCE[UNKNOWN_INPUT_FIELD_REQUIREMENT_ID];
assert.ok(evidence, "unknown-input-field evidence must be emitted");
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing unknown-input-field evidence: ${path}`);
}
assert.match(UNKNOWN_INPUT_FIELD_SCOPE, /all 33 bounded JSON\/form API bodies/i);
assert.equal(ENDPOINT_VALIDATION_FIXTURES.length, 33);
assert.equal(unknownFieldsAreContained(ENDPOINT_VALIDATION_FIXTURES), true);
assert.equal(PROPERTY_AUTHORIZATION_FACTS.mutationInventoryExhaustive, true);

assert.equal(
  unknownFieldsAreContained([
    unsafeFixture(z.object({ title: z.string() }).passthrough()),
  ]),
  false,
  "a schema that preserves an attacker-controlled field must fail closed",
);
assert.equal(
  unknownFieldsAreContained([
    {
      endpoint: "POST /fixture",
      schema: z.object({ title: z.string() }),
      valid: { title: "safe" },
      cases: [],
    },
  ]),
  false,
  "a missing unexpected-field fixture must fail closed",
);
assert.equal(
  unknownFieldsAreContained([]),
  false,
  "a vacuous route inventory must fail closed",
);

for (const fact of Object.keys(
  UNKNOWN_INPUT_FIELD_FACTS,
) as Array<keyof UnknownInputFieldFacts>) {
  assert.deepEqual(
    buildUnknownInputFieldMasterEvidence({
      ...UNKNOWN_INPUT_FIELD_FACTS,
      [fact]: false,
    }),
    {},
    `${fact}: incomplete unknown-field proof must withhold master evidence`,
  );
}

console.log(
  `Unknown-input-field aggregate passed: ${ENDPOINT_VALIDATION_FIXTURES.length} JSON/form route schemas contain unexpected fields and every discovered mutation entry point remains allowlisted.`,
);

function unsafeFixture(
  schema: EndpointValidationFixture["schema"],
): EndpointValidationFixture {
  return {
    endpoint: "POST /fixture",
    schema,
    valid: { title: "safe" },
    cases: [
      {
        kind: "unexpected-fields",
        input: { title: "safe", attackerRole: "administrator" },
        expectation: "reject-or-strip",
        strippedKey: "attackerRole",
      },
    ],
  };
}
