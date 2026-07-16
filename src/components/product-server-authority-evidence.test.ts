import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  FRONTEND_AUTHORIZATION_EVIDENCE_SCOPE,
  FRONTEND_AUTHORIZATION_MASTER_EVIDENCE,
} from "../../security/frontend-authorization-evidence";
import {
  SERVER_AUTHORITY_AGGREGATE_FACTS,
  SERVER_AUTHORITY_AGGREGATE_MASTER_EVIDENCE,
  SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS,
} from "../../security/server-authority-aggregate-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_SERVER_AUTHORITY_EVIDENCE_FILE,
  PRODUCT_SERVER_AUTHORITY_EXPECTED_GAIN,
  PRODUCT_SERVER_AUTHORITY_MASTER_EVIDENCE,
  PRODUCT_SERVER_AUTHORITY_REQUIREMENT_IDS,
  PRODUCT_SERVER_AUTHORITY_SCOPE,
  PRODUCT_SERVER_AUTHORITY_TEST_FILE,
} from "./product-server-authority-evidence";

// screen-evidence-test-id: PRODUCT-SERVER-AUTHORITY

const REQUIREMENT_ID = "GLOBAL.SEC.server-authority" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(
  requirement.requirement,
  "Never treat UI hiding as authorisation.",
);
assert.deepEqual(PRODUCT_SERVER_AUTHORITY_REQUIREMENT_IDS, [REQUIREMENT_ID]);
assert.equal(PRODUCT_SERVER_AUTHORITY_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_SERVER_AUTHORITY_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_SERVER_AUTHORITY_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_SERVER_AUTHORITY_EVIDENCE_FILE,
  PRODUCT_SERVER_AUTHORITY_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

for (const phrase of [
  "interface visibility is usability only, never authority",
  "source-exhaustive authorization inventory",
  "alternate entry points",
  "hidden inputs",
  "server-side denial",
  "does not prove deployed signed-out, cross-user, or cross-tenant request matrices",
]) {
  assert.match(PRODUCT_SERVER_AUTHORITY_SCOPE, new RegExp(phrase, "i"));
}

assert.match(FRONTEND_AUTHORIZATION_EVIDENCE_SCOPE, /source-exhaustive/i);
assert.match(
  FRONTEND_AUTHORIZATION_EVIDENCE_SCOPE,
  /deployed signed-out, cross-user and cross-tenant request matrices remain separate/i,
);
assert.equal(Object.values(SERVER_AUTHORITY_AGGREGATE_FACTS).every(Boolean), true);
assert.deepEqual(SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS, [
  "security.server-authority.client-usability-only",
  "security.release.04.protected-endpoints-server-authn",
]);
for (const requirementId of SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS) {
  assert.equal(
    SERVER_AUTHORITY_AGGREGATE_MASTER_EVIDENCE[requirementId]?.status,
    "verified",
    requirementId,
  );
}
for (const requirementId of [
  "security.frontend-authorization.server-denial",
  "security.frontend-authorization.direct-api",
  "security.frontend-authorization.alternate-routes",
  "security.frontend-authorization.stale-entitlement",
  "security.frontend-authorization.browser-state",
  "security.frontend-authorization.hidden-fields",
] as const) {
  assert.equal(
    FRONTEND_AUTHORIZATION_MASTER_EVIDENCE[requirementId].status,
    "verified",
    requirementId,
  );
}

const frontendEvidence = source("security/frontend-authorization-evidence.ts");
for (const token of [
  "FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS",
  "FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS",
  "FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES",
  "FRONTEND_AUTHORIZATION_HIDDEN_FIELD_REUSABLE_COMPONENTS",
  '"security.frontend-authorization.server-denial"',
  '"security.frontend-authorization.direct-api"',
  '"security.frontend-authorization.browser-state"',
  '"security.frontend-authorization.hidden-fields"',
]) {
  assert.ok(frontendEvidence.includes(token), `frontend authority: ${token}`);
}

const aggregateTest = source(
  "security/server-authority-aggregate-evidence.test.ts",
);
assert.match(aggregateTest, /for \(const fact of Object\.keys\(/);
assert.match(
  aggregateTest,
  /incomplete server-authority proof must withhold all aggregate evidence/i,
);

const evidenceSource = source(PRODUCT_SERVER_AUTHORITY_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Product server-authority evidence passed: source-exhaustive frontend-independence controls prove UI hiding and browser state never grant authority; exact +1 central wiring is ready.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}
