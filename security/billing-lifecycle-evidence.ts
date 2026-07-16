const EVIDENCE_REGISTRY_PATHS = [
  "security/billing-lifecycle-evidence.ts",
  "security/billing-lifecycle-evidence.test.ts",
] as const;

function evidence(...paths: string[]) {
  return [...paths, ...EVIDENCE_REGISTRY_PATHS] as const;
}

const VERIFIED_BILLING_LIFECYCLE_TRACE = [
  {
    requirementId: "security.billing-lifecycle.selection",
    boundary:
      "The pricing and authenticated account forms submit the selected server-supported plan and interval to the billing checkout route.",
    evidence: evidence(
      "src/app/pricing/page.tsx",
      "src/app/account/page.tsx",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.checkout",
    boundary:
      "The checkout route parses the request, validates its origin, requires the current user profile, applies a fail-closed rate limit, and then creates checkout.",
    evidence: evidence(
      "src/app/api/billing/checkout/route.ts",
      "src/lib/billing/stripe-readiness.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.allowlist",
    boundary:
      "The checkout route accepts only the literal pro plan and monthly or yearly intervals; the server maps that pair to configured Stripe price identifiers.",
    evidence: evidence(
      "src/app/api/billing/checkout/route.ts",
      "src/lib/billing/stripe-env.ts",
      "src/lib/billing/stripe-service.ts",
      "src/lib/billing/stripe-readiness.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.provider-session",
    boundary:
      "Server-only billing code creates a Stripe-hosted Checkout Session bound to the authenticated database user and Stripe customer.",
    evidence: evidence(
      "src/lib/billing/stripe-client.ts",
      "src/lib/billing/stripe-service.ts",
      "src/lib/billing/stripe-readiness.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.redirect",
    boundary:
      "Only the URL returned by Stripe Checkout is used for the route's 303 provider redirect.",
    evidence: evidence(
      "src/app/api/billing/checkout/route.ts",
      "src/lib/billing/stripe-service.ts",
      "src/lib/billing/stripe-readiness.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.provider-payment",
    boundary:
      "Payment entry and processing are delegated to Stripe-hosted Checkout; GreyhoundIQ accepts the resulting provider state only through the signed webhook path. This source boundary is not live Stripe test-mode acceptance.",
    evidence: evidence(
      "src/lib/billing/stripe-service.ts",
      "src/app/api/webhooks/stripe/route.ts",
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.webhook",
    boundary:
      "The Stripe webhook route preserves the raw request body and the billing reducer verifies the Stripe signature before reading or storing provider state.",
    evidence: evidence(
      "src/app/api/webhooks/stripe/route.ts",
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/billing/stripe-readiness.test.ts",
      "security/webhook-control-evidence.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.dedupe",
    boundary:
      "The Stripe path deduplicates receipts by provider event identifier and provider-payload hash and uses compare-and-set handling for failed-delivery retries. Cross-provider idempotency remains a separate open control.",
    evidence: evidence(
      "src/lib/billing/stripe-webhooks.ts",
      "prisma/schema.prisma",
      "security/webhook-control-evidence.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.provider-verify",
    boundary:
      "The reducer grants subscription access only from a settled invoice with matching customer, subscription, metadata user, currency, and one server-allowlisted price.",
    evidence: evidence(
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.transaction",
    boundary:
      "Stripe receipt creation, provider-state reduction, entitlement mutation, and receipt completion run inside the database system-context transaction.",
    evidence: evidence(
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/db-context.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.entitlements",
    boundary:
      "A settled invoice updates the database subscription tier; subsequent authenticated requests re-read that tier and calculate active-snapshot or tier-default entitlement limits server-side.",
    evidence: evidence(
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/auth.ts",
      "src/lib/billing/entitlement-service.ts",
      "src/lib/billing/entitlement-service.test.ts",
      "src/app/account/billing/page.tsx",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.audit",
    boundary:
      "The signed Stripe event creates a minimal provider receipt and records its ignored, processed, retry, or failed outcome without retaining the payment object.",
    evidence: evidence(
      "src/lib/billing/stripe-webhooks.ts",
      "prisma/schema.prisma",
      "security/webhook-control-evidence.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.return",
    boundary:
      "Stripe returns the browser to the billing page, where query parameters only explain the return and explicitly do not change the local plan.",
    evidence: evidence(
      "src/lib/billing/stripe-service.ts",
      "src/app/account/billing/page.tsx",
      "src/lib/billing/stripe-readiness.test.ts",
    ),
  },
  {
    requirementId: "security.billing-lifecycle.display",
    boundary:
      "The force-dynamic billing page authenticates the user and renders bounded, user-scoped database billing records plus server-calculated entitlements.",
    evidence: evidence(
      "src/app/account/billing/page.tsx",
      "src/lib/auth.ts",
      "src/lib/billing/entitlement-service.ts",
      "src/lib/billing/entitlement-service.test.ts",
    ),
  },
] as const;

const BILLING_CACHE_TRACE = {
  requirementId: "security.billing-lifecycle.cache",
  boundary:
    "The billing runtime is deliberately uncached: the billing page is force-dynamic and reads current database-backed billing and entitlement state on every request.",
  evidence: evidence(
    "src/app/account/billing/page.tsx",
    "src/lib/billing/entitlement-service.ts",
  ),
} as const;

export const BILLING_LIFECYCLE_SOURCE_TRACE = [
  ...VERIFIED_BILLING_LIFECYCLE_TRACE,
  BILLING_CACHE_TRACE,
] as const;

type BillingLifecycleEvidenceRecord =
  | { status: "verified"; evidence: readonly string[] }
  | {
      status: "not-applicable-with-justification";
      evidence: readonly string[];
      notApplicableJustification: string;
    };

export const BILLING_LIFECYCLE_MASTER_EVIDENCE: Readonly<
  Record<string, BillingLifecycleEvidenceRecord>
> = {
  ...Object.fromEntries(
    VERIFIED_BILLING_LIFECYCLE_TRACE.map((step) => [
      step.requirementId,
      { status: "verified" as const, evidence: step.evidence },
    ]),
  ),
  [BILLING_CACHE_TRACE.requirementId]: {
    status: "not-applicable-with-justification" as const,
    evidence: BILLING_CACHE_TRACE.evidence,
    notApplicableJustification:
      "The tested billing runtime has no shared billing cache: /account/billing is force-dynamic and reads authenticated user, billing, and entitlement state from the database on each request, so there is no billing cache to invalidate.",
  },
};

/**
 * These controls need product or reducer changes and must not be promoted by
 * source-trace evidence alone.
 */
export const BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS = [
  "security.billing-control.out-of-order",
  "security.billing-control.refund-privilege",
  "security.billing-control.refund-audit",
  "security.billing-control.grace-period",
] as const;

/** Source evidence cannot substitute for an authorised Stripe test-mode run. */
export const STRIPE_TEST_MODE_BILLING_ACCEPTANCE = {
  status: "open",
  requiredEvidence: [
    "Complete an authenticated hosted Checkout Session in Stripe test mode.",
    "Deliver its signed test-mode webhook through the staging ingress.",
    "Verify the settled tier and billing display for the same staging user.",
  ],
} as const;
