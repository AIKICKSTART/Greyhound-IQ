import {
  MANDATORY_PUBLIC_RACING_TRACE_BINDINGS,
  MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE,
} from "./mandatory-public-racing-trace-evidence";
import { MANDATORY_LISTING_DRAFT_TRACE_MASTER_EVIDENCE } from "./mandatory-listing-draft-trace-evidence";

const API_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "security/endpoints.ts",
  "security/registry.test.ts",
  "security/api-surface-inventory.ts",
  "security/api-surface-inventory.test.ts",
] as const;

const ADMIN_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "src/app/admin/admin-authorization-inventory.ts",
  "src/app/admin/admin-authorization-inventory.test.ts",
] as const;

const TRACE_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "security/traces.ts",
  "security/registry.test.ts",
] as const;

const ACTION_TRACE_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "security/action-trace-records.ts",
  "security/primary-trace-chain.ts",
] as const;

const SOURCE_STATIC_TRACE_RESIDUAL =
  "This source-static trace does not prove deployed routing, runtime authorization, database effects, provider behavior, or production audit delivery.";

type ActionTraceCoverage = {
  sourceFile: string;
  sourceMarkers: readonly string[];
  residual: string;
};

/**
 * Current source-backed action paths. These records deliberately verify only
 * the route/action-to-source trace; runtime and deployment evidence stays
 * outside this mapping.
 */
export const MANDATORY_ACTION_TRACE_COVERAGE = {
  "security.trace.11.feed-create": routeTrace("src/app/api/feed/route.ts", [
    "export async function POST",
    "requireCurrentUserProfile",
  ]),
  "security.trace.12.feed-edit": routeTrace(
    "src/app/api/feed/[postId]/route.ts",
    ["export async function PATCH", "requireCurrentUserProfile"],
  ),
  "security.trace.13.feed-delete": routeTrace(
    "src/app/api/feed/[postId]/route.ts",
    ["export async function DELETE", "requireCurrentUserProfile"],
  ),
  "security.trace.14.add-comment": routeTrace(
    "src/app/api/feed/[postId]/comments/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.15.react": routeTrace(
    "src/app/api/feed/[postId]/reaction/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.16.save": routeTrace(
    "src/app/api/feed/[postId]/save/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.18.private-thread-open": routeTrace(
    "src/app/api/conversations/[id]/route.ts",
    ["export async function GET", "requireCurrentUserProfile"],
  ),
  "security.trace.19.conversation-start": routeTrace(
    "src/app/api/conversations/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.20.send-text": routeTrace(
    "src/app/api/conversations/[id]/messages/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.22.voice-video-start": routeTrace(
    "src/app/api/calls/rooms/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.23.marketplace-search": routeTrace(
    "src/app/api/listings/route.ts",
    ["export async function GET", "listingApiQuerySchema.parse", "q: query.q"],
  ),
  "security.trace.24.marketplace-open": routeTrace(
    "src/app/api/listings/[id]/route.ts",
    ["export async function GET", "getPublicListingById"],
  ),
  "security.trace.25.marketplace-save": routeTrace(
    "src/app/api/listings/[id]/save/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.26.marketplace-enquire": routeTrace(
    "src/app/api/listings/[id]/enquiry/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.27.listing-draft-create": routeTrace(
    "src/app/actions.ts",
    [
      "export async function createListing",
      'submissionIntent: field(formData, "submissionIntent")',
      "createListingForCurrentUser(current",
    ],
  ),
  "security.trace.32.profile-update": routeTrace(
    "src/app/api/users/me/profile/route.ts",
    ["export async function PATCH", "requireCurrentUserProfile"],
  ),
  "security.trace.33.privacy-change": routeTrace(
    "src/app/api/users/me/marketing-preferences/route.ts",
    ["export async function POST", "marketing_preference.update"],
  ),
  "security.trace.36.invitation-accept": routeTrace(
    "src/app/account/team/actions.ts",
    [
      "export async function decideTeamInvitationAction",
      "acceptOrganizationTeamInvitation",
    ],
  ),
  "security.trace.39.billing-checkout": routeTrace(
    "src/app/api/billing/checkout/route.ts",
    ["export async function POST", "requireCurrentUserProfile"],
  ),
  "security.trace.41.checkout-return": routeTrace(
    "src/app/account/billing/page.tsx",
    [
      "Returned from Stripe Checkout",
      "only changes after the signed Stripe webhook",
    ],
  ),
  "security.trace.42.invoice-view": routeTrace(
    "src/app/account/billing/page.tsx",
    ["tx.invoiceRecord.findMany", "where: invoiceWhere"],
  ),
  "security.trace.45.moderator-allowed-report": routeTrace(
    "src/app/api/reports/[id]/resolve/route.ts",
    ["export async function POST", "requireModeratorProfile"],
  ),
  "security.trace.46.moderator-admin-only-attempt": routeTrace(
    "src/app/admin/admin-authorization-inventory.ts",
    ["runtimeDenial", 'page("/admin", "admin")'],
  ),
  "security.trace.47.admin-user-status-change": routeTrace(
    "src/app/admin/mutations.ts",
    ["export async function updateAdminStatus", "requireAdminProfile"],
  ),
  "security.trace.49.ai-run-start": routeTrace(
    "src/app/api/agents/[type]/run/route.ts",
    ["runAgentForCurrentUser", "requireCurrentUserProfile"],
  ),
  "security.trace.50.ai-protected-mutation-attempt": routeTrace(
    "security/ai-authorization-evidence.test.ts",
    ['tool.name]("', "future model-driven tool dispatcher"],
  ),
  "security.trace.53.design-lab-simulated-destructive-action": routeTrace(
    "src/components/screen-contracts/design-lab-user-stories.ts",
    [
      "DL.ACTION.SCENARIO.DESTRUCTIVE.SIMULATE",
      "never changes production state",
    ],
  ),
  "security.trace.55.blocked-user-protected-access": routeTrace(
    "src/lib/conversation-service.ts",
    ["assertNotBlocked", "conversation.blocked"],
  ),
} as const satisfies Readonly<Record<string, ActionTraceCoverage>>;

/** Missing source actions are retained as release-blocking product gaps. */
export const MANDATORY_ACTION_TRACE_OPEN_GAPS = {
  "security.trace.17.group-join":
    "No production group-membership model, join mutation, authorization boundary, or bound join control exists.",
  "security.trace.29.listing-publish":
    "Publishing is a moderator approval transition, not a seller-owned publish operation, so the requested seller trace is absent.",
  "security.trace.34.security-change":
    "Local account security surfaces delegate identity and access changes to WorkOS and expose no GreyhoundIQ security-setting mutation.",
  "security.trace.48.admin-webhook-reprocess":
    "The admin surface can update webhook status but has no dedicated, idempotent webhook-reprocess operation.",
} as const;

const REGISTRY_GOVERNANCE_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "security/traces.ts",
  "security/endpoints.ts",
  "security/policies.ts",
  "security/audit-events.ts",
  "security/data-classification.ts",
  "security/database-operations.ts",
  "security/rate-limits.ts",
  "security/third-parties.ts",
  "security/final-traceability.ts",
  "security/final-traceability.test.ts",
  "scripts/generate-security-trace-registry.ts",
  "docs/security/security-trace-registry.md",
  "package.json",
] as const;

export const MANDATORY_TRACE_BINDINGS = {
  ...MANDATORY_PUBLIC_RACING_TRACE_BINDINGS,
  "security.trace.04.auth-callback-session": "AUTH.CALLBACK.COMPLETE",
  "security.trace.40.payment-webhook": "BILLING.WEBHOOK.PROCESS",
  "security.trace.43.data-export-request": "ACCOUNT.DATA_EXPORT.DOWNLOAD",
  "security.trace.44.account-deletion-request": "ACCOUNT.DELETION.EXECUTE",
  "security.trace.51.background-queued-event": "AUTH.CALLBACK.COMPLETE",
  "security.trace.52.design-lab-privileged-render": "DESIGN_LAB.SCREEN.REVIEW",
  "security.trace.54.private-file-download": "ACCOUNT.DATA_EXPORT.DOWNLOAD",
} as const;

/**
 * Narrow source-static and registry-link evidence. Deployed endpoint parity,
 * runtime authorization, and complete trace coverage remain separate gates.
 */
export const API_TRACE_GOVERNANCE_MASTER_EVIDENCE = {
  ...MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE,
  ...Object.fromEntries(
    Object.entries(MANDATORY_ACTION_TRACE_COVERAGE).map(([id, coverage]) => [
      id,
      {
        status: "verified" as const,
        evidence: [...ACTION_TRACE_EVIDENCE, coverage.sourceFile],
      },
    ]),
  ),
  ...MANDATORY_LISTING_DRAFT_TRACE_MASTER_EVIDENCE,
  "security.api-inventory-management.all-apis": {
    status: "verified",
    evidence: API_EVIDENCE,
  },
  "security.api-inventory-management.debug-not-public": {
    status: "not-applicable-with-justification",
    evidence: API_EVIDENCE,
    notApplicableJustification:
      "The exhaustive source inventory contains no debug or diagnostics endpoint.",
  },
  "security.api-inventory-management.obsolete-disabled": {
    status: "not-applicable-with-justification",
    evidence: API_EVIDENCE,
    notApplicableJustification:
      "Every source-inventoried endpoint is unversioned and no /api/vN route exists.",
  },
  "security.api-inventory-management.metrics-restricted": {
    status: "not-applicable-with-justification",
    evidence: API_EVIDENCE,
    notApplicableJustification:
      "The exhaustive source inventory contains no metrics endpoint.",
  },
  "security.api-inventory-management.admin-separation": {
    status: "verified",
    evidence: ADMIN_EVIDENCE,
  },
  "security.trace-identifier.format": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace-identifier.database-map": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "security/database-operations.ts",
    ],
  },
  "security.trace-identifier.audit-registry": {
    status: "verified",
    evidence: [...TRACE_EVIDENCE, "security/audit-events.ts"],
  },
  "security.trace-identifier.coverage": {
    status: "verified",
    evidence: [
      "security/api-trace-governance-evidence.ts",
      "security/api-trace-governance-evidence.test.ts",
      "security/traces.ts",
      "security/final-traceability.ts",
      "security/final-traceability.test.ts",
      "docs/security/security-trace-registry.md",
    ],
  },
  "security.trace-identifier-example.auth-callback-complete": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace-identifier-example.billing-webhook": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.security-trace-contract.single-authority": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "security/final-traceability.ts",
      "security/final-traceability.test.ts",
    ],
  },
  "security.registry-governance.adapt-paths": {
    status: "verified",
    evidence: REGISTRY_GOVERNANCE_EVIDENCE,
  },
  "security.registry-governance.single-authority": {
    status: "verified",
    evidence: REGISTRY_GOVERNANCE_EVIDENCE,
  },
  "security.registry-governance.generated-docs": {
    status: "verified",
    evidence: REGISTRY_GOVERNANCE_EVIDENCE,
  },
  "security.trace.04.auth-callback-session": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.40.payment-webhook": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.43.data-export-request": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.44.account-deletion-request": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.51.background-queued-event": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "src/lib/signup-acceptance-worker.ts",
      "src/lib/signup-acceptance-worker-store.ts",
      "src/lib/signup-acceptance-worker.test.ts",
    ],
  },
  "security.trace.52.design-lab-privileged-render": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.54.private-file-download": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "src/app/api/users/me/export/route.ts",
      "src/app/api/users/me/export/route.test.ts",
      "src/lib/user-export-policy.test.ts",
    ],
  },
} as const;

function routeTrace(
  sourceFile: string,
  sourceMarkers: readonly string[],
): ActionTraceCoverage {
  return { sourceFile, sourceMarkers, residual: SOURCE_STATIC_TRACE_RESIDUAL };
}
