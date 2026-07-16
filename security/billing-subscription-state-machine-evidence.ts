export const BILLING_SUBSCRIPTION_STATE_MACHINE_EVIDENCE = [
  "src/lib/billing/subscription-state-machine.ts",
  "src/lib/billing/subscription-state-machine.test.ts",
  "src/lib/billing/stripe-webhooks.ts",
  "src/lib/billing/lago-reducer.ts",
  "external/lago/api/app/models/subscription.rb",
  "external/lago/api/app/services/subscriptions/activate_service.rb",
  "external/lago/api/app/services/subscriptions/terminate_service.rb",
  "external/lago/api/app/services/subscriptions/activation_rules/resolve_subscription_status_service.rb",
  "security/billing-subscription-state-machine-evidence.ts",
  "security/billing-subscription-state-machine-evidence.test.ts",
] as const;

export const BILLING_SUBSCRIPTION_STATE_MACHINE_BOUNDARY = {
  verified:
    "The Stripe reducer validates signed previous_attributes.status against an explicit Stripe status transition allowlist, while the Lago reducer reads its persisted subscription status and validates it against the vendored Lago lifecycle before either reducer mutates billing state. Both reject unknown states and illegal transitions, retain same-state updates, permit a known first observation, and preserve legitimate recovery including Stripe past_due to active and Lago incomplete to active.",
  excluded:
    "This evidence does not prove out-of-order delivery handling, cross-provider webhook idempotency, entitlement grace periods, refund controls, card-data controls, concurrent transition serialization, or live provider acceptance.",
} as const;

export const BILLING_SUBSCRIPTION_STATE_MACHINE_MASTER_EVIDENCE = {
  "security.billing-control.state-machine": {
    status: "verified",
    evidence: BILLING_SUBSCRIPTION_STATE_MACHINE_EVIDENCE,
  },
} as const;
