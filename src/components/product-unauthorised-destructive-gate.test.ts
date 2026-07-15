import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS,
  PRODUCT_UNAUTHORISED_DESTRUCTIVE_GATE_SCOPE,
  findUnauthorisedDestructiveIssues,
} from "./product-unauthorised-destructive-gate";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";

const REQUIREMENT_ID = "VERIFY.GATE.unauthorised-destructive" as const;
const DESTRUCTIVE_FORM_ID =
  /(?:DELETION|DELETE|WITHDRAW|ARCHIVE|LEAVE|OWNER\.TRANSFER|MEMBER\.REMOVE|ADMIN-LISTINGS\.FORM\.REMOVE)$/;

const immutableRequirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.equal(
  immutableRequirement?.requirement,
  "Fail when a destructive action is available to an unauthorised role.",
);
assert.equal(PRODUCT_MASTER_EVIDENCE[REQUIREMENT_ID]?.status, "tested");
const completedRequirement = MASTER_AUDIT_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(completedRequirement, REQUIREMENT_ID);
assert.equal(isMasterRequirementComplete(completedRequirement), true);
assert.equal(
  MASTER_AUDIT_REQUIREMENTS.filter(isMasterRequirementComplete).length -
    MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
      requirement.id === REQUIREMENT_ID
        ? { ...requirement, status: "not-started" as const, evidence: [] }
        : requirement,
    ).filter(isMasterRequirementComplete).length,
  1,
  "this gate must contribute exactly one completed master requirement",
);
assert.deepEqual(
  findUnauthorisedDestructiveIssues(PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS),
  [],
);

const discoveredForms = Object.entries(PRODUCTION_SCREEN_INTERACTION_CONTRACTS)
  .flatMap(([route, interaction]) =>
    interaction.forms
      .filter(({ id }) => DESTRUCTIVE_FORM_ID.test(id))
      .map((form) => ({
        id: `${route}::${form.id}`,
        route,
        formId: form.id,
        action: form.submitsTo.replace(/^SERVER ACTION /, ""),
      })),
  )
  .toSorted((left, right) => left.id.localeCompare(right.id));
assert.deepEqual(
  PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS.map(
    ({ id, route, formId, action }) => ({ id, route, formId, action }),
  ).toSorted((left, right) => left.id.localeCompare(right.id)),
  discoveredForms,
  "every newly registered destructive form must receive an actor and server-authority contract",
);

for (const item of PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS) {
  for (const path of [item.actionFile, item.policyFile, item.testFile]) {
    assert.equal(existsSync(path), true, `${item.id}: ${path}`);
  }
  const actionSource = readFileSync(item.actionFile, "utf8");
  assert.match(actionSource, new RegExp(`function\\s+${item.action}\\b`), item.id);
  assert.ok(actionSource.includes(`${item.actionGuard}(`), item.id);
  assert.ok(actionSource.includes(`${item.actionAuthorityToken}(`), item.id);

  const policySource = readFileSync(item.policyFile, "utf8");
  assert.match(
    policySource,
    new RegExp(`function\\s+${item.policySymbol}\\b`),
    item.id,
  );
  assert.ok(policySource.includes(item.policyAuthorityToken), item.id);
  assert.match(
    readFileSync(item.testFile, "utf8"),
    new RegExp(`screen-evidence-test-id: ${item.testId}`),
    item.id,
  );
}

const fixture = PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS[0];
assert.deepEqual(
  findUnauthorisedDestructiveIssues([
    { ...fixture, deniedActors: [] },
  ]),
  [`${fixture.id}:DENIED_ACTOR_MISSING`],
);
assert.deepEqual(
  findUnauthorisedDestructiveIssues([
    {
      ...fixture,
      deniedActors: [fixture.authorisedActors[0]],
    },
  ]),
  [`${fixture.id}:ACTOR_POLICY_OVERLAP`],
);
assert.deepEqual(
  findUnauthorisedDestructiveIssues([
    { ...fixture, actionGuard: "", actionAuthorityToken: "" },
  ]),
  [`${fixture.id}:ACTION_AUTHORITY_MISSING`],
);

assert.match(PRODUCT_UNAUTHORISED_DESTRUCTIVE_GATE_SCOPE, /fail-closed source audit/i);
assert.match(PRODUCT_UNAUTHORISED_DESTRUCTIVE_GATE_SCOPE, /denied actor/i);
assert.match(PRODUCT_UNAUTHORISED_DESTRUCTIVE_GATE_SCOPE, /does not claim deployed/i);

console.log(
  `Unauthorised destructive gate passed: ${PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS.length} destructive controls fail closed on actor and server-authority drift.`,
);
