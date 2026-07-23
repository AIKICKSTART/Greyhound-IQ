import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  findStateRepresentationIssues,
  PRODUCT_STATE_REPRESENTATION_EVIDENCE_FILE,
  PRODUCT_STATE_REPRESENTATION_EXPECTED_GAIN,
  PRODUCT_STATE_REPRESENTATION_MASTER_EVIDENCE,
  PRODUCT_STATE_REPRESENTATION_REQUIREMENT_IDS,
  PRODUCT_STATE_REPRESENTATION_SCOPE,
  PRODUCT_STATE_REPRESENTATION_TEST_FILE,
} from "./product-state-representation-evidence";

// screen-evidence-test-id: PRODUCT-STATE-REPRESENTATION-EVIDENCE

const EXPECTED_IDS = ["COMPLETE.EVIDENCE.states-represented"] as const;

assert.deepEqual(PRODUCT_STATE_REPRESENTATION_REQUIREMENT_IDS, EXPECTED_IDS);
assert.equal(PRODUCT_STATE_REPRESENTATION_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_STATE_REPRESENTATION_MASTER_EVIDENCE),
  EXPECTED_IDS,
);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === EXPECTED_IDS[0],
);
assert.equal(
  requirement?.requirement,
  "Provide evidence that every meaningful state was represented.",
);

const record =
  PRODUCT_STATE_REPRESENTATION_MASTER_EVIDENCE[EXPECTED_IDS[0]];
assert.equal(record.status, "tested");
assert.deepEqual(record.evidence.slice(0, 2), [
  PRODUCT_STATE_REPRESENTATION_EVIDENCE_FILE,
  PRODUCT_STATE_REPRESENTATION_TEST_FILE,
]);
assert.equal(new Set(record.evidence).size, record.evidence.length);
for (const evidencePath of record.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}

assert.equal(SCREEN_CONTRACTS.length, 103);
assert.equal(
  SCREEN_CONTRACTS.reduce(
    (total, screen) => total + screen.stateRules.length,
    0,
  ),
  429,
);
assert.deepEqual(findStateRepresentationIssues(SCREEN_CONTRACTS), []);

const stateEvidenceTests = new Map(
  record.evidence
    .filter((path) => /screen.*\.test\.tsx?$/.test(path))
    .map((path) => [path, readFileSync(path, "utf8")] as const),
);
assert.equal(stateEvidenceTests.size, 4);
for (const [testPath, source] of stateEvidenceTests) {
  assert.match(source, /screen-evidence-test-id:/, testPath);
}
for (const screen of SCREEN_CONTRACTS) {
  assert.ok(screen.stateRules.length > 0, screen.route);
  assert.deepEqual(
    screen.supportedStates,
    screen.stateRules.map(({ id }) => id),
    screen.route,
  );
  assert.ok(
    ["verified", "tested"].includes(screen.coverage.states.status),
    screen.route,
  );
  for (const evidencePath of screen.coverage.states.evidence) {
    assert.equal(
      existsSync(evidencePath),
      true,
      `${screen.route}: ${evidencePath}`,
    );
  }
  for (const state of screen.stateRules) {
    assert.ok(state.id.trim(), screen.route);
    assert.ok(state.testIds.length > 0, `${screen.route}:${state.id}`);
    for (const testId of state.testIds) {
      assert.ok(testId.trim(), `${screen.route}:${state.id}`);
    }
  }
}

const validFixture = {
  route: "/fixture",
  stateRules: [{ id: "FIXTURE.STATE.POPULATED", testIds: ["FIXTURE-STATE"] }],
  supportedStates: ["FIXTURE.STATE.POPULATED"],
  coverage: {
    states: {
      status: "tested",
      evidence: ["src/fixture.tsx", "src/fixture.test.ts"],
    },
  },
} as const;
assert.deepEqual(findStateRepresentationIssues([validFixture]), []);

const negativeFixtures = [
  {
    name: "missing state",
    screens: [{ ...validFixture, stateRules: [], supportedStates: [] }],
    expected: /no represented states/,
  },
  {
    name: "duplicate state",
    screens: [
      {
        ...validFixture,
        stateRules: [validFixture.stateRules[0], validFixture.stateRules[0]],
        supportedStates: [
          "FIXTURE.STATE.POPULATED",
          "FIXTURE.STATE.POPULATED",
        ],
      },
    ],
    expected: /duplicate state id/,
  },
  {
    name: "unsupported drift",
    screens: [{ ...validFixture, supportedStates: ["FIXTURE.STATE.EMPTY"] }],
    expected: /supported-state list does not match/,
  },
  {
    name: "missing test id",
    screens: [
      {
        ...validFixture,
        stateRules: [{ id: "FIXTURE.STATE.POPULATED", testIds: [] }],
      },
    ],
    expected: /missing focused test id/,
  },
  {
    name: "incomplete coverage",
    screens: [
      {
        ...validFixture,
        coverage: {
          states: { ...validFixture.coverage.states, status: "not-started" },
        },
      },
    ],
    expected: /state coverage is not complete/,
  },
  {
    name: "missing evidence",
    screens: [
      {
        ...validFixture,
        coverage: { states: { status: "tested", evidence: [] } },
      },
    ],
    expected: /no source evidence/,
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.match(
    findStateRepresentationIssues(fixture.screens).join("\n"),
    fixture.expected,
    fixture.name,
  );
}

assert.match(PRODUCT_STATE_REPRESENTATION_SCOPE, /103 canonical screen contracts/i);
assert.match(PRODUCT_STATE_REPRESENTATION_SCOPE, /429 route-scoped state records/i);
assert.match(PRODUCT_STATE_REPRESENTATION_SCOPE, /closes representation only/i);
assert.match(PRODUCT_STATE_REPRESENTATION_SCOPE, /state-fixture remains open/i);
assert.match(PRODUCT_STATE_REPRESENTATION_SCOPE, /does not claim.*browser rendering/i);
const evidenceSource = readFileSync(
  PRODUCT_STATE_REPRESENTATION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Product state-representation evidence passed: 97 screens and 429 route-scoped states close exactly one representation gate while per-state fixture coverage stays open.",
);
