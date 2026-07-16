import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_FILE =
  "src/components/product-onboarding-capability-evidence.ts" as const;
export const PRODUCT_ONBOARDING_CAPABILITY_TEST_FILE =
  "src/components/product-onboarding-capability-evidence.test.ts" as const;

export const PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE =
  "Deterministic source and focused-unit verification of GreyhoundIQ's current onboarding implementation: 87 canonical route tours plus ten redirect exclusions, five-step contextual registries, a trainer path resolved from the real trainer profile role, a support-operator path constrained to existing moderator/administrator support-route authorization, browser-local progress isolated by profile, product area, server-resolved role, subscription tier, tour, version and route with legacy-key migration, audience fail-closed resolution, semantic targets with visible fallback, mutation-driven delayed-target attachment and one-shot allowlisted non-mutating tab/dialog reveal, persisted help-focus intent selection, support-form field guidance with a safe inline example and actionable empty history, step skipping, profile-scoped device reset, timestamped recently completed tour history, searchable help topics, role-filtered available-tour links, support navigation, eight explicit device-width policies, opposite-side mobile target clearance, non-modal navigation access, Visual Viewport keyboard bounds, keyboard/screen-reader exits and deterministic contrast measurement against the actual onboarding tokens and opaque control states. It also proves a 16,720-state base Design Lab preview matrix plus 1,040 explicit trainer/support-operator preview states and nine consent-gated analytics events through a same-origin, strict allowlist, 512-byte, fail-closed rate-limited sink that accepts no identity, route, role, tier or free-form value. These storage and preview dimensions organise guidance only and never grant access. It does not prove the final deployed candidate, cross-device persistence, exhaustive field guidance across every product form, deployed analytics gateway/log retention, or the final rendered device and assistive-technology browser recapture.";

export const PRODUCT_ONBOARDING_SURFACE_REQUIREMENT_IDS = [
  "ONBOARD.SURFACE.global-welcome",
  "ONBOARD.SURFACE.intent-selection",
  "ONBOARD.SURFACE.product-area-tours",
  "ONBOARD.SURFACE.page-walkthroughs",
  "ONBOARD.SURFACE.section-explanations",
  "ONBOARD.SURFACE.help-icons",
  "ONBOARD.SURFACE.permission-tier-explanations",
  "ONBOARD.SURFACE.what-can-i-do",
  "ONBOARD.SURFACE.why-unavailable",
  "ONBOARD.SURFACE.progressive-not-generic",
] as const;

export const PRODUCT_ONBOARDING_BEHAVIOUR_REQUIREMENT_IDS = [
  "ONBOARD.BEHAVIOUR.start",
  "ONBOARD.BEHAVIOUR.next",
  "ONBOARD.BEHAVIOUR.back",
  "ONBOARD.BEHAVIOUR.skip-tour",
  "ONBOARD.BEHAVIOUR.dismiss",
  "ONBOARD.BEHAVIOUR.resume",
  "ONBOARD.BEHAVIOUR.restart",
  "ONBOARD.BEHAVIOUR.complete",
  "ONBOARD.BEHAVIOUR.do-not-show",
  "ONBOARD.BEHAVIOUR.manual-help",
] as const;

export const PRODUCT_ONBOARDING_HELP_CENTRE_REQUIREMENT_IDS = [
  "ONBOARD.BEHAVIOUR.skip-step",
  "ONBOARD.BEHAVIOUR.reset-all",
  "ONBOARD.BEHAVIOUR.search-help",
  "ONBOARD.BEHAVIOUR.support-docs",
  "ONBOARD.MANAGE.available-tours",
  "ONBOARD.MANAGE.reset",
  "ONBOARD.MANAGE.search",
  "ONBOARD.MANAGE.support",
] as const;

export const PRODUCT_ONBOARDING_PERSISTENCE_REQUIREMENT_IDS = [
  "ONBOARD.PERSIST.user",
  "ONBOARD.PERSIST.anonymous-session",
  "ONBOARD.PERSIST.tour-id",
  "ONBOARD.PERSIST.tour-version",
  "ONBOARD.PERSIST.route",
  "ONBOARD.PERSIST.product-area",
  "ONBOARD.PERSIST.role",
  "ONBOARD.PERSIST.tier",
  "ONBOARD.PERSIST.completion",
  "ONBOARD.PERSIST.version-bump",
] as const;

export const PRODUCT_ONBOARDING_HISTORY_REQUIREMENT_IDS = [
  "ONBOARD.MANAGE.completed",
] as const;

export const PRODUCT_ONBOARDING_MANAGEMENT_PREVIEW_REQUIREMENT_IDS = [
  "ONBOARD.MANAGE.design-lab-previews",
] as const;

export const PRODUCT_ONBOARDING_GUIDANCE_REQUIREMENT_IDS = [
  "ONBOARD.SURFACE.field-help",
  "ONBOARD.SURFACE.inline-examples",
  "ONBOARD.SURFACE.empty-guidance",
] as const;

export const PRODUCT_ONBOARDING_ROLE_REQUIREMENT_IDS = [
  "ONBOARD.ROLE.visitor",
  "ONBOARD.ROLE.new-member",
  "ONBOARD.ROLE.racing-user",
  "ONBOARD.ROLE.owner",
  "ONBOARD.ROLE.breeder",
  "ONBOARD.ROLE.buyer",
  "ONBOARD.ROLE.seller",
  "ONBOARD.ROLE.community",
  "ONBOARD.ROLE.page-manager",
  "ONBOARD.ROLE.team-member",
  "ONBOARD.ROLE.moderator",
  "ONBOARD.ROLE.administrator",
  "ONBOARD.ROLE.ai-user",
  "ONBOARD.ROLE.accessible-only",
  "ONBOARD.ROLE.trainer",
  "ONBOARD.ROLE.support",
] as const;

export const PRODUCT_ONBOARDING_ACCESS_REQUIREMENT_IDS = [
  "ONBOARD.ACCESS.why",
  "ONBOARD.ACCESS.authentication",
  "ONBOARD.ACCESS.subscription",
  "ONBOARD.ACCESS.role",
  "ONBOARD.ACCESS.next-action",
  "ONBOARD.ACCESS.no-leak",
] as const;

export const PRODUCT_ONBOARDING_TARGET_REQUIREMENT_IDS = [
  "ONBOARD.TARGET.semantic-identifiers",
  "ONBOARD.TARGET.present",
  "ONBOARD.TARGET.loading",
  "ONBOARD.TARGET.breakpoint-hidden",
  "ONBOARD.TARGET.scroll-container",
  "ONBOARD.TARGET.feature-flag",
  "ONBOARD.TARGET.role",
  "ONBOARD.TARGET.missing-data",
  "ONBOARD.TARGET.route-change",
  "ONBOARD.TARGET.fallback",
  "ONBOARD.TARGET.tab",
  "ONBOARD.TARGET.modal",
] as const;

export const PRODUCT_ONBOARDING_MOBILE_REQUIREMENT_IDS = [
  "ONBOARD.MOBILE.onscreen",
  "ONBOARD.MOBILE.target-visible",
  "ONBOARD.MOBILE.navigation",
  "ONBOARD.MOBILE.overflow",
  "ONBOARD.MOBILE.scrolling",
  "ONBOARD.MOBILE.fixed-navigation",
  "ONBOARD.MOBILE.keyboard",
  "ONBOARD.MOBILE.mobile-pattern",
] as const;

export const PRODUCT_ONBOARDING_DEVICE_REQUIREMENT_IDS = [
  "ONBOARD.DEVICE.small-phone",
  "ONBOARD.DEVICE.large-phone",
  "ONBOARD.DEVICE.foldable",
  "ONBOARD.DEVICE.tablet-portrait",
  "ONBOARD.DEVICE.tablet-landscape",
  "ONBOARD.DEVICE.laptop",
  "ONBOARD.DEVICE.desktop",
  "ONBOARD.DEVICE.wide-desktop",
] as const;

export const PRODUCT_ONBOARDING_ACCESSIBILITY_REQUIREMENT_IDS = [
  "ONBOARD.A11Y.semantics",
  "ONBOARD.A11Y.announcement",
  "ONBOARD.A11Y.keyboard",
  "ONBOARD.A11Y.escape",
  "ONBOARD.A11Y.focus",
  "ONBOARD.A11Y.focus-restoration",
  "ONBOARD.A11Y.screen-reader",
  "ONBOARD.A11Y.reduced-motion",
  "ONBOARD.A11Y.contrast",
  "ONBOARD.A11Y.no-hover-only",
  "ONBOARD.A11Y.no-timeout",
  "ONBOARD.A11Y.touch-target",
  "ONBOARD.A11Y.no-trap",
] as const;

export const PRODUCT_ONBOARDING_ANALYTICS_REQUIREMENT_IDS = [
  "ONBOARD.ANALYTICS.tour-started",
  "ONBOARD.ANALYTICS.step-viewed",
  "ONBOARD.ANALYTICS.step-skipped",
  "ONBOARD.ANALYTICS.tour-dismissed",
  "ONBOARD.ANALYTICS.tour-completed",
  "ONBOARD.ANALYTICS.tour-restarted",
  "ONBOARD.ANALYTICS.help-opened",
  "ONBOARD.ANALYTICS.upgrade-viewed",
  "ONBOARD.ANALYTICS.support-selected",
  "ONBOARD.ANALYTICS.no-sensitive-values",
] as const;

export const PRODUCT_ONBOARDING_ADDITIONAL_REQUIREMENT_IDS = [
  "ONBOARD.MANAGE.restart",
  "OUT.onboarding",
  "DL.ROUTE.every-route",
  "VERIFY.GATE.tour-target",
] as const;

export const PRODUCT_ONBOARDING_CAPABILITY_REQUIREMENT_IDS = [
  ...PRODUCT_ONBOARDING_SURFACE_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_BEHAVIOUR_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_HELP_CENTRE_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_PERSISTENCE_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_HISTORY_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_MANAGEMENT_PREVIEW_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_GUIDANCE_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_ROLE_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_ACCESS_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_TARGET_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_DEVICE_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_MOBILE_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_ACCESSIBILITY_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_ANALYTICS_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_ADDITIONAL_REQUIREMENT_IDS,
] as const;

export type ProductOnboardingCapabilityRequirementId =
  (typeof PRODUCT_ONBOARDING_CAPABILITY_REQUIREMENT_IDS)[number];

export const PRODUCT_ONBOARDING_CAPABILITY_EXPECTED_GAIN =
  PRODUCT_ONBOARDING_CAPABILITY_REQUIREMENT_IDS.length;

export const PRODUCT_ONBOARDING_CAPABILITY_RESIDUAL_GAPS = {
  surfaces:
    "Help-focus selection, field-level guidance, a safe inline example and actionable empty-history guidance are implemented in the support journey; exhaustive guidance across every product form is not claimed.",
  controls:
    "Step skipping, browser-profile reset, help-topic search and support navigation are implemented; cross-device reset and synchronisation remain intentionally outside the browser-local control contract.",
  persistence:
    "Progress is browser-local and explicitly scoped by profile, product area, server-resolved role, subscription tier, tour, version and route; cross-device synchronisation is not claimed.",
  personas:
    "Trainer guidance now resolves only from the existing authenticated trainer profile role. Support-operator guidance resolves only for moderator or administrator identities already authorized to the three support routes; it is a guidance persona and deliberately grants no new identity role or route access.",
  targets:
    "Unavailable and delayed targets remain usable through declared fallback and mutation-driven attachment. Hidden tab and dialog targets may be revealed once only by an exact enabled button-type controller with an allowlisted kind and semantic target token; all other controls fail closed and retain safe fallback guidance.",
  devices:
    "Eight runtime device classes and deterministic popup bounds cover the required phone, foldable, tablet, laptop and desktop widths; final-candidate rendered-browser recapture remains separate evidence.",
  accessibility:
    "The source proves semantics, exits, focus restoration, reduced motion, 44px controls and contrast-safe token/control states; the complete rendered assistive-technology matrix remains open.",
  analytics:
    "Nine onboarding events now use a consent-gated, same-origin, strict categorical schema and a bounded fail-closed sink; deployed gateway metrics, log-sink retention and representative global-counter contention remain separate release evidence.",
  management:
    "Available tours, timestamped recently completed history, reset, search, support navigation, the 16,720-state base role/route/step/device/fallback Design Lab matrix and 1,040 explicit trainer/support-operator states are source-tested; final rendered-device recapture remains separate evidence.",
} as const;

type ProductOnboardingCapabilityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_FILE,
  PRODUCT_ONBOARDING_CAPABILITY_TEST_FILE,
  "docs/product/onboarding-map.md",
] as const;
const REGISTRY_EVIDENCE = [
  "src/components/onboarding-tour-registry.ts",
  "src/components/onboarding-persona.ts",
  "src/components/onboarding-persona.test.ts",
  "src/components/racing-onboarding-tour-registry.ts",
  "src/components/community-onboarding-tour-registry.ts",
  "src/components/public-onboarding-tour-registry.ts",
  "src/components/marketplace-onboarding-tour-registry.ts",
  "src/components/agents-onboarding-tour-registry.ts",
  "src/components/design-lab-onboarding-tour-registry.ts",
  "src/components/demo-experience-registry.ts",
] as const;
const INTERACTION_EVIDENCE = [
  "src/components/interactive-help.tsx",
  "src/components/interactive-help-layout.ts",
  "src/components/interactive-help.module.css",
  "src/components/interactive-help-state.ts",
  "src/components/interactive-help-state.test.ts",
  "src/components/interactive-help-delayed-target.test.ts",
  "src/components/onboarding-target-disclosure.ts",
  "src/components/onboarding-target-disclosure.test.ts",
  "src/components/interactive-help-disclosure-target.test.ts",
  "src/components/interactive-help-responsive.test.ts",
] as const;
const TARGET_EVIDENCE = [
  "src/app/layout.tsx",
  "src/app/account/layout.tsx",
  "src/app/admin/layout.tsx",
  "src/app/admin/admin-nav.tsx",
  "src/app/admin/admin-page-header.tsx",
  "src/components/site-header.tsx",
  "src/components/design-lab-onboarding-disclosure-targets.tsx",
] as const;
const DESIGN_LAB_EVIDENCE = [
  "src/components/design-lab-scenario-contract.ts",
  "src/components/design-lab-scenario-state.ts",
  "src/components/design-lab-scenario-state.test.ts",
  "src/components/design-lab-onboarding-preview.ts",
  "src/components/design-lab-onboarding-preview.test.ts",
  "src/components/design-lab-scenario-controls.tsx",
  "src/components/design-lab-onboarding-disclosure-targets.tsx",
  "src/components/demo-experience-screen-map.tsx",
  "src/components/demo-experience-registry.test.ts",
] as const;
const ANALYTICS_EVIDENCE = [
  "src/components/onboarding-analytics.ts",
  "src/components/onboarding-analytics-client.ts",
  "src/components/onboarding-analytics.test.ts",
  "src/app/api/analytics/onboarding/route.ts",
  "src/app/api/analytics/onboarding/route.test.ts",
  "security/endpoints.ts",
  "security/rate-limits.ts",
  "security/database-operations.ts",
  "security/traces.ts",
  "docs/security/security-trace-registry.md",
  "openapi.json",
] as const;
const HELP_CENTRE_EVIDENCE = [
  "src/components/account-support-help-centre.tsx",
  "src/components/account-support-help-centre.test.ts",
  "src/components/onboarding-help-catalogue.ts",
  "src/components/onboarding-help-catalogue.test.ts",
  "src/app/account/support/page.tsx",
] as const;
const SUPPORT_GUIDANCE_EVIDENCE = [
  "src/app/contact/page.tsx",
  "src/app/account/support/page.tsx",
  "src/components/support-onboarding-surface.test.ts",
] as const;
const CONTRAST_EVIDENCE = [
  "src/app/globals.css",
  "src/components/interactive-help-contrast.test.ts",
] as const;

function testedFor<const T extends readonly ProductOnboardingCapabilityRequirementId[]>(
  ids: T,
  ...evidence: readonly string[]
) {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        status: "tested" as const,
        evidence: [...new Set([...COMMON_EVIDENCE, ...evidence])],
      },
    ]),
  ) as unknown as Record<T[number], ProductOnboardingCapabilityEvidenceRecord>;
}

export const PRODUCT_ONBOARDING_CAPABILITY_MASTER_EVIDENCE = {
  ...testedFor(
    PRODUCT_ONBOARDING_SURFACE_REQUIREMENT_IDS,
    ...REGISTRY_EVIDENCE,
    ...INTERACTION_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_BEHAVIOUR_REQUIREMENT_IDS,
    ...INTERACTION_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_HELP_CENTRE_REQUIREMENT_IDS,
    ...INTERACTION_EVIDENCE,
    ...HELP_CENTRE_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_PERSISTENCE_REQUIREMENT_IDS,
    ...INTERACTION_EVIDENCE,
    "src/app/layout.tsx",
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_HISTORY_REQUIREMENT_IDS,
    ...INTERACTION_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_MANAGEMENT_PREVIEW_REQUIREMENT_IDS,
    ...REGISTRY_EVIDENCE,
    ...INTERACTION_EVIDENCE,
    ...DESIGN_LAB_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_GUIDANCE_REQUIREMENT_IDS,
    ...SUPPORT_GUIDANCE_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_ROLE_REQUIREMENT_IDS,
    ...REGISTRY_EVIDENCE,
    ...TARGET_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_ACCESS_REQUIREMENT_IDS,
    ...REGISTRY_EVIDENCE,
    ...INTERACTION_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_TARGET_REQUIREMENT_IDS,
    ...REGISTRY_EVIDENCE,
    ...INTERACTION_EVIDENCE,
    ...TARGET_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_DEVICE_REQUIREMENT_IDS,
    ...INTERACTION_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_MOBILE_REQUIREMENT_IDS,
    ...INTERACTION_EVIDENCE,
    "src/app/globals.css",
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_ACCESSIBILITY_REQUIREMENT_IDS,
    ...INTERACTION_EVIDENCE,
    ...CONTRAST_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_ANALYTICS_REQUIREMENT_IDS,
    ...REGISTRY_EVIDENCE,
    ...INTERACTION_EVIDENCE,
    ...ANALYTICS_EVIDENCE,
  ),
  ...testedFor(
    PRODUCT_ONBOARDING_ADDITIONAL_REQUIREMENT_IDS,
    ...REGISTRY_EVIDENCE,
    ...INTERACTION_EVIDENCE,
    ...TARGET_EVIDENCE,
    ...DESIGN_LAB_EVIDENCE,
    "src/components/screen-contracts/production-screen-onboarding-exclusions.test.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductOnboardingCapabilityRequirementId,
    ProductOnboardingCapabilityEvidenceRecord
  >
>;
