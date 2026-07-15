import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SYSTEM_RECOVERY_EVIDENCE_FILE =
  "src/components/product-system-recovery-evidence.ts" as const;
export const PRODUCT_SYSTEM_RECOVERY_TEST_FILE =
  "src/components/product-system-recovery-evidence.test.ts" as const;

export const PRODUCT_SYSTEM_RECOVERY_EVIDENCE_SCOPE =
  "Deterministic source and focused-unit verification of four usable system recovery paths: an operator-controlled maintenance response, browser offline/restored guidance, context-specific billing-provider failure recovery, and browser-form rate-limit countdown/retry while JSON API clients retain structured 429 responses. This evidence does not prove a deployed maintenance activation, browser rendering, an actual network outage, a live Stripe failure, production observability, or the seven explicitly retained system-state gaps.";

export const PRODUCT_SYSTEM_RECOVERY_REQUIREMENT_IDS = [
  "SYSTEM.maintenance",
  "SYSTEM.offline",
  "SYSTEM.billing-failure",
  "SYSTEM.rate-limit",
] as const;

export type ProductSystemRecoveryRequirementId =
  (typeof PRODUCT_SYSTEM_RECOVERY_REQUIREMENT_IDS)[number];

export const PRODUCT_SYSTEM_RECOVERY_OPEN_REQUIREMENT_IDS = [
  "SYSTEM.invitation-expired",
  "SYSTEM.invitation-invalid",
  "SYSTEM.unsupported-browser",
  "SYSTEM.auth-callback-loading",
  "SYSTEM.design-lab",
  "SYSTEM.automated-tests",
  "SYSTEM.specific-recovery",
] as const;

export type ProductSystemRecoveryOpenRequirementId =
  (typeof PRODUCT_SYSTEM_RECOVERY_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_SYSTEM_RECOVERY_OPEN_GAPS = {
  "SYSTEM.invitation-expired":
    "OrganizationInvitation currently supports administrator creation, listing, and status changes only. There is no public token-consumption route, recipient email binding, atomic acceptance transaction, expired-token outcome, or recipient recovery action, so an expired invitation experience cannot be claimed.",
  "SYSTEM.invitation-invalid":
    "The repository has no public invitation validation or acceptance surface that can distinguish a malformed, unknown, already-used, revoked, wrong-recipient, or otherwise invalid token without leaking membership data. That secure workflow and its specific user recovery remain implementation work.",
  "SYSTEM.unsupported-browser":
    "No measured compatibility boundary, supported-browser policy, feature-detection matrix, or browser test evidence establishes which browser is genuinely unsupported. Showing a generic warning without a proven boundary would create a false failure state, so this requirement remains open.",
  "SYSTEM.auth-callback-loading":
    "Authentication currently completes in a Next.js Route Handler at /callback. Page loading UI does not wrap Route Handlers, and the callback segment cannot contain both a page and route handler, so a truthful visible loading experience requires a deliberate two-stage callback design rather than an unused loading.tsx file.",
  "SYSTEM.design-lab":
    "This four-state wave adds real production behavior and focused contracts but does not prove that every required system state is represented, interactive, responsive, and current inside Design Lab. Whole-set Design Lab coverage therefore remains a separate gate.",
  "SYSTEM.automated-tests":
    "Focused unit and source-binding contracts cover the four implemented states, but there is no exact whole-system automated matrix exercising every system state through a browser and its required production dependencies. The broader automated-tests requirement remains open.",
  "SYSTEM.specific-recovery":
    "Maintenance, offline, billing failure, and billing rate-limit states now provide specific recovery actions, while invitation, unsupported-browser, auth-callback-loading, and other whole-set outcomes remain unresolved. Specific recovery cannot close until the complete system-state set is proven.",
} as const satisfies Readonly<
  Record<ProductSystemRecoveryOpenRequirementId, string>
>;

export const PRODUCT_SYSTEM_RECOVERY_FOCUSED_CONTRACT_FILES = [
  "src/lib/maintenance-mode.test.ts",
  "src/lib/network-recovery-state.test.ts",
  "src/lib/rate-limit-recovery.test.ts",
  "src/lib/billing/billing-return-recovery.test.ts",
  PRODUCT_SYSTEM_RECOVERY_TEST_FILE,
] as const;

export const PRODUCT_SYSTEM_RECOVERY_EXPECTED_GAIN =
  PRODUCT_SYSTEM_RECOVERY_REQUIREMENT_IDS.length;

export type ProductSystemRecoveryEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_SYSTEM_RECOVERY_EVIDENCE_FILE,
  PRODUCT_SYSTEM_RECOVERY_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductSystemRecoveryEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_SYSTEM_RECOVERY_MASTER_EVIDENCE = {
  "SYSTEM.maintenance": tested(
    "src/proxy.ts",
    "src/lib/maintenance-mode.ts",
    "src/lib/maintenance-mode.test.ts",
    ".env.example",
  ),
  "SYSTEM.offline": tested(
    "src/app/layout.tsx",
    "src/components/network-recovery-banner.tsx",
    "src/lib/network-recovery-state.ts",
    "src/lib/network-recovery-state.test.ts",
  ),
  "SYSTEM.billing-failure": tested(
    "src/app/api/billing/checkout/route.ts",
    "src/app/api/billing/portal/route.ts",
    "src/app/api/billing/bespoke/checkout/route.ts",
    "src/app/pricing/page.tsx",
    "src/app/account/billing/page.tsx",
    "src/app/account/pages/page.tsx",
    "src/lib/billing/billing-return-recovery.ts",
    "src/lib/billing/billing-return-recovery.test.ts",
  ),
  "SYSTEM.rate-limit": tested(
    "src/app/api/billing/checkout/route.ts",
    "src/app/api/billing/portal/route.ts",
    "src/app/api/billing/bespoke/checkout/route.ts",
    "src/app/pricing/page.tsx",
    "src/app/account/billing/page.tsx",
    "src/app/account/pages/page.tsx",
    "src/components/rate-limit-recovery-card.tsx",
    "src/lib/rate-limit-recovery.ts",
    "src/lib/rate-limit-recovery.test.ts",
  ),
} as const satisfies Readonly<
  Record<ProductSystemRecoveryRequirementId, ProductSystemRecoveryEvidenceRecord>
>;
