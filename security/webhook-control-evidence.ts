const WEBHOOK_CONTROL_EVIDENCE = [
  "src/app/api/webhooks/stripe/route.ts",
  "src/app/api/webhooks/lago/route.ts",
  "src/app/api/livekit/webhook/route.ts",
  "src/lib/billing/stripe-webhooks.ts",
  "src/lib/billing/stripe-readiness.test.ts",
  "src/lib/billing/stripe-webhook-settlement.test.ts",
  "src/lib/billing/lago-webhooks.ts",
  "src/lib/billing/lago-reducer.ts",
  "prisma/schema.prisma",
  "prisma/migrations/20260715072000_fence_billing_webhook_reducers/migration.sql",
  "src/lib/livekit-admin.ts",
  "src/lib/call-service.ts",
  "src/lib/logger.ts",
  "external/lago/api/app/models/webhook.rb",
  "security/webhook-control-evidence.test.ts",
  "security/billing-webhook-idempotency-evidence.test.ts",
  "security/webhook-runtime-control.test.ts",
] as const;

const VERIFIED_WEBHOOK_CONTROL_IDS = [
  "security.webhook-control.provider",
  "security.webhook-control.signature",
  "security.webhook-control.freshness",
  "security.webhook-control.raw-body",
  "security.webhook-control.reject-signature",
  "security.webhook-control.browser-not-proof",
  "security.webhook-control.redacted-logs",
  "security.billing-control.ownership-link",
  "security.billing-control.customer-id",
  "security.billing-control.webhook-idempotent",
  "security.release.14.payment-state-server-confirmed",
] as const;

export const OPEN_WEBHOOK_CONTROL_GAPS = {
  "security.webhook-control.replay":
    "Stripe and Lago have receipt deduplication and LiveKit mutations are guarded, but there is no uniform provider-event replay ledger for every webhook.",
  "security.webhook-control.event-id":
    "Stripe and Lago record provider identifiers; LiveKit does not persist every provider event identifier.",
  "security.webhook-control.dedupe":
    "Billing deliveries are deduplicated, but LiveKit uses domain compare-and-set guards rather than a uniform webhook receipt.",
  "security.webhook-control.duplicate":
    "Duplicate billing deliveries are handled, but no provider-wide duplicate receipt outcome exists for LiveKit.",
  "security.webhook-control.out-of-order":
    "No tested event-version or provider-created-at guard prevents older billing state from overwriting newer state.",
  "security.webhook-control.delayed":
    "Stripe delayed-payment settlement is handled, but delayed and stale delivery behavior is not specified for every provider event type.",
  "security.webhook-control.refetch":
    "The reducers do not re-fetch authoritative provider state before every sensitive state transition.",
  "security.webhook-control.transaction":
    "Stripe settlement is transactional, but Lago receipt insertion and reduction occur in separate transactions.",
  "security.webhook-control.audit":
    "Billing receipts are audited, but LiveKit does not retain a receipt for every accepted or rejected webhook event.",
  "security.webhook-control.prompt-response":
    "Provider response latency has no executable upper-bound test under dependency load.",
  "security.webhook-control.async":
    "Webhook reducers still perform database and domain processing synchronously in the request path.",
  "security.webhook-control.minimal-payload":
    "Stripe stores a minimal receipt, but Lago still stores the complete provider payload for reduction and replay analysis.",
} as const;

export const WEBHOOK_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_WEBHOOK_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: WEBHOOK_CONTROL_EVIDENCE },
  ]),
);
