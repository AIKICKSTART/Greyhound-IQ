export const FRONTEND_AUTHORIZATION_GUARDS = [
  "requireCurrentUserProfile",
  "requireModeratorProfile",
  "requireAdminProfile",
  // Session + tier gate for Pro-plan API routes; returns null for anonymous
  // and under-tier users so handlers fail closed with 403 tier.pro_required.
  "requireProUser",
] as const;

export const FRONTEND_AUTHORIZATION_EVIDENCE_SCOPE =
  "Source-exhaustive frontend-independence proof for the current HTTP handlers, server actions, privileged pages, entitlement reads and hidden inputs. Deployed signed-out, cross-user and cross-tenant request matrices remain separate endpoint-test release gates.";

export const FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS = {
  "src/app/api/media/[id]/caption/route.ts": "captionRequestContext",
} as const;

export const FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS = {
  "src/components/site-header.tsx#signOutAction":
    "Provider sign-out accepts no browser input and removes authority instead of granting it.",
} as const;

export const FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES = [
  {
    capability: "agent execution",
    entrypoints: [
      "POST /api/agents/[type]/run",
      "src/app/actions.ts#createAgentRun",
    ],
    service: "runAgentForCurrentUser",
    serviceGuard: "assertAgentTier(current, agentType)",
  },
  {
    capability: "feed publishing",
    entrypoints: ["POST /api/feed", "src/app/actions.ts#createFeedPost"],
    service: "createFeedPostForCurrentUser",
    serviceGuard: "current.dbUserId",
  },
  {
    capability: "marketplace listing edit page",
    entrypoints: [
      "/marketplace/[id]/edit",
      "/listings/[id]/edit",
    ],
    service: "getOwnedListingForCurrentUser",
    serviceGuard: "current.profileId",
  },
] as const;

export const FRONTEND_AUTHORIZATION_HIDDEN_FIELD_REUSABLE_COMPONENTS = [
  "src/app/admin/form-controls.tsx",
  "src/components/media-attachment-fields.tsx",
  "src/components/media-focal-point-editor.tsx",
  "src/components/prototype-member-chrome.tsx",
  "src/components/recipient-picker.tsx",
  "src/components/site-header.tsx",
] as const;

const FRONTEND_AUTHORIZATION_EVIDENCE = [
  "security/frontend-authorization-evidence.ts",
  "security/frontend-authorization-evidence.test.ts",
  "security/endpoints.ts",
  "src/lib/auth.ts",
  "src/lib/tier-access.ts",
  "src/lib/billing/entitlement-service.ts",
  "src/lib/agent-service.ts",
  "src/lib/feed-service.ts",
  "src/lib/listing-service.ts",
  "src/app/actions.ts",
  "src/app/admin/mutations.ts",
  "src/app/admin/admin-authorization-inventory.ts",
  "src/app/admin/admin-authorization-inventory.test.ts",
  "src/app/admin/admin-input-contract.ts",
  "src/app/admin/admin-input-contract.test.ts",
  "src/app/api/agents/[type]/run/route.ts",
  "src/app/api/feed/route.ts",
  "src/app/listings/[id]/edit/page.tsx",
  "src/app/marketplace/[id]/edit/page.tsx",
] as const;

export const FRONTEND_AUTHORIZATION_MASTER_EVIDENCE = Object.fromEntries(
  [
    "security.frontend-authorization.server-denial",
    "security.frontend-authorization.direct-api",
    "security.frontend-authorization.alternate-routes",
    "security.frontend-authorization.stale-entitlement",
    "security.frontend-authorization.browser-state",
    "security.frontend-authorization.hidden-fields",
  ].map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: FRONTEND_AUTHORIZATION_EVIDENCE },
  ]),
);
