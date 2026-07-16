import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS } from "./billing-lifecycle-evidence";
import {
  BILLING_SUBSCRIPTION_STATE_MACHINE_BOUNDARY,
  BILLING_SUBSCRIPTION_STATE_MACHINE_EVIDENCE,
  BILLING_SUBSCRIPTION_STATE_MACHINE_MASTER_EVIDENCE,
} from "./billing-subscription-state-machine-evidence";

const requirementId = "security.billing-control.state-machine";
const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId
);
assert.ok(requirement, `${requirementId}: missing immutable requirement`);
assert.equal(requirement.section, "billing-control");
assert.deepEqual(Object.keys(BILLING_SUBSCRIPTION_STATE_MACHINE_MASTER_EVIDENCE), [
  requirementId,
]);
assert.equal(
  BILLING_SUBSCRIPTION_STATE_MACHINE_MASTER_EVIDENCE[requirementId].status,
  "verified"
);
assert.ok(BILLING_SUBSCRIPTION_STATE_MACHINE_BOUNDARY.verified.length > 300);
assert.match(BILLING_SUBSCRIPTION_STATE_MACHINE_BOUNDARY.excluded, /out-of-order/);
assert.match(BILLING_SUBSCRIPTION_STATE_MACHINE_BOUNDARY.excluded, /idempotency/);
assert.match(BILLING_SUBSCRIPTION_STATE_MACHINE_BOUNDARY.excluded, /refund/);
assert.match(BILLING_SUBSCRIPTION_STATE_MACHINE_BOUNDARY.excluded, /card-data/);
assert.equal(
  new Set<string>(BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS).has(requirementId),
  false
);

for (const evidencePath of BILLING_SUBSCRIPTION_STATE_MACHINE_EVIDENCE) {
  assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
}

const stateMachine = read("src/lib/billing/subscription-state-machine.ts");
assert.match(stateMachine, /Record<Stripe\.Subscription\.Status/);
assert.match(stateMachine, /past_due: \["active"/);
assert.match(stateMachine, /incomplete_expired: \[\]/);
assert.match(stateMachine, /terminated: \[\]/);
assert.match(stateMachine, /canceled: \[\]/);
assert.match(stateMachine, /Object\.hasOwn\(transitions, nextStatus\)/);
assert.match(stateMachine, /billing\.subscription_transition_illegal/);

const stripeReducer = read("src/lib/billing/stripe-webhooks.ts");
assert.match(stripeReducer, /stripeEvent\.data\.previous_attributes\?\.status/);
assert.match(
  stripeReducer,
  /assertSubscriptionStatusTransition\(\{[\s\S]*provider: "stripe",[\s\S]*nextStatus: subscription\.status/
);

const lagoReducer = read("src/lib/billing/lago-reducer.ts");
assert.match(
  lagoReducer,
  /currentSubscription = await tx\.subscription\.findUnique\([\s\S]*select: \{ status: true \}/
);
assert.match(
  lagoReducer,
  /assertSubscriptionStatusTransition\(\{[\s\S]*provider: "lago",[\s\S]*nextStatus/
);
assert.match(lagoReducer, /create: \{[\s\S]*status,[\s\S]*update: \{[\s\S]*status,/);

const lagoModel = read("external/lago/api/app/models/subscription.rb");
assert.match(
  lagoModel,
  /STATUSES = \[[\s\S]*:pending[\s\S]*:active[\s\S]*:terminated[\s\S]*:canceled[\s\S]*:incomplete/
);
assert.match(
  read("external/lago/api/app/services/subscriptions/activate_service.rb"),
  /mark_as_incomplete![\s\S]*mark_as_active!/
);
assert.match(
  read("external/lago/api/app/services/subscriptions/terminate_service.rb"),
  /if subscription\.pending\?[\s\S]*mark_as_canceled![\s\S]*mark_as_terminated!/
);
assert.match(
  read(
    "external/lago/api/app/services/subscriptions/activation_rules/resolve_subscription_status_service.rb"
  ),
  /all_rules_satisfied\?[\s\S]*ActivateService[\s\S]*any_rule_failed\?[\s\S]*mark_as_canceled!/
);

console.log(
  "billing subscription state-machine evidence passed: one control verified; seven adjacent billing controls remain open"
);

function read(path: string) {
  return readFileSync(path, "utf8");
}
