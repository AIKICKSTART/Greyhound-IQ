import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_FILE =
  "src/components/product-public-route-outcome-evidence.ts" as const;
export const PRODUCT_PUBLIC_ROUTE_OUTCOME_TEST_FILE =
  "src/components/product-public-route-outcome-evidence.test.ts" as const;

export const PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_SCOPE =
  "Deterministic source and focused-unit verification of the GET /sign-in and GET /callback handlers, the public authentication-recovery page, the maintenance response, offline/restored state handling, signed-out legal-page access, the canonical public screens' primary-action contracts, and the rule that a checkout-return query is not payment proof. This evidence does not prove live WorkOS or Stripe behavior, browser rendering, deployed configuration, authentication loading or success presentation, pricing-content parity with entitlements, whole-product accessibility or responsive behavior, or production readiness.";

export const PRODUCT_PUBLIC_ROUTE_OUTCOME_REQUIREMENT_IDS = [
  "ROUTE.PUBLIC.sign-in",
  "ROUTE.PUBLIC.callback",
  "ROUTE.PUBLIC.recoverable-error",
  "ROUTE.PUBLIC.maintenance",
  "ROUTE.PUBLIC.offline",
  "ROUTE.PUBLIC.legal-public",
  "ROUTE.PUBLIC.real-cta",
  "ROUTE.PUBLIC.payment-proof",
] as const;

export type ProductPublicRouteOutcomeRequirementId =
  (typeof PRODUCT_PUBLIC_ROUTE_OUTCOME_REQUIREMENT_IDS)[number];

export const PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_REQUIREMENT_IDS = [
  "ROUTE.PUBLIC.auth-loading",
  "ROUTE.PUBLIC.auth-success",
  "ROUTE.PUBLIC.pricing-truth",
  "ROUTE.PUBLIC.a11y",
  "ROUTE.PUBLIC.responsive",
] as const;

export type ProductPublicRouteOutcomeOpenRequirementId =
  (typeof PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS = {
  "ROUTE.PUBLIC.auth-loading":
    "Authentication completes in the /callback Route Handler, which has no page-level loading surface. A truthful visible loading state requires a deliberate two-stage callback design and browser proof rather than an unused loading.tsx file.",
  "ROUTE.PUBLIC.auth-success":
    "The callback source has an onSuccess local-user synchronization hook, but there is no explicit user-visible or Design Lab authentication-success outcome and no authorised live-provider journey proving the eventual return destination.",
  "ROUTE.PUBLIC.pricing-truth":
    "Pricing content is administrator-editable through PlatformSetting while Stripe price identifiers and entitlement limits are server-held elsewhere. No invariant currently reconciles edited display copy, prices and features against the purchasable plan and entitlement policy.",
  "ROUTE.PUBLIC.a11y":
    "Focused source contracts cover selected semantics and touch targets, but there is no exhaustive keyboard, focus, accessible-name and 44-pixel primary-target test across every public route and control.",
  "ROUTE.PUBLIC.responsive":
    "Responsive browser evidence is source-fingerprint-bound and currently stale during this source-changing wave. Source structure alone cannot prove the absence of horizontal overflow at phone, tablet and desktop breakpoints.",
} as const satisfies Readonly<
  Record<ProductPublicRouteOutcomeOpenRequirementId, string>
>;

export const PRODUCT_PUBLIC_ROUTE_OUTCOME_EXPECTED_GAIN =
  PRODUCT_PUBLIC_ROUTE_OUTCOME_REQUIREMENT_IDS.length;

type ProductPublicRouteOutcomeEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_FILE,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductPublicRouteOutcomeEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_PUBLIC_ROUTE_OUTCOME_MASTER_EVIDENCE = {
  "ROUTE.PUBLIC.sign-in": tested(
    "src/app/sign-in/route.ts",
    "src/lib/workos-redirect.ts",
    "src/lib/workos-redirect.test.ts",
  ),
  "ROUTE.PUBLIC.callback": tested(
    "src/app/callback/route.ts",
    "src/lib/auth-callback-route-contract.test.ts",
    "src/lib/signup-acceptance.test.ts",
  ),
  "ROUTE.PUBLIC.recoverable-error": tested(
    "src/app/auth/error/page.tsx",
    "src/lib/auth-callback-recovery.ts",
    "src/lib/auth-callback-recovery.test.ts",
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  ),
  "ROUTE.PUBLIC.maintenance": tested(
    "src/proxy.ts",
    "src/lib/maintenance-mode.ts",
    "src/lib/maintenance-mode.test.ts",
  ),
  "ROUTE.PUBLIC.offline": tested(
    "src/app/layout.tsx",
    "src/components/network-recovery-banner.tsx",
    "src/lib/network-recovery-state.ts",
    "src/lib/network-recovery-state.test.ts",
  ),
  "ROUTE.PUBLIC.legal-public": tested(
    "src/app/privacy/page.tsx",
    "src/app/terms/page.tsx",
    "src/app/responsible-use/page.tsx",
    "src/components/screen-contracts/screen-permission-evidence.test.ts",
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  ),
  "ROUTE.PUBLIC.real-cta": tested(
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/production-screen-coverage.ts",
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
    "src/components/screen-contracts/production-screen-member-support-interactions.test.ts",
    "src/components/screen-contracts/production-screen-commerce-interactions.test.ts",
  ),
  "ROUTE.PUBLIC.payment-proof": tested(
    "src/app/pricing/page.tsx",
    "src/lib/billing/stripe-webhooks.ts",
    "src/lib/billing/stripe-readiness.test.ts",
    "src/lib/billing/stripe-webhook-settlement.test.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductPublicRouteOutcomeRequirementId,
    ProductPublicRouteOutcomeEvidenceRecord
  >
>;
