export const AUTHENTICATION_PATH_REVIEW_STATUSES = [
  "partially-verified",
  "not-verified",
  "control-missing",
] as const;

type AuthenticationPathReviewStatus =
  (typeof AUTHENTICATION_PATH_REVIEW_STATUSES)[number];

type AuthenticationPathSeed = readonly [
  slug: string,
  path: string,
  implementation: string,
  authority: string,
  status: AuthenticationPathReviewStatus,
  currentFinding: string,
  requiredValidation: string,
];

const AUTHENTICATION_PATH_SEEDS = [
  ["sign-in", "Sign in", "Hosted WorkOS AuthKit sign-in route", "WorkOS tenant plus application return-path policy", "partially-verified", "The application starts the hosted flow and allowlists internal returns; live tenant policy and attack controls are not verified.", "Staging sign-in, generic failure, MFA and unsafe-return tests."],
  ["sign-out", "Sign out", "Server action delegates to AuthKit signOut", "WorkOS server session invalidation", "partially-verified", "Source delegation exists; live session and refresh-token invalidation were not observed.", "Staging old-cookie/token rejection and multi-session tests."],
  ["account-creation", "New-account creation", "Authentication callback synchronizes the WorkOS subject into local User/Profile records", "Verified provider subject plus server-side local synchronization", "partially-verified", "Local synchronization is traced, while provider verification and duplicate/concurrent signup behavior need runtime evidence.", "Verified/unverified email, duplicate callback and concurrent signup tests."],
  ["callback", "Authentication callback", "AuthKit handleAuth followed by local user synchronization and safe recovery redirect", "Provider callback validation plus local allowlisted return resolution", "partially-verified", "Callback source and safe error handling are tested; live state/code replay behavior remains provider-dependent.", "Staging state, replay, issuer/audience and local transaction failure tests."],
  ["email-verification", "Email verification", "Hosted identity-provider verification state consumed during local synchronization", "WorkOS verified identity claims", "not-verified", "The repository distinguishes explicitly unverified email, but tenant verification policy and transition events are not captured.", "Provider configuration and verified/unverified transition tests."],
  ["password-reset", "Password reset", "Provider-hosted recovery where password authentication is enabled", "WorkOS recovery policy", "not-verified", "No local password-reset token handler exists; provider configuration, expiry and session revocation are unverified.", "Confirm applicable provider mode and test expiry, single use, enumeration and session invalidation."],
  ["passwordless", "Passwordless login", "Provider-hosted method if enabled", "WorkOS tenant authentication policy", "not-verified", "Repository code does not prove whether passwordless login is enabled or how challenges expire.", "Capture tenant method configuration and replay/expiry tests, or justify not applicable."],
  ["oauth-oidc", "OAuth or OIDC login", "WorkOS AuthKit hosted authorization flow", "Provider state, nonce, PKCE and issuer/audience validation", "partially-verified", "The application delegates protocol validation; running tenant/client settings are not verified.", "Staging state, nonce, PKCE, issuer, audience and code-reuse tests."],
  ["account-linking", "Account linking", "Local synchronization links a WorkOS subject to local identity records", "Provider subject and explicit verified identity attributes", "partially-verified", "Verified-email fallback protections exist, but complete provider linking/unlinking and collision behavior is unverified.", "Cross-account collision, verified-email and unlink/relink tests."],
  ["invitation", "Invitation acceptance", "Organisation/team invitation flow associated with the authenticated recipient", "Server-resolved token, recipient, tenant and allowed role", "not-verified", "Invitation token single use, tenant binding and concurrent acceptance are release gaps.", "Recipient, expiry, replay, tenant, role and concurrency tests."],
  ["session-refresh", "Session refresh", "AuthKit session middleware", "Provider-issued server session lifecycle", "not-verified", "Refresh rotation and replay behavior are not evidenced from source or tenant configuration.", "Staging refresh rotation, replay and revoked-session tests."],
  ["session-expiry", "Session expiry", "AuthKit session middleware", "Provider idle and absolute lifetime settings", "not-verified", "Explicit idle and absolute expiry values are absent from the inspected repository.", "Capture tenant settings and test both expiry boundaries."],
  ["session-revocation", "Session revocation", "Provider and application account-state checks", "WorkOS revocation plus authoritative local banned/deleted state", "not-verified", "Banned local profiles are denied, but provider-wide revocation after security changes/deletion is unproven.", "Revoke one/all sessions and prove old sessions fail across web/API/Realtime."],
  ["security-setting", "Security-setting changes", "Account security surface backed by provider/local policy", "Current session plus privileged reauthentication where required", "not-verified", "No complete action-to-step-up/audit registry proves security-setting mutations.", "Direct mutation, reauthentication, audit and session-rotation tests."],
  ["email-change", "Email-address changes", "Identity-provider and local synchronization lifecycle", "Provider-verified new address plus current-user confirmation", "not-verified", "Reauthentication, dual notification, rollback and session invalidation are not evidenced.", "Old/new address notifications, step-up, collision and session tests."],
  ["step-up", "Privileged step-up authentication", "No complete administrator step-up flow identified", "Phishing-resistant provider challenge bound to the privileged action", "control-missing", "Administrator guards validate role but do not prove recent strong authentication for high-risk operations.", "Implement bounded step-up and test expiry, replay and action binding."],
  ["recovery", "Account recovery", "Provider-hosted recovery with local account-state reconciliation", "Provider recovery assurance plus server-side local subject", "not-verified", "Recovery methods, identity proofing, notification and support override are unverified.", "Provider configuration and takeover-resistant recovery tests."],
  ["deletion", "Account deletion", "Local request/grace/finalization lifecycle", "Current authenticated user plus reauthentication and ownership constraints", "partially-verified", "Bounded local/database/storage paths exist; reauthentication and provider session/deletion lifecycle remain open.", "Reauth, session revocation, provider, last-owner and restore tests."],
  ["administrator", "Administrator access", "requireAdminProfile on identified administrator-only surfaces", "Exact active local administrator role", "partially-verified", "Static guards exist; step-up and complete runtime direct-route/API denial remain blockers.", "Signed-out/member/moderator/suspended runtime matrix plus step-up."],
  ["moderator", "Moderator access", "requireModeratorProfile plus role-aware route selection", "Active moderator or administrator role with route-specific policy", "partially-verified", "Selected read-only moderation boundaries are documented; complete least-privilege runtime tests remain open.", "Member/moderator/admin projection and mutation tests for every queue."],
  ["support", "Support-operator access", "No dedicated fully scoped support authentication role identified", "Named support identity plus purpose-bound assignment and approval", "control-missing", "Support surfaces currently rely on broader staff roles/read-only presentation rather than an independently proven support identity boundary.", "Define support identity, scope, impersonation prohibition/approval and runtime tests."],
] as const satisfies readonly AuthenticationPathSeed[];

const AUTHENTICATION_PATH_EVIDENCE = [
  "docs/security/authentication-review.md",
  "docs/security/session-review.md",
  "docs/security/security-architecture.md",
  "docs/security/risk-register.md",
  "src/lib/auth.ts",
  "src/app/callback/route.ts",
] as const;

export const AUTHENTICATION_PATH_REVIEW_RECORDS = AUTHENTICATION_PATH_SEEDS.map(
  ([slug, path, implementation, authority, status, currentFinding, requiredValidation]) => ({
    requirementId: `security.authentication-path.${slug}`,
    path,
    implementation,
    authority,
    status,
    currentFinding,
    requiredValidation,
    owner: "GreyhoundIQ identity and application security leads",
    evidence: AUTHENTICATION_PATH_EVIDENCE,
  }),
);

export function validateAuthenticationPathReview() {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const record of AUTHENTICATION_PATH_REVIEW_RECORDS) {
    if (ids.has(record.requirementId)) failures.push(`${record.requirementId}:duplicate`);
    ids.add(record.requirementId);
    for (const field of ["path", "implementation", "authority", "currentFinding", "requiredValidation", "owner"] as const) {
      if (!record[field].trim()) failures.push(`${record.requirementId}:${field}`);
    }
  }
  return failures;
}
