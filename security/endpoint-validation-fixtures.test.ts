import assert from "node:assert/strict";

import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import { ENDPOINT_VALIDATION_JSON_ROUTES } from "./endpoint-validation-evidence";
import {
  ENDPOINT_VALIDATION_FIXTURES,
  VERIFIED_ENDPOINT_HOSTILE_CASE_KINDS,
  type EndpointHostileCaseKind,
} from "./endpoint-validation-fixtures";

assert.deepEqual(
  ENDPOINT_VALIDATION_FIXTURES.map(({ endpoint }) => endpoint).toSorted(),
  [...ENDPOINT_VALIDATION_JSON_ROUTES].toSorted(),
  "the hostile fixture registry must cover every bounded JSON/form route",
);

const coveredKinds = new Map<EndpointHostileCaseKind, Set<string>>();
for (const fixture of ENDPOINT_VALIDATION_FIXTURES) {
  assert.equal(
    fixture.schema.safeParse(fixture.valid).success,
    true,
    `${fixture.endpoint}: valid control fixture must parse`,
  );

  const fixtureKinds = new Set<EndpointHostileCaseKind>();
  for (const hostile of fixture.cases) {
    assert.equal(
      fixtureKinds.has(hostile.kind),
      false,
      `${fixture.endpoint}: duplicate ${hostile.kind} fixture`,
    );
    fixtureKinds.add(hostile.kind);
    const result = fixture.schema.safeParse(hostile.input);
    if (hostile.expectation === "accept") {
      assert.equal(
        result.success,
        true,
        `${fixture.endpoint}: ${hostile.kind} is an explicitly safe accepted value`,
      );
    } else if (hostile.expectation === "reject-or-strip") {
      if (result.success && hostile.strippedKey) {
        assert.equal(
          hostile.strippedKey in (result.data as Record<string, unknown>),
          false,
          `${fixture.endpoint}: ${hostile.kind} must be rejected or stripped`,
        );
      }
    } else {
      assert.equal(
        result.success,
        false,
        `${fixture.endpoint}: ${hostile.kind} must fail closed`,
      );
    }
    const endpoints = coveredKinds.get(hostile.kind) ?? new Set<string>();
    endpoints.add(fixture.endpoint);
    coveredKinds.set(hostile.kind, endpoints);
  }
}

for (const universalKind of ["null", "wrong-type", "unexpected-fields"] as const) {
  assert.equal(
    coveredKinds.get(universalKind)?.size,
    ENDPOINT_VALIDATION_JSON_ROUTES.length,
    `${universalKind} must be exercised against all JSON/form endpoints`,
  );
}

const minimumApplicableEndpointCounts: Readonly<
  Partial<Record<EndpointHostileCaseKind, number>>
> = {
  "missing-required-field": 25,
  "empty-string": 33,
  "excessively-long-value": 33,
  "out-of-range-number": 4,
  "invalid-enumeration": 16,
  "invalid-nested-object": 2,
  "oversized-array": 5,
  "invalid-url": 1,
};
for (const kind of VERIFIED_ENDPOINT_HOSTILE_CASE_KINDS) {
  const count = coveredKinds.get(kind)?.size ?? 0;
  assert.ok(
    count >= (minimumApplicableEndpointCounts[kind] ?? 1),
    `${kind}: applicable endpoint coverage unexpectedly fell to ${count}`,
  );
  const requirementId = `security.endpoint-test-validation.${kind}`;
  assert.ok(
    MASTER_AUDIT_REQUIREMENTS.some(({ id }) => id === requirementId),
    `${requirementId}: immutable requirement missing`,
  );
}

console.log(
  `Endpoint hostile fixtures passed: ${ENDPOINT_VALIDATION_FIXTURES.length} JSON/form routes, ${[...coveredKinds.values()].reduce((sum, endpoints) => sum + endpoints.size, 0)} endpoint-case assertions, and ${VERIFIED_ENDPOINT_HOSTILE_CASE_KINDS.length} exact validation gates`,
);
