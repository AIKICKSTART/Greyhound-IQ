import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { z } from "zod";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  ENDPOINT_VALIDATION_FIXTURES,
  type EndpointValidationFixture,
} from "./endpoint-validation-fixtures";
import {
  auditNullInputBehavior,
  buildNullInputBehaviorMasterEvidence,
  NULL_INPUT_BEHAVIOR_FACTS,
  NULL_INPUT_BEHAVIOR_MASTER_EVIDENCE,
  NULL_INPUT_BEHAVIOR_REQUIREMENT_ID,
  NULL_INPUT_BEHAVIOR_SCOPE,
  REVIEWED_NULLABLE_INPUTS,
  type NullInputBehaviorFacts,
} from "./null-input-behavior-evidence";

const audit = auditNullInputBehavior(ENDPOINT_VALIDATION_FIXTURES);
assert.deepEqual(audit.issues, []);
assert.deepEqual(
  {
    routes: audit.routes,
    fields: audit.fields,
    nullableFields: audit.nullableFields,
  },
  { routes: 33, fields: 122, nullableFields: 48 },
);
assert.equal(REVIEWED_NULLABLE_INPUTS.length, 48);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === NULL_INPUT_BEHAVIOR_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable null-input behavior requirement missing");
assert.equal(requirement.requirement, "Define null behavior.");
const evidence =
  NULL_INPUT_BEHAVIOR_MASTER_EVIDENCE[NULL_INPUT_BEHAVIOR_REQUIREMENT_ID];
assert.ok(evidence, "null-input behavior evidence must be emitted");
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing null-input evidence: ${path}`);
}
assert.match(NULL_INPUT_BEHAVIOR_SCOPE, /every accepted null/i);

assertIssue([], "NULL_ROUTE_INVENTORY_VACUOUS");
assertIssue(
  [fixture(z.object({ title: z.string() }).nullable())],
  "NULL_BODY_ACCEPTED",
);
assertIssue(
  [fixture(z.string())],
  "NULL_SCHEMA_SHAPE_MISSING",
);
assertIssue(
  [fixture(z.object({ title: z.string().nullable() }))],
  "NULL_FIELD_UNREVIEWED",
);
assert.ok(
  auditNullInputBehavior(
    ENDPOINT_VALIDATION_FIXTURES,
    REVIEWED_NULLABLE_INPUTS.slice(1),
  ).issues.some((issue) => issue.startsWith("NULL_FIELD_UNREVIEWED")),
  "removing a reviewed nullable field must fail closed",
);
assert.ok(
  auditNullInputBehavior(ENDPOINT_VALIDATION_FIXTURES, [
    ...REVIEWED_NULLABLE_INPUTS,
    {
      endpoint: "POST /api/not-real",
      field: "ghost",
      disposition: "invalid stale fixture",
    },
  ]).issues.includes("NULL_REVIEW_STALE:POST /api/not-real#ghost"),
  "a stale nullable-field review must fail closed",
);

for (const fact of Object.keys(
  NULL_INPUT_BEHAVIOR_FACTS,
) as Array<keyof NullInputBehaviorFacts>) {
  assert.deepEqual(
    buildNullInputBehaviorMasterEvidence({
      ...NULL_INPUT_BEHAVIOR_FACTS,
      [fact]: false,
    }),
    {},
    `${fact}: incomplete null-input proof must withhold master evidence`,
  );
}

console.log(
  `Null-input behavior evidence passed: ${audit.routes} schemas, ${audit.fields} fields and ${audit.nullableFields} exact nullable dispositions; all unreviewed null behavior fails closed.`,
);

function assertIssue(
  fixtures: readonly EndpointValidationFixture[],
  expected: string,
) {
  const issues = auditNullInputBehavior(fixtures).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function fixture(schema: EndpointValidationFixture["schema"]): EndpointValidationFixture {
  return {
    endpoint: "POST /fixture",
    schema,
    valid: { title: "safe" },
    cases: [],
  };
}
