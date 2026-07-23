import type { DesignLabAccessDecision } from "@/lib/design-lab-access-policy";

import type { FamilyScreenManifest } from "./types";

export const SCREEN_PERMISSION_EVIDENCE_TEST = {
  id: "SCREEN-PERMISSION-EVIDENCE",
  path: "src/components/screen-contracts/screen-permission-evidence.test.ts",
} as const satisfies FamilyScreenManifest["tests"][number];

const TEST_IDS = [SCREEN_PERMISSION_EVIDENCE_TEST.id] as const;

type ScreenPermissionContract = {
  route: string;
  sourcePath: string;
  permissions: FamilyScreenManifest["permissions"];
};

const PUBLIC_SIGNED_OUT_VIEW_PERMISSION = {
  actor: "Signed-out visitor viewing the page",
  decision: "allow",
  enforcedBy:
    "The public page has no required-auth route guard; RootLayout and getCurrentUser treat a missing session as optional identity and withhold only private conversation data.",
  testIds: TEST_IDS,
} as const satisfies FamilyScreenManifest["permissions"][number];

const SUPPORT_TICKET_SIGNED_OUT_PERMISSION = {
  actor: "Signed-out visitor submitting a support ticket",
  decision: "deny",
  enforcedBy:
    "createSupportTicket awaits requireCurrentUserProfile before rate limiting or database writes, so auth.unauthorized exits before either protected effect.",
  testIds: TEST_IDS,
} as const satisfies FamilyScreenManifest["permissions"][number];

const CHECKOUT_SIGNED_OUT_PERMISSION = {
  actor: "Signed-out visitor starting checkout",
  decision: "deny",
  enforcedBy:
    "POST /api/billing/checkout catches auth.unauthorized and returns a 303 sign-in redirect before rate limiting or Stripe session creation.",
  testIds: TEST_IDS,
} as const satisfies FamilyScreenManifest["permissions"][number];

export const PUBLIC_SCREEN_PERMISSION_CONTRACTS = [
  {
    route: "/",
    sourcePath: "src/app/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/about",
    sourcePath: "src/app/about/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/auth/error",
    sourcePath: "src/app/auth/error/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/contact",
    sourcePath: "src/app/contact/page.tsx",
    permissions: [
      PUBLIC_SIGNED_OUT_VIEW_PERMISSION,
      SUPPORT_TICKET_SIGNED_OUT_PERMISSION,
    ],
  },
  {
    route: "/pricing",
    sourcePath: "src/app/pricing/page.tsx",
    permissions: [
      PUBLIC_SIGNED_OUT_VIEW_PERMISSION,
      CHECKOUT_SIGNED_OUT_PERMISSION,
    ],
  },
  {
    route: "/advertise",
    sourcePath: "src/app/advertise/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/advertise/policy",
    sourcePath: "src/app/advertise/policy/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/privacy",
    sourcePath: "src/app/privacy/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/responsible-use",
    sourcePath: "src/app/responsible-use/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/terms",
    sourcePath: "src/app/terms/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/breeding",
    sourcePath: "src/app/breeding/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/breeding/cross",
    sourcePath: "src/app/breeding/cross/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/breeding/dams/[id]",
    sourcePath: "src/app/breeding/dams/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/breeding/sires/[id]",
    sourcePath: "src/app/breeding/sires/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/vets",
    sourcePath: "src/app/vets/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/dogs",
    sourcePath: "src/app/dogs/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/dogs/[id]",
    sourcePath: "src/app/dogs/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/races",
    sourcePath: "src/app/races/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/races/[id]",
    sourcePath: "src/app/races/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/meetings/[id]",
    sourcePath: "src/app/meetings/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/results",
    sourcePath: "src/app/results/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/statistics",
    sourcePath: "src/app/statistics/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/tracks",
    sourcePath: "src/app/tracks/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/tracks/[id]",
    sourcePath: "src/app/tracks/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/discover",
    sourcePath: "src/app/discover/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/feed",
    sourcePath: "src/app/feed/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/forum",
    sourcePath: "src/app/forum/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/forum/[slug]",
    sourcePath: "src/app/forum/[slug]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/forum/threads/[id]",
    sourcePath: "src/app/forum/threads/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/groups",
    sourcePath: "src/app/groups/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/groups/[slug]",
    sourcePath: "src/app/groups/[slug]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/groups/threads/[id]",
    sourcePath: "src/app/groups/threads/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/p/[handle]",
    sourcePath: "src/app/p/[handle]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/listings",
    sourcePath: "src/app/listings/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/listings/[id]",
    sourcePath: "src/app/listings/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/listings/new",
    sourcePath: "src/app/listings/new/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/marketplace",
    sourcePath: "src/app/marketplace/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/marketplace/[id]",
    sourcePath: "src/app/marketplace/[id]/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
  {
    route: "/marketplace/new",
    sourcePath: "src/app/marketplace/new/page.tsx",
    permissions: [PUBLIC_SIGNED_OUT_VIEW_PERMISSION],
  },
] as const satisfies readonly ScreenPermissionContract[];

export const PUBLIC_SIGNED_OUT_MUTATION_DENIAL_CONTRACTS = [
  {
    route: "/contact",
    permissionActor: SUPPORT_TICKET_SIGNED_OUT_PERMISSION.actor,
    sourcePath: "src/app/actions.ts",
    exportedFunction: "createSupportTicket",
    authenticationCall: "requireCurrentUserProfile()",
    protectedEffects: ["checkRateLimit(", "withDbRequestContext("] as const,
    denialMode: "throw-before-effects",
  },
  {
    route: "/pricing",
    permissionActor: CHECKOUT_SIGNED_OUT_PERMISSION.actor,
    sourcePath: "src/app/api/billing/checkout/route.ts",
    exportedFunction: "POST",
    authenticationCall: "requireCurrentUserProfile()",
    protectedEffects: ["checkRateLimit(", "createStripeCheckoutSession("] as const,
    denialMode: "redirect-before-effects",
    denialSignal: 'err.message === "auth.unauthorized"',
    denialExit: "return NextResponse.redirect(signInUrl, 303);",
  },
] as const;

const DESIGN_LAB_PERMISSIONS = [
  {
    actor: "Caller outside production",
    decision: "allow",
    enforcedBy:
      "resolveDesignLabAccessDecision returns allow-local before feature-flag or administrator checks when NODE_ENV is not production.",
    testIds: TEST_IDS,
  },
  {
    actor: "Production caller without the exact preview flag",
    decision: "deny",
    enforcedBy:
      'resolveDesignLabAccessDecision requires ENABLE_DEVICE_PREVIEWS to equal the exact string "true", and requireDesignLabReviewer maps deny to notFound.',
    testIds: TEST_IDS,
  },
  {
    actor: "Caller in the isolated full-access demo",
    decision: "allow",
    enforcedBy:
      "With the exact production preview flag enabled, resolveDesignLabAccessDecision returns allow-isolated-demo before the administrator check.",
    testIds: TEST_IDS,
  },
  {
    actor: "Production administrator with the exact preview flag",
    decision: "allow",
    enforcedBy:
      "requireDesignLabReviewer delegates the production role check to requireAdminProfile, whose role predicate accepts only admin.",
    testIds: TEST_IDS,
  },
  {
    actor: "Production non-administrator with the exact preview flag",
    decision: "deny",
    enforcedBy:
      "requireAdminProfile rejects every non-admin role, and requireDesignLabReviewer maps that rejection to notFound.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

export const DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS = [
  {
    route: "/design-lab",
    sourcePath: "src/app/design-lab/page.tsx",
    permissions: DESIGN_LAB_PERMISSIONS,
  },
  {
    route: "/design-lab/demo-experience",
    sourcePath: "src/app/design-lab/demo-experience/page.tsx",
    permissions: DESIGN_LAB_PERMISSIONS,
  },
  {
    route: "/design-lab/dock-skins",
    sourcePath: "src/app/design-lab/dock-skins/page.tsx",
    permissions: DESIGN_LAB_PERMISSIONS,
  },
  {
    route: "/design-lab/role-blueprints",
    sourcePath: "src/app/design-lab/role-blueprints/page.tsx",
    permissions: DESIGN_LAB_PERMISSIONS,
  },
  {
    route: "/feed/device-preview",
    sourcePath: "src/app/feed/device-preview/page.tsx",
    permissions: DESIGN_LAB_PERMISSIONS,
  },
  {
    route: "/marketplace/design-lab",
    sourcePath: "src/app/marketplace/design-lab/page.tsx",
    permissions: DESIGN_LAB_PERMISSIONS,
  },
] as const satisfies readonly ScreenPermissionContract[];

type DesignLabAccessScenario = {
  id: string;
  nodeEnv: string | undefined;
  enabled: string | undefined;
  isolatedDemo: boolean;
  actorRole: string | null;
  policyDecision: DesignLabAccessDecision;
  finalDecision: "allow" | "deny";
};

export const DESIGN_LAB_ACCESS_SCENARIOS = [
  {
    id: "non-production-signed-out",
    nodeEnv: "development",
    enabled: undefined,
    isolatedDemo: false,
    actorRole: null,
    policyDecision: "allow-local",
    finalDecision: "allow",
  },
  {
    id: "production-flag-missing-admin",
    nodeEnv: "production",
    enabled: undefined,
    isolatedDemo: false,
    actorRole: "admin",
    policyDecision: "deny",
    finalDecision: "deny",
  },
  {
    id: "production-flag-not-exact-admin",
    nodeEnv: "production",
    enabled: "TRUE",
    isolatedDemo: false,
    actorRole: "admin",
    policyDecision: "deny",
    finalDecision: "deny",
  },
  {
    id: "production-isolated-demo-flag-missing",
    nodeEnv: "production",
    enabled: undefined,
    isolatedDemo: true,
    actorRole: null,
    policyDecision: "deny",
    finalDecision: "deny",
  },
  {
    id: "production-isolated-demo-flag-enabled",
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: true,
    actorRole: null,
    policyDecision: "allow-isolated-demo",
    finalDecision: "allow",
  },
  {
    id: "production-admin-flag-enabled",
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: false,
    actorRole: "admin",
    policyDecision: "require-administrator",
    finalDecision: "allow",
  },
  {
    id: "production-moderator-flag-enabled",
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: false,
    actorRole: "moderator",
    policyDecision: "require-administrator",
    finalDecision: "deny",
  },
  {
    id: "production-member-flag-enabled",
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: false,
    actorRole: "member",
    policyDecision: "require-administrator",
    finalDecision: "deny",
  },
  {
    id: "production-reviewer-label-flag-enabled",
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: false,
    actorRole: "reviewer",
    policyDecision: "require-administrator",
    finalDecision: "deny",
  },
  {
    id: "production-signed-out-flag-enabled",
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: false,
    actorRole: null,
    policyDecision: "require-administrator",
    finalDecision: "deny",
  },
] as const satisfies readonly DesignLabAccessScenario[];
