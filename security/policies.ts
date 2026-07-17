import type { RegistryEvidence, VerificationStatus } from "./shared";

export type SecurityPolicyContract = {
  policyId: string;
  name: string;
  policyType:
    | "authentication"
    | "function"
    | "object"
    | "property"
    | "relationship"
    | "feature"
    | "provider-signature";
  decision: string;
  denyBehaviour: string;
  sourceFiles: string[];
  sourceSymbols: string[];
  tests: string[];
  evidence: RegistryEvidence[];
  owner: string;
  verificationStatus: VerificationStatus;
};

export const SECURITY_POLICIES = [
  {
    policyId: "POLICY.AUTH.CALLBACK.WORKOS",
    name: "WorkOS callback validation",
    policyType: "authentication",
    decision: "Delegate callback state and code validation to AuthKit, then synchronize the local user.",
    denyBehaviour: "Redirect to an allowlisted recovery screen with a safe reason and random reference ID.",
    sourceFiles: ["src/app/callback/route.ts", "src/lib/auth-callback-recovery.ts"],
    sourceSymbols: ["GET", "classifyAuthCallbackFailure"],
    tests: [
      "src/lib/auth-callback-recovery.test.ts",
      "src/lib/auth-callback-route-contract.test.ts",
    ],
    evidence: [
      {
        sourceFile: "src/app/callback/route.ts",
        sourceSymbol: "GET.onError",
        note: "Failure redirects only to /auth/error on the configured application base URL.",
      },
    ],
    owner: "identity-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.WEBHOOK.STRIPE_SIGNATURE",
    name: "Stripe webhook signature",
    policyType: "provider-signature",
    decision: "Accept only an event verified from the raw body and Stripe signature header.",
    denyBehaviour: "Return a generic 401 or 400 response without provider payload details.",
    sourceFiles: [
      "src/app/api/webhooks/stripe/route.ts",
      "src/lib/billing/stripe-webhooks.ts",
    ],
    sourceSymbols: ["POST", "verifyStripeWebhook", "ingestStripeWebhook"],
    tests: ["src/lib/billing/stripe-readiness.test.ts"],
    evidence: [
      {
        sourceFile: "src/app/api/webhooks/stripe/route.ts",
        sourceSymbol: "POST",
        note: "The handler passes raw bytes and headers to the verifier before reduction.",
      },
    ],
    owner: "billing-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    name: "Conversation participant access",
    policyType: "object",
    decision: "The current profile must be participant A or participant B for the selected conversation.",
    denyBehaviour: "Return the same not-found-safe application error used for inaccessible conversations.",
    sourceFiles: ["src/lib/conversation-service.ts"],
    sourceSymbols: ["getConversationForProfile", "setConversationBlock"],
    tests: [],
    evidence: [
      {
        sourceFile: "src/lib/conversation-service.ts",
        sourceSymbol: "getConversationForProfile",
        note: "The Prisma predicate binds the conversation ID and either participant profile ID.",
      },
    ],
    owner: "community-security",
    verificationStatus: "Test coverage missing",
  },
  {
    policyId: "POLICY.MEDIA.UPLOADER",
    name: "Media uploader ownership",
    policyType: "object",
    decision: "The current database user must be the uploader and the media record must not be deleted.",
    denyBehaviour: "Return media.not_found so callers cannot distinguish another user's object.",
    sourceFiles: ["src/lib/media-service.ts"],
    sourceSymbols: ["ownedMediaWhere", "getMediaStatusForCurrentUser", "deleteMediaForCurrentUser"],
    tests: ["src/lib/media-service.test.ts"],
    evidence: [
      {
        sourceFile: "src/lib/media-service.ts",
        sourceSymbol: "ownedMediaWhere",
        note: "The reusable predicate includes id, uploaderId and deletedAt: null.",
      },
    ],
    owner: "media-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.DESIGN_LAB.PRODUCTION_FLAG",
    name: "Design Lab production reviewer gate",
    policyType: "feature",
    decision:
      "In production, require ENABLE_DEVICE_PREVIEWS to be exactly true and require an administrator unless the runtime is the explicitly isolated full-access demo.",
    denyBehaviour: "Render Next.js not found for a disabled flag or an unauthorised production reviewer.",
    sourceFiles: [
      "src/app/design-lab/page.tsx",
      "src/lib/design-lab-access.ts",
      "src/lib/design-lab-access-policy.ts",
    ],
    sourceSymbols: [
      "DesignLabPage",
      "requireDesignLabReviewer",
      "resolveDesignLabAccessDecision",
    ],
    tests: [
      "src/components/design-lab-route-safety.test.ts",
      "src/lib/demo-production-isolation.test.ts",
    ],
    evidence: [
      {
        sourceFile: "src/app/design-lab/page.tsx",
        sourceSymbol: "DesignLabPage",
        note: "Every Design Lab page calls the shared server gate and remains noindex.",
      },
    ],
    owner: "design-lab-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.ADMIN.ROUTE_ROLE_SEPARATION",
    name: "Administrator and moderator route separation",
    policyType: "function",
    decision: "Admin-only navigation entries require the admin role, while declared moderation queues remain available to moderators.",
    denyBehaviour: "Admin-only pages call requireAdminProfile on the server and remain absent from moderator navigation.",
    sourceFiles: [
      "src/app/admin/admin-nav-data.ts",
      "src/app/admin/admin-nav-data.test.ts",
      "src/app/admin/admin-moderator-read-only-contract.test.ts",
    ],
    sourceSymbols: ["ADMIN_NAV", "adminNavForRole", "requireAdminProfile"],
    tests: [
      "src/app/admin/admin-nav-data.test.ts",
      "src/app/admin/admin-moderator-read-only-contract.test.ts",
    ],
    evidence: [
      {
        sourceFile: "src/app/admin/admin-nav-data.test.ts",
        note: "The contract test iterates every declared admin-only route and checks its page source for requireAdminProfile().",
      },
    ],
    owner: "administration-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.ADMIN.LAST_ACTIVE_ADMIN",
    name: "Last active administrator protection",
    policyType: "relationship",
    decision:
      "Serialize access updates and reject a demotion or ban when the target is the final active administrator.",
    denyBehaviour: "Abort the transaction with admin.last_admin_forbidden.",
    sourceFiles: [
      "src/lib/admin-access-contract.ts",
      "src/lib/admin-service.ts",
    ],
    sourceSymbols: [
      "assertLastAdminAccessChange",
      "updateAdminUserAccess",
    ],
    tests: ["src/lib/admin-access-contract.test.ts"],
    evidence: [
      {
        sourceFile: "src/lib/admin-service.ts",
        sourceSymbol: "updateAdminUserAccess",
        note: "A transaction advisory lock serializes the active-admin count and the protected update.",
      },
    ],
    owner: "administration-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.ADMIN.PRIVILEGED_INPUT_ALLOWLISTS",
    name: "Privileged administration input allowlists",
    policyType: "property",
    decision:
      "Accept only registered roles, statuses, billing intervals, currency, severities, priorities and entitlement keys for privileged mutations.",
    denyBehaviour: "Reject the server action input before any service or database mutation.",
    sourceFiles: [
      "src/app/admin/admin-input-contract.ts",
      "src/app/admin/admin-status-contract.ts",
      "src/app/admin/mutations.ts",
    ],
    sourceSymbols: [
      "adminPlanStatusSchema",
      "adminEntitlementKeySchema",
      "assertAdminResourceMutation",
    ],
    tests: [
      "src/app/admin/admin-input-contract.test.ts",
      "src/app/admin/admin-status-contract.test.ts",
    ],
    evidence: [
      {
        sourceFile: "src/app/admin/admin-input-contract.test.ts",
        note: "Unexpected privileged enumeration values and currencies are rejected by the server schemas.",
      },
    ],
    owner: "administration-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.ACCOUNT.DELETION.SELF_REQUEST",
    name: "Self-service account deletion request",
    policyType: "object",
    decision:
      "Resolve the target from the authenticated server session, require the literal DELETE confirmation and serialize last-active-administrator protection before updating the current user.",
    denyBehaviour:
      "Reject invalid confirmation, unauthenticated callers and deletion of the final active administrator before mutating the account.",
    sourceFiles: [
      "src/app/api/users/me/delete/route.ts",
      "src/lib/account-service.ts",
      "src/lib/admin-service.ts",
      "src/lib/admin-access-contract.ts",
    ],
    sourceSymbols: [
      "POST",
      "requestAccountDeletion",
      "lockAdminAccessChanges",
      "assertLastAdminAccessChange",
    ],
    tests: ["src/lib/account-deletion.test.ts"],
    evidence: [
      {
        sourceFile: "src/lib/account-service.ts",
        sourceSymbol: "requestAccountDeletion",
        note: "The mutation uses current.dbUserId only and runs the serialized last-admin guard in the same request transaction.",
      },
    ],
    owner: "privacy-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.ACCOUNT.DELETION.INTERNAL_MAINTENANCE",
    name: "Internal account-deletion maintenance authority",
    policyType: "function",
    decision:
      "Require a timing-safe match against a configured internal secret before processing due deletion candidates under system database context.",
    denyBehaviour:
      "Reject missing configuration or invalid credentials before selecting or mutating account data.",
    sourceFiles: [
      "src/app/api/internal/account-deletion/route.ts",
      "src/lib/internal-auth.ts",
      "src/lib/account-service.ts",
    ],
    sourceSymbols: [
      "POST",
      "requireInternalRequest",
      "runAccountDeletionMaintenance",
    ],
    tests: ["src/lib/account-deletion.test.ts"],
    evidence: [
      {
        sourceFile: "src/app/api/internal/account-deletion/route.ts",
        sourceSymbol: "POST",
        note: "The internal secret check runs before deletion maintenance.",
      },
      {
        sourceFile: "src/lib/account-service.ts",
        sourceSymbol: "runAccountDeletionMaintenance",
        note: "Candidate, storage-job and storage-object batches are bounded in source.",
      },
    ],
    owner: "privacy-security",
    verificationStatus: "Partially verified",
  },
  {
    policyId: "POLICY.ACCOUNT.DATA_EXPORT.SELF",
    name: "Self-service account data export",
    policyType: "object",
    decision:
      "Resolve identity from the server session, query only the current user/profile predicates, return explicit fields and permit only a self-owned completed artifact insert.",
    denyBehaviour:
      "Reject unauthenticated, cross-site, oversized or forbidden-field exports without returning private data and mark every response private/no-store.",
    sourceFiles: [
      "src/app/api/users/me/export/route.ts",
      "src/lib/user-export-policy.ts",
      "prisma/migrations/20260713173000_allow_owned_user_export_artifacts/migration.sql",
    ],
    sourceSymbols: [
      "GET",
      "assertUserExportCollections",
      "assertUserExportDto",
      "assertUserExportSize",
      "giq_export_artifact_owner_insert",
    ],
    tests: [
      "src/lib/user-export-policy.test.ts",
      "scripts/check-rls-policies.ts",
    ],
    evidence: [
      {
        sourceFile: "src/lib/user-export-policy.test.ts",
        note: "Collection, byte, forbidden-field and no-store policy helpers have regression assertions.",
      },
      {
        sourceFile:
          "prisma/migrations/20260713173000_allow_owned_user_export_artifacts/migration.sql",
        sourceSymbol: "giq_export_artifact_owner_insert",
        note: "The member policy is INSERT-only and binds targetUserId and requestedByUserId to the database request identity.",
      },
    ],
    owner: "privacy-security",
    verificationStatus: "Partially verified",
  },
] as const satisfies readonly SecurityPolicyContract[];
