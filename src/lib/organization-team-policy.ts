export const TEAM_ROLES = ["member", "admin", "owner"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export type TeamAuthority = TeamRole | "none";

export type TeamMembershipIdentity = {
  role: string;
  status: string;
} | null;

const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "accepted"]);

export function isActiveTeamMembership(status: string) {
  return ACTIVE_MEMBERSHIP_STATUSES.has(status);
}

export function normalizeTeamRole(role: string): TeamRole {
  if (role === "owner" || role === "admin") return role;
  return "member";
}

export function resolveTeamAuthority(input: {
  actorUserId: string;
  organizationOwnerId: string | null;
  membership: TeamMembershipIdentity;
}): TeamAuthority {
  if (input.organizationOwnerId === input.actorUserId) return "owner";
  if (!input.membership || !isActiveTeamMembership(input.membership.status)) {
    return "none";
  }

  const membershipRole = normalizeTeamRole(input.membership.role);
  if (membershipRole === "owner") {
    // A legacy owner membership is authoritative only while the organisation
    // has no explicit owner. A stale role must never override ownerId.
    return input.organizationOwnerId === null ? "owner" : "member";
  }
  return membershipRole;
}

export function canInviteTeamRole(
  authority: TeamAuthority,
  invitedRole: Exclude<TeamRole, "owner">,
) {
  if (authority === "owner") return true;
  return authority === "admin" && invitedRole === "member";
}

export function canRemoveTeamMember(input: {
  authority: TeamAuthority;
  targetAuthority: TeamAuthority;
  isSelf: boolean;
}) {
  if (input.isSelf || input.targetAuthority === "owner") return false;
  if (input.authority === "owner") return input.targetAuthority !== "none";
  return input.authority === "admin" && input.targetAuthority === "member";
}

export function canChangeTeamMemberRole(input: {
  authority: TeamAuthority;
  targetAuthority: TeamAuthority;
  nextRole: TeamRole;
  isSelf: boolean;
}) {
  if (input.authority !== "owner" || input.isSelf) return false;
  if (input.targetAuthority === "none" || input.targetAuthority === "owner") {
    return false;
  }
  return true;
}

export function canLeaveTeam(authority: TeamAuthority) {
  return authority === "member" || authority === "admin";
}
