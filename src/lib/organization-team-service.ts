import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { CurrentUserProfile } from "@/lib/auth-types";
import {
  withDbSystemContext,
  type DbContextClient,
} from "@/lib/db-context";
import {
  canChangeTeamMemberRole,
  canInviteTeamRole,
  canLeaveTeam,
  canRemoveTeamMember,
  isActiveTeamMembership,
  normalizeTeamRole,
  resolveTeamAuthority,
  type TeamAuthority,
  type TeamRole,
} from "@/lib/organization-team-policy";

const TEAM_ORGANIZATION_LIMIT = 25;
const TEAM_MEMBER_LIMIT = 500;
const TEAM_INVITATION_LIMIT = 100;
const TEAM_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
const TEAM_INVITATION_TOKEN_BYTES = 32;
const TEAM_INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const ACCOUNT_TEAM_CHANGE_ROLE_TRACE_ID = "ACCOUNT.TEAM.CHANGE_ROLE";

type LockedOrganization = {
  id: string;
  name: string;
  ownerId: string | null;
};

type TeamMembershipRecord = {
  userId: string;
  role: string;
  status: string;
};

export type TeamMemberSummary = {
  userId: string;
  displayName: string;
  role: TeamRole;
  status: string;
  acceptedAt: Date | null;
  joinedAt: Date;
  isCurrentUser: boolean;
};

export type TeamInvitationSummary = {
  id: string;
  role: Exclude<TeamRole, "owner">;
  status: string;
  expiresAt: Date;
  createdAt: Date;
};

export type TeamOrganizationSummary = {
  id: string;
  name: string;
  authority: TeamAuthority;
  members: TeamMemberSummary[];
  invitations: TeamInvitationSummary[];
};

export type TeamInvitationPreview = {
  organizationName: string;
  role: Exclude<TeamRole, "owner">;
  status: "pending" | "accepted" | "rejected" | "expired";
  expiresAt: Date;
};

export async function listOrganizationTeams(
  current: CurrentUserProfile,
): Promise<TeamOrganizationSummary[]> {
  return withDbSystemContext(async (tx) => {
    const organizations = await tx.organization.findMany({
      where: {
        OR: [
          { ownerId: current.dbUserId },
          {
            memberships: {
              some: {
                userId: current.dbUserId,
                status: { in: ["active", "accepted"] },
              },
            },
          },
        ],
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: TEAM_ORGANIZATION_LIMIT,
      select: { id: true, name: true, ownerId: true },
    });
    if (organizations.length === 0) return [];

    const organizationIds = organizations.map(({ id }) => id);
    const actorMemberships = await tx.membership.findMany({
      where: {
        organizationId: { in: organizationIds },
        userId: current.dbUserId,
      },
      take: TEAM_ORGANIZATION_LIMIT,
      select: { organizationId: true, role: true, status: true },
    });
    const actorMembershipByOrganization = new Map(
      actorMemberships.map((membership) => [
        membership.organizationId,
        membership,
      ]),
    );

    const members = await tx.membership.findMany({
      where: {
        organizationId: { in: organizationIds },
        status: { in: ["active", "accepted"] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: TEAM_MEMBER_LIMIT,
      select: {
        organizationId: true,
        userId: true,
        role: true,
        status: true,
        acceptedAt: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    const manageableIds = organizations
      .filter((organization) => {
        const membership = actorMembershipByOrganization.get(organization.id);
        const authority = resolveTeamAuthority({
          actorUserId: current.dbUserId,
          organizationOwnerId: organization.ownerId,
          membership: membership
            ? { role: membership.role, status: membership.status }
            : null,
        });
        return authority === "owner" || authority === "admin";
      })
      .map(({ id }) => id);

    const invitations =
      manageableIds.length === 0
        ? []
        : await tx.organizationInvitation.findMany({
            where: {
              organizationId: { in: manageableIds },
              status: "pending",
              expiresAt: { gt: new Date() },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: TEAM_INVITATION_LIMIT,
            select: {
              id: true,
              organizationId: true,
              role: true,
              status: true,
              expiresAt: true,
              createdAt: true,
            },
          });

    return organizations.map((organization) => {
      const actorMembership = actorMembershipByOrganization.get(
        organization.id,
      );
      const authority = resolveTeamAuthority({
        actorUserId: current.dbUserId,
        organizationOwnerId: organization.ownerId,
        membership: actorMembership
          ? { role: actorMembership.role, status: actorMembership.status }
          : null,
      });

      return {
        id: organization.id,
        name: organization.name,
        authority,
        members: members
          .filter((member) => member.organizationId === organization.id)
          .map((member) => ({
            userId: member.userId,
            displayName:
              member.user.profile?.displayName ||
              member.user.name ||
              "GreyhoundIQ member",
            role:
              organization.ownerId === member.userId
                ? "owner"
                : normalizeTeamRole(member.role),
            status: member.status,
            acceptedAt: member.acceptedAt,
            joinedAt: member.createdAt,
            isCurrentUser: member.userId === current.dbUserId,
          })),
        invitations: invitations
          .filter(
            (invitation) =>
              invitation.organizationId === organization.id,
          )
          .map((invitation) => ({
            id: invitation.id,
            role: invitation.role === "admin" ? "admin" : "member",
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
          })),
      };
    });
  });
}

export async function createOrganizationTeamInvitation(
  current: CurrentUserProfile,
  input: {
    organizationId: string;
    email: string;
    role: Exclude<TeamRole, "owner">;
  },
) {
  const token = createTeamInvitationToken();
  const tokenHash = hashTeamInvitationSecret(token);
  const emailHash = hashTeamInvitationEmail(input.email);
  const expiresAt = new Date(Date.now() + TEAM_INVITATION_TTL_MS);

  const invitation = await withDbSystemContext(async (tx) => {
    const organization = await lockOrganization(tx, input.organizationId);
    const authority = await getTeamAuthority(tx, organization, current.dbUserId);
    if (!canInviteTeamRole(authority, input.role)) {
      throw new Error("team.invitation_forbidden");
    }

    await tx.organizationInvitation.updateMany({
      where: {
        organizationId: organization.id,
        emailHash,
        status: "pending",
        expiresAt: { lte: new Date() },
      },
      data: { status: "expired" },
    });

    const existing = await tx.organizationInvitation.findFirst({
      where: {
        organizationId: organization.id,
        emailHash,
        status: "pending",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    const saved = existing
      ? await tx.organizationInvitation.update({
          where: { id: existing.id },
          data: {
            invitedByUserId: current.dbUserId,
            role: input.role,
            tokenHash,
            expiresAt,
            acceptedAt: null,
          },
          select: { id: true },
        })
      : await tx.organizationInvitation.create({
          data: {
            organizationId: organization.id,
            invitedByUserId: current.dbUserId,
            emailHash,
            tokenHash,
            role: input.role,
            status: "pending",
            expiresAt,
          },
          select: { id: true },
        });

    await writeTeamAudit(tx, {
      actorId: current.dbUserId,
      action: "team.invitation.create",
      targetType: "organizationInvitation",
      targetId: saved.id,
      metadata: {
        organizationId: organization.id,
        role: input.role,
        result: "success",
      },
    });
    return saved;
  });

  return {
    invitationId: invitation.id,
    invitationPath: `/account/team?invitation=${encodeURIComponent(token)}`,
    expiresAt,
  };
}

export async function getOrganizationTeamInvitation(
  current: CurrentUserProfile,
  token: string,
): Promise<TeamInvitationPreview> {
  assertTeamInvitationToken(token);
  const tokenHash = hashTeamInvitationSecret(token);
  const emailHash = hashTeamInvitationEmail(current.email);

  return withDbSystemContext(async (tx) => {
    const invitation = await tx.organizationInvitation.findUnique({
      where: { tokenHash },
      select: {
        emailHash: true,
        role: true,
        status: true,
        expiresAt: true,
        organization: { select: { name: true } },
      },
    });
    if (!invitation || invitation.emailHash !== emailHash) {
      throw new Error("team.invitation_not_found");
    }

    return {
      organizationName: invitation.organization.name,
      role: invitation.role === "admin" ? "admin" : "member",
      status: invitationStatus(invitation.status, invitation.expiresAt),
      expiresAt: invitation.expiresAt,
    };
  });
}

export async function acceptOrganizationTeamInvitation(
  current: CurrentUserProfile,
  token: string,
) {
  return decideOrganizationTeamInvitation(current, token, "accept");
}

export async function rejectOrganizationTeamInvitation(
  current: CurrentUserProfile,
  token: string,
) {
  return decideOrganizationTeamInvitation(current, token, "reject");
}

async function decideOrganizationTeamInvitation(
  current: CurrentUserProfile,
  token: string,
  decision: "accept" | "reject",
) {
  assertTeamInvitationToken(token);
  const tokenHash = hashTeamInvitationSecret(token);
  const emailHash = hashTeamInvitationEmail(current.email);

  return withDbSystemContext(async (tx) => {
    const invitationRows = await tx.$queryRaw<
      Array<{
        id: string;
        organizationId: string;
        emailHash: string;
        role: string;
        status: string;
        expiresAt: Date;
      }>
    >`
      SELECT id, "organizationId", "emailHash", role, status, "expiresAt"
      FROM "OrganizationInvitation"
      WHERE "tokenHash" = ${tokenHash}
      FOR UPDATE
    `;
    const invitation = invitationRows[0];
    if (!invitation || invitation.emailHash !== emailHash) {
      throw new Error("team.invitation_not_found");
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new Error("team.invitation_expired");
    }

    const expectedFinalStatus = decision === "accept" ? "accepted" : "rejected";
    if (invitation.status === expectedFinalStatus) {
      return { organizationId: invitation.organizationId, alreadyApplied: true };
    }
    if (invitation.status !== "pending") {
      throw new Error("team.invitation_not_pending");
    }

    if (decision === "accept") {
      await tx.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: current.dbUserId,
          },
        },
        update: {
          role: invitation.role === "admin" ? "admin" : "member",
          status: "active",
          acceptedAt: new Date(),
        },
        create: {
          organizationId: invitation.organizationId,
          userId: current.dbUserId,
          role: invitation.role === "admin" ? "admin" : "member",
          status: "active",
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });
    }

    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: expectedFinalStatus,
        acceptedAt: decision === "accept" ? new Date() : null,
      },
    });
    await writeTeamAudit(tx, {
      actorId: current.dbUserId,
      action: `team.invitation.${decision}`,
      targetType: "organizationInvitation",
      targetId: invitation.id,
      metadata: {
        organizationId: invitation.organizationId,
        result: "success",
      },
    });
    return { organizationId: invitation.organizationId, alreadyApplied: false };
  });
}

export async function leaveOrganizationTeam(
  current: CurrentUserProfile,
  organizationId: string,
) {
  return withDbSystemContext(async (tx) => {
    const organization = await lockOrganization(tx, organizationId);
    const membership = await getTeamMembership(
      tx,
      organization.id,
      current.dbUserId,
    );
    const authority = resolveTeamAuthority({
      actorUserId: current.dbUserId,
      organizationOwnerId: organization.ownerId,
      membership,
    });
    if (!membership || !canLeaveTeam(authority)) {
      throw new Error("team.last_owner_transfer_required");
    }

    await tx.membership.update({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: current.dbUserId,
        },
      },
      data: { status: "left" },
    });
    await writeTeamAudit(tx, {
      actorId: current.dbUserId,
      action: "team.member.leave",
      targetType: "membership",
      targetId: membership.userId,
      metadata: { organizationId: organization.id, result: "success" },
    });
  });
}

export async function removeOrganizationTeamMember(
  current: CurrentUserProfile,
  input: { organizationId: string; targetUserId: string },
) {
  return withDbSystemContext(async (tx) => {
    const organization = await lockOrganization(tx, input.organizationId);
    const authority = await getTeamAuthority(
      tx,
      organization,
      current.dbUserId,
    );
    const targetMembership = await getTeamMembership(
      tx,
      organization.id,
      input.targetUserId,
    );
    const targetAuthority = resolveTeamAuthority({
      actorUserId: input.targetUserId,
      organizationOwnerId: organization.ownerId,
      membership: targetMembership,
    });
    if (
      !targetMembership ||
      !canRemoveTeamMember({
        authority,
        targetAuthority,
        isSelf: input.targetUserId === current.dbUserId,
      })
    ) {
      throw new Error("team.member_remove_forbidden");
    }

    await tx.membership.update({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: input.targetUserId,
        },
      },
      data: { status: "removed" },
    });
    await writeTeamAudit(tx, {
      actorId: current.dbUserId,
      action: "team.member.remove",
      targetType: "membership",
      targetId: input.targetUserId,
      metadata: { organizationId: organization.id, result: "success" },
    });
  });
}

export async function changeOrganizationTeamMemberRole(
  current: CurrentUserProfile,
  input: {
    organizationId: string;
    targetUserId: string;
    role: TeamRole;
  },
) {
  return withDbSystemContext(async (tx) => {
    const organization = await lockOrganization(tx, input.organizationId);
    const authority = await getTeamAuthority(
      tx,
      organization,
      current.dbUserId,
    );
    const targetMembership = await getTeamMembership(
      tx,
      organization.id,
      input.targetUserId,
    );
    const targetAuthority = resolveTeamAuthority({
      actorUserId: input.targetUserId,
      organizationOwnerId: organization.ownerId,
      membership: targetMembership,
    });
    if (
      !targetMembership ||
      !canChangeTeamMemberRole({
        authority,
        targetAuthority,
        nextRole: input.role,
        isSelf: input.targetUserId === current.dbUserId,
      })
    ) {
      throw new Error("team.member_role_forbidden");
    }

    if (input.role === "owner") {
      await tx.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: current.dbUserId,
          },
        },
        update: { role: "admin", status: "active" },
        create: {
          organizationId: organization.id,
          userId: current.dbUserId,
          role: "admin",
          status: "active",
          acceptedAt: new Date(),
        },
      });
      await tx.membership.update({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: input.targetUserId,
          },
        },
        data: { role: "owner", status: "active" },
      });
      await tx.organization.update({
        where: { id: organization.id },
        data: { ownerId: input.targetUserId },
      });
      await writeTeamAudit(tx, {
        actorId: current.dbUserId,
        action: "team.owner.transfer",
        targetType: "organization",
        targetId: organization.id,
        metadata: {
          traceId: ACCOUNT_TEAM_CHANGE_ROLE_TRACE_ID,
          previousOwnerId: current.dbUserId,
          nextOwnerId: input.targetUserId,
          result: "success",
        },
      });
      return;
    }

    await tx.membership.update({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: input.targetUserId,
        },
      },
      data: { role: input.role },
    });
    await writeTeamAudit(tx, {
      actorId: current.dbUserId,
      action: "team.member.role",
      targetType: "membership",
      targetId: input.targetUserId,
      metadata: {
        traceId: ACCOUNT_TEAM_CHANGE_ROLE_TRACE_ID,
        organizationId: organization.id,
        role: input.role,
        result: "success",
      },
    });
  });
}

export function createTeamInvitationToken() {
  return randomBytes(TEAM_INVITATION_TOKEN_BYTES).toString("base64url");
}

export function isTeamInvitationToken(value: string) {
  return TEAM_INVITATION_TOKEN_PATTERN.test(value);
}

export function hashTeamInvitationSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashTeamInvitationEmail(value: string) {
  return hashTeamInvitationSecret(value.trim().toLowerCase());
}

function assertTeamInvitationToken(value: string) {
  if (!isTeamInvitationToken(value)) {
    throw new Error("team.invitation_not_found");
  }
}

function invitationStatus(status: string, expiresAt: Date) {
  if (status === "accepted" || status === "rejected") return status;
  if (status !== "pending" || expiresAt.getTime() <= Date.now()) {
    return "expired";
  }
  return "pending";
}

async function lockOrganization(
  tx: DbContextClient,
  organizationId: string,
): Promise<LockedOrganization> {
  const rows = await tx.$queryRaw<LockedOrganization[]>`
    SELECT id, name, "ownerId"
    FROM "Organization"
    WHERE id = ${organizationId}
    FOR UPDATE
  `;
  const organization = rows[0];
  if (!organization) throw new Error("team.organization_not_found");
  return organization;
}

async function getTeamMembership(
  tx: DbContextClient,
  organizationId: string,
  userId: string,
): Promise<TeamMembershipRecord | null> {
  return tx.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true, role: true, status: true },
  });
}

async function getTeamAuthority(
  tx: DbContextClient,
  organization: LockedOrganization,
  actorUserId: string,
) {
  const membership = await getTeamMembership(
    tx,
    organization.id,
    actorUserId,
  );
  return resolveTeamAuthority({
    actorUserId,
    organizationOwnerId: organization.ownerId,
    membership,
  });
}

function writeTeamAudit(
  tx: DbContextClient,
  input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, unknown>;
  },
) {
  return tx.auditLog.createMany({
    data: {
      actorId: input.actorId,
      actorType: "user",
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: JSON.stringify(input.metadata),
    },
  });
}

/** @internal Public for focused policy tests without provider or database I/O. */
export function teamMembershipIsActive(membership: TeamMembershipRecord | null) {
  return Boolean(membership && isActiveTeamMembership(membership.status));
}
