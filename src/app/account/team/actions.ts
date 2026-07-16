"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCurrentUserProfile } from "@/lib/auth";
import {
  acceptOrganizationTeamInvitation,
  changeOrganizationTeamMemberRole,
  createOrganizationTeamInvitation,
  hashTeamInvitationSecret,
  leaveOrganizationTeam,
  rejectOrganizationTeamInvitation,
  removeOrganizationTeamMember,
} from "@/lib/organization-team-service";
import { checkRateLimit } from "@/lib/rate-limit";

const idSchema = z
  .string()
  .trim()
  .min(10)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
const invitationTokenSchema = z
  .string()
  .trim()
  .length(43)
  .regex(/^[A-Za-z0-9_-]+$/);

const inviteSchema = z.object({
  organizationId: idSchema,
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["member", "admin"]),
});
const invitationDecisionSchema = z.object({
  token: invitationTokenSchema,
  decision: z.enum(["accept", "reject"]),
});
const membershipTargetSchema = z.object({
  organizationId: idSchema,
  targetUserId: idSchema,
});
const memberRemovalSchema = membershipTargetSchema.extend({
  confirmation: z.literal("REMOVE"),
});
const membershipRoleSchema = z.discriminatedUnion("role", [
  membershipTargetSchema.extend({
    role: z.enum(["member", "admin"]),
    confirmation: z.literal("CHANGE_ROLE"),
  }),
  membershipTargetSchema.extend({
    role: z.literal("owner"),
    confirmation: z.literal("TRANSFER"),
  }),
]);
const leaveSchema = z.object({
  organizationId: idSchema,
  confirmation: z.literal("LEAVE"),
});

const TEAM_INVITE_LIMIT = 20;
const TEAM_INVITE_WINDOW_MS = 24 * 60 * 60 * 1000;
const TEAM_DECISION_LIMIT = 20;
const TEAM_DECISION_WINDOW_MS = 15 * 60 * 1000;
const TEAM_MUTATION_LIMIT = 30;
const TEAM_MUTATION_WINDOW_MS = 60 * 60 * 1000;
const FAIL_CLOSED_RATE_LIMIT = { failClosed: true } as const;

export type TeamInviteActionState = {
  status: "idle" | "success" | "error";
  message: string;
  invitationPath?: string;
  expiresAt?: string;
};

export async function createTeamInvitationAction(
  _previous: TeamInviteActionState,
  formData: FormData,
): Promise<TeamInviteActionState> {
  const parsed = inviteSchema.safeParse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address and choose an allowed role.",
    };
  }

  try {
    const current = await requireCurrentUserProfile();
    await requireTeamRateLimit(
      `team:invite:${current.dbUserId}:${parsed.data.organizationId}`,
      TEAM_INVITE_LIMIT,
      TEAM_INVITE_WINDOW_MS,
    );
    const invitation = await createOrganizationTeamInvitation(
      current,
      parsed.data,
    );
    revalidatePath("/account/team");
    return {
      status: "success",
      message:
        "Invitation created. Copy the one-time link now; only the invited email can use it.",
      invitationPath: invitation.invitationPath,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  } catch (error) {
    return { status: "error", message: teamActionErrorMessage(error) };
  }
}

export async function decideTeamInvitationAction(formData: FormData) {
  const parsed = invitationDecisionSchema.safeParse({
    token: formData.get("token"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) redirect(teamResultPath("error-invalid"));

  let outcome =
    parsed.data.decision === "accept" ? "invitation-accepted" : "invitation-rejected";
  try {
    const current = await requireCurrentUserProfile();
    const tokenKey = hashTeamInvitationSecret(parsed.data.token).slice(0, 24);
    await requireTeamRateLimit(
      `team:decision:${current.dbUserId}:${tokenKey}`,
      TEAM_DECISION_LIMIT,
      TEAM_DECISION_WINDOW_MS,
    );
    if (parsed.data.decision === "accept") {
      await acceptOrganizationTeamInvitation(current, parsed.data.token);
    } else {
      await rejectOrganizationTeamInvitation(current, parsed.data.token);
    }
    revalidatePath("/account/team");
  } catch (error) {
    outcome = teamActionErrorOutcome(error);
  }
  redirect(teamResultPath(outcome));
}

export async function leaveTeamAction(formData: FormData) {
  const parsed = leaveSchema.safeParse({
    organizationId: formData.get("organizationId"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect(teamResultPath("error-invalid"));

  let outcome = "team-left";
  try {
    const current = await requireCurrentUserProfile();
    await requireTeamRateLimit(
      `team:leave:${current.dbUserId}:${parsed.data.organizationId}`,
      TEAM_MUTATION_LIMIT,
      TEAM_MUTATION_WINDOW_MS,
    );
    await leaveOrganizationTeam(current, parsed.data.organizationId);
    revalidatePath("/account/team");
  } catch (error) {
    outcome = teamActionErrorOutcome(error);
  }
  redirect(teamResultPath(outcome));
}

export async function removeTeamMemberAction(formData: FormData) {
  const parsed = memberRemovalSchema.safeParse({
    organizationId: formData.get("organizationId"),
    targetUserId: formData.get("targetUserId"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect(teamResultPath("error-invalid"));

  let outcome = "member-removed";
  try {
    const current = await requireCurrentUserProfile();
    await requireTeamRateLimit(
      `team:remove:${current.dbUserId}:${parsed.data.organizationId}`,
      TEAM_MUTATION_LIMIT,
      TEAM_MUTATION_WINDOW_MS,
    );
    await removeOrganizationTeamMember(current, parsed.data);
    revalidatePath("/account/team");
  } catch (error) {
    outcome = teamActionErrorOutcome(error);
  }
  redirect(teamResultPath(outcome));
}

export async function changeTeamMemberRoleAction(formData: FormData) {
  const parsed = membershipRoleSchema.safeParse({
    organizationId: formData.get("organizationId"),
    targetUserId: formData.get("targetUserId"),
    role: formData.get("role"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect(teamResultPath("error-invalid"));

  let outcome = parsed.data.role === "owner" ? "owner-transferred" : "role-updated";
  try {
    const current = await requireCurrentUserProfile();
    await requireTeamRateLimit(
      `team:role:${current.dbUserId}:${parsed.data.organizationId}`,
      TEAM_MUTATION_LIMIT,
      TEAM_MUTATION_WINDOW_MS,
    );
    await changeOrganizationTeamMemberRole(current, parsed.data);
    revalidatePath("/account/team");
  } catch (error) {
    outcome = teamActionErrorOutcome(error);
  }
  redirect(teamResultPath(outcome));
}

async function requireTeamRateLimit(
  key: string,
  limit: number,
  windowMs: number,
) {
  const result = await checkRateLimit(
    key,
    limit,
    windowMs,
    FAIL_CLOSED_RATE_LIMIT,
  );
  if (!result.allowed) throw new Error("team.rate_limited");
}

function teamActionErrorOutcome(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "team.rate_limited") return "error-rate-limited";
  if (
    code === "team.last_owner_transfer_required" ||
    code === "team.member_role_forbidden"
  ) {
    return "error-last-owner";
  }
  if (
    code === "team.invitation_expired" ||
    code === "team.invitation_not_pending"
  ) {
    return "error-invitation-state";
  }
  if (
    code === "auth.unauthorized" ||
    code === "auth.forbidden" ||
    code.endsWith("_forbidden")
  ) {
    return "error-forbidden";
  }
  if (code === "team.invitation_not_found") return "error-invitation-state";
  return "error-unavailable";
}

function teamActionErrorMessage(error: unknown) {
  const outcome = teamActionErrorOutcome(error);
  if (outcome === "error-rate-limited") {
    return "Invitation attempts are paused briefly. Wait and try again.";
  }
  if (outcome === "error-forbidden") {
    return "Your team role does not allow that invitation.";
  }
  return "The invitation could not be created. No team access was changed.";
}

function teamResultPath(outcome: string) {
  return `/account/team?team=${encodeURIComponent(outcome)}`;
}
