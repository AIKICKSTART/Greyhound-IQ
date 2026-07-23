import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  OPEN_TRACE_IDENTIFIER_EXAMPLE_GAPS,
  TRACE_IDENTIFIER_EXAMPLE_BINDINGS,
  TRACE_IDENTIFIER_EXAMPLE_MASTER_EVIDENCE,
} from "./trace-identifier-example-evidence";

const expectedBindings = {
  "security.trace-identifier-example.public-home-start-sign-in":
    "PUBLIC.HOME.START_SIGN_IN",
  "security.trace-identifier-example.racing-open-dog":
    "RACING.RACE_DETAIL.OPEN_DOG",
  "security.trace-identifier-example.community-create-post":
    "COMMUNITY.FEED.CREATE_POST",
  "security.trace-identifier-example.community-add-comment":
    "COMMUNITY.POST.ADD_COMMENT",
  "security.trace-identifier-example.pulse-send-message":
    "PULSE.THREAD.SEND_MESSAGE",
  "security.trace-identifier-example.marketplace-save":
    "MARKETPLACE.LISTING.SAVE",
  "security.trace-identifier-example.marketplace-create":
    "MARKETPLACE.LISTING.CREATE",
  "security.trace-identifier-example.account-profile-update":
    "ACCOUNT.PROFILE.UPDATE",
  "security.trace-identifier-example.account-team-role":
    "ACCOUNT.TEAM.CHANGE_ROLE",
  "security.trace-identifier-example.billing-checkout": "BILLING.CHECKOUT.START",
  "security.trace-identifier-example.admin-user-status":
    "ADMIN.USERS.CHANGE_STATUS",
  "security.trace-identifier-example.ai-start-run": "AI.AGENT.START_RUN",
  "security.trace-identifier-example.design-lab-simulate":
    "DESIGN_LAB.SCREEN.SIMULATE_ACTION",
} as const;

assert.equal(TRACE_IDENTIFIER_EXAMPLE_BINDINGS.length, 13);
assert.deepEqual(
  Object.fromEntries(
    TRACE_IDENTIFIER_EXAMPLE_BINDINGS.map((binding) => [
      binding.requirementId,
      binding.traceId,
    ]),
  ),
  expectedBindings,
);

const stableIdentifierPattern = /^[A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*){2,}$/;
const traceIds = TRACE_IDENTIFIER_EXAMPLE_BINDINGS.map(
  (binding) => binding.traceId,
);
assert.equal(new Set(traceIds).size, traceIds.length);
assert.ok(traceIds.every((traceId) => stableIdentifierPattern.test(traceId)));
assert.equal(stableIdentifierPattern.test("not-a-stable-trace-id"), false);

for (const binding of TRACE_IDENTIFIER_EXAMPLE_BINDINGS) {
  assert.ok(binding.action.length > 20, `${binding.traceId}: action is too vague`);
  assert.ok(
    binding.sourceAnchors.length > 0,
    `${binding.traceId}: missing source anchor`,
  );
  for (const anchor of binding.sourceAnchors) {
    const source = readFileSync(anchor.file, "utf8");
    assert.ok(
      source.includes(anchor.needle),
      `${binding.traceId}: ${anchor.symbol} anchor drifted in ${anchor.file}`,
    );
  }

  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[binding.requirementId],
    TRACE_IDENTIFIER_EXAMPLE_MASTER_EVIDENCE[binding.requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === binding.requirementId,
  );
  assert.ok(requirement, `${binding.requirementId}: immutable requirement missing`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

assert.deepEqual(Object.keys(OPEN_TRACE_IDENTIFIER_EXAMPLE_GAPS), []);

console.log(
  "Trace identifier example evidence passed: 13 implemented actions bound to stable source-anchored identifiers with no declared identifier gap",
);
