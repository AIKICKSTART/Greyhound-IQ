export const ORGANIZATION_TEAM_AUTHORIZATION_EVIDENCE_FILE =
  "security/organization-team-authorization-evidence.ts" as const;
export const ORGANIZATION_TEAM_AUTHORIZATION_TEST_FILE =
  "security/organization-team-authorization-evidence.test.ts" as const;

export const ORGANIZATION_TEAM_AUTHORIZATION_SCOPE =
  "Source, policy-unit, and previously captured disposable-loopback PostgreSQL evidence for the organization-backed team boundary. Account actions derive the current user on the server; services lock the requested organization, resolve current membership and owner authority, deny inactive or insufficient roles, bind target membership to the same organization, protect the authoritative owner, and write the mutation audit in the transaction. The RLS replay independently proves anonymous and cross-organization denial for Organization and Membership rows. This closes only the exact organization/team authority, tenant-policy, last-owner, and named team-trace requirements below; it does not claim browser hydration, deployed-database parity, production concurrency, WorkOS organization synchronization, or authorization outside the organization-team workflow.";

export const ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS = [
  "security.server-authority.organization",
  "security.server-authority.team",
  "security.deny-by-default.tenant",
  "security.object-authorization.organisation-id",
  "security.object-authorization.team-id",
  "security.tenant-isolation.server-resolution",
  "security.tenant-isolation.database-policy",
  "security.administration-control.last-owner",
  "security.trace.35.team-invite-create",
  "security.trace.37.team-role-change",
  "security.trace.38.last-owner-removal-attempt",
] as const;

export type OrganizationTeamAuthorizationRequirementId =
  (typeof ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS)[number];

type OrganizationTeamAuthorizationTrace = Readonly<{
  requirementId:
    | "security.trace.35.team-invite-create"
    | "security.trace.37.team-role-change"
    | "security.trace.38.last-owner-removal-attempt";
  actor: string;
  expectedResult: "allowed" | "denied";
  steps: readonly Readonly<{
    sourceFile: string;
    sourceSymbol: string;
    input: string;
    output: string;
    trustBoundary: string;
    securityControl: string;
    failure: string;
    test: string;
  }>[];
}>;

const TEAM_EVIDENCE_TEST = "src/components/product-account-team-evidence.test.ts";
const TEAM_POLICY_TEST = "src/lib/organization-team-policy.test.ts";

export const ORGANIZATION_TEAM_AUTHORIZATION_TRACES: readonly OrganizationTeamAuthorizationTrace[] = [
  {
    requirementId: "security.trace.35.team-invite-create",
    actor: "Authenticated organization owner or permitted administrator creating a bounded team invitation",
    expectedResult: "allowed",
    steps: [
      {
        sourceFile: "src/app/account/team/actions.ts",
        sourceSymbol: "createTeamInvitationAction",
        input: "Allowlisted organizationId, email, and non-owner role from FormData",
        output: "Server current profile and validated invitation request",
        trustBoundary: "Browser Server Action request to authenticated application code",
        securityControl: "requireCurrentUserProfile, schema parsing, and fail-closed action rate limit",
        failure: "Authentication, validation, or limiter denial returns the bounded action error state",
        test: TEAM_EVIDENCE_TEST,
      },
      {
        sourceFile: "src/lib/organization-team-service.ts",
        sourceSymbol: "createOrganizationTeamInvitation",
        input: "Current server user plus requested organization and role",
        output: "Hashed, expiring invitation and in-transaction team.invitation.create audit",
        trustBoundary: "Application service to locked organization transaction",
        securityControl: "lockOrganization, getTeamAuthority, and canInviteTeamRole execute before the write",
        failure: "Missing organization or insufficient authority throws before invitation persistence",
        test: TEAM_EVIDENCE_TEST,
      },
    ],
  },
  {
    requirementId: "security.trace.37.team-role-change",
    actor: "Authenticated authoritative organization owner changing an active member role",
    expectedResult: "allowed",
    steps: [
      {
        sourceFile: "src/app/account/team/actions.ts",
        sourceSymbol: "changeTeamMemberRoleAction",
        input: "Allowlisted organizationId, targetUserId, next role, and required confirmation",
        output: "Server current profile and validated role-change request",
        trustBoundary: "Browser Server Action request to authenticated application code",
        securityControl: "Server authentication, strict schema, confirmation literal, and fail-closed rate limit",
        failure: "Invalid input, missing confirmation, or authentication failure prevents service execution",
        test: TEAM_EVIDENCE_TEST,
      },
      {
        sourceFile: "src/lib/organization-team-service.ts",
        sourceSymbol: "changeOrganizationTeamMemberRole",
        input: "Locked organization, current owner authority, and target membership in that organization",
        output: "Role update or atomic ownerId transfer with team audit",
        trustBoundary: "Application service to organization-scoped transaction",
        securityControl: "getTeamAuthority, getTeamMembership, resolveTeamAuthority, and canChangeTeamMemberRole",
        failure: "Non-owner, self-change, missing target, or owner-target ambiguity fails before mutation",
        test: TEAM_EVIDENCE_TEST,
      },
    ],
  },
  {
    requirementId: "security.trace.38.last-owner-removal-attempt",
    actor: "Organization owner or administrator attempting to remove the authoritative owner",
    expectedResult: "denied",
    steps: [
      {
        sourceFile: "src/app/account/team/actions.ts",
        sourceSymbol: "removeTeamMemberAction",
        input: "OrganizationId, owner targetUserId, and REMOVE confirmation",
        output: "Server current profile and validated removal attempt",
        trustBoundary: "Browser Server Action request to authenticated application code",
        securityControl: "Server authentication, strict schema, confirmation literal, and fail-closed rate limit",
        failure: "Invalid input or authentication failure prevents the organization lookup",
        test: TEAM_EVIDENCE_TEST,
      },
      {
        sourceFile: "src/lib/organization-team-service.ts",
        sourceSymbol: "removeOrganizationTeamMember",
        input: "Locked organization plus current and target server-resolved authorities",
        output: "No membership mutation",
        trustBoundary: "Application service to organization-scoped transaction",
        securityControl: "canRemoveTeamMember returns false whenever targetAuthority is owner",
        failure: "team.member_remove_forbidden is thrown before membership.update",
        test: TEAM_POLICY_TEST,
      },
    ],
  },
] as const;

const COMMON_EVIDENCE = [
  ORGANIZATION_TEAM_AUTHORIZATION_EVIDENCE_FILE,
  ORGANIZATION_TEAM_AUTHORIZATION_TEST_FILE,
  "src/app/account/team/actions.ts",
  "src/lib/organization-team-policy.ts",
  TEAM_POLICY_TEST,
  "src/lib/organization-team-service.ts",
  "src/components/product-account-team-evidence.ts",
  TEAM_EVIDENCE_TEST,
  "src/lib/db-context.ts",
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  "scripts/check-rls-access-matrix-postgres.ts",
  "security/row-level-security-runtime-evidence.json",
  "security/row-level-security-evidence.test.ts",
] as const;

export const ORGANIZATION_TEAM_AUTHORIZATION_MASTER_EVIDENCE =
  Object.fromEntries(
    ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: COMMON_EVIDENCE },
    ]),
  );

export const ORGANIZATION_TEAM_AUTHORIZATION_EXPECTED_GAIN =
  ORGANIZATION_TEAM_AUTHORIZATION_REQUIREMENT_IDS.length;
