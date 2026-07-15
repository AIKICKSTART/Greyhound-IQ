import { Clock3, Crown, LogOut, ShieldCheck, UserMinus, Users } from "lucide-react";

import {
  changeTeamMemberRoleAction,
  leaveTeamAction,
  removeTeamMemberAction,
} from "@/app/account/team/actions";
import { TeamInviteForm } from "@/app/account/team/team-invite-form";
import { SubmitButton } from "@/components/submit-button";
import type {
  TeamMemberSummary,
  TeamOrganizationSummary,
} from "@/lib/organization-team-service";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function TeamManagement({
  organizations,
}: {
  organizations: TeamOrganizationSummary[];
}) {
  return (
    <div className="grid gap-5">
      {organizations.map((organization) => (
        <article key={organization.id} className="giq-panel p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="giq-icon-plate flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                  {organization.name}
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {organization.members.length.toLocaleString("en-AU")} active
                  team {organization.members.length === 1 ? "member" : "members"}
                </p>
              </div>
            </div>
            <span className="giq-status-pill w-fit">
              {organization.authority === "owner" ? (
                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {formatLabel(organization.authority)} access
            </span>
          </div>

          {organization.authority === "owner" || organization.authority === "admin" ? (
            <div className="mt-5">
              <TeamInviteForm
                organizationId={organization.id}
                canInviteAdmin={organization.authority === "owner"}
              />
            </div>
          ) : null}

          <div
            role="region"
            aria-label={`${organization.name} members`}
            tabIndex={0}
            className="giq-table-shell mt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
          >
            <table className="w-full min-w-[780px] border-collapse text-left text-[13px]">
              <caption className="sr-only">
                Active members of {organization.name}
              </caption>
              <thead>
                <tr className="giq-table-head">
                  <th scope="col" className="px-4 py-3">Member</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Joined</th>
                  <th scope="col" className="px-4 py-3">Controls</th>
                </tr>
              </thead>
              <tbody>
                {organization.members.map((member) => (
                  <TeamMemberRow
                    key={member.userId}
                    organization={organization}
                    member={member}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {organization.invitations.length > 0 ? (
            <section className="mt-5" aria-labelledby={`pending-${organization.id}`}>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                <h3
                  id={`pending-${organization.id}`}
                  className="text-[14px] font-semibold text-[hsl(var(--foreground))]"
                >
                  Pending invitations
                </h3>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {organization.invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                        Protected recipient · {formatLabel(invitation.role)}
                      </span>
                      <span className="giq-status-pill">Pending</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                      Expires {DATE_FORMATTER.format(invitation.expiresAt)} · ref {invitation.id.slice(-8)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function TeamMemberRow({
  organization,
  member,
}: {
  organization: TeamOrganizationSummary;
  member: TeamMemberSummary;
}) {
  const ownerCanManage =
    organization.authority === "owner" &&
    !member.isCurrentUser &&
    member.role !== "owner";
  const adminCanRemove =
    organization.authority === "admin" &&
    !member.isCurrentUser &&
    member.role === "member";
  const canRemove = ownerCanManage || adminCanRemove;

  return (
    <tr className="giq-table-row">
      <td className="px-4 py-4">
        <div className="font-semibold text-[hsl(var(--foreground))]">
          {member.displayName}
          {member.isCurrentUser ? (
            <span className="ml-2 text-[11px] font-normal text-[hsl(var(--muted-foreground))]">
              You
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
          {formatLabel(member.status)}
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="giq-status-pill giq-status-pill-purple">
          {member.role === "owner" ? (
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {formatLabel(member.role)}
        </span>
      </td>
      <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
        {DATE_FORMATTER.format(member.acceptedAt ?? member.joinedAt)}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col items-start gap-2">
          {member.isCurrentUser && member.role !== "owner" ? (
            <form action={leaveTeamAction} className="flex items-center gap-2">
              <input type="hidden" name="organizationId" value={organization.id} />
              <label className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                <input required type="checkbox" name="confirmation" value="LEAVE" />
                Confirm
              </label>
              <SubmitButton
                pendingLabel="Leaving..."
                className="giq-outline-action min-h-9 px-3 text-[11px]"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Leave team
              </SubmitButton>
            </form>
          ) : null}

          {ownerCanManage ? (
            <form action={changeTeamMemberRoleAction} className="flex items-end gap-2">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input type="hidden" name="targetUserId" value={member.userId} />
              <input type="hidden" name="confirmation" value="CHANGE_ROLE" />
              <label className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
                  Role
                </span>
                <select
                  name="role"
                  defaultValue={member.role === "admin" ? "admin" : "member"}
                  className="giq-input min-h-9 min-w-28 py-1 text-[11px]"
                >
                  <option value="member">Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <SubmitButton
                pendingLabel="Saving..."
                className="giq-outline-action min-h-9 px-3 text-[11px]"
              >
                Save role
              </SubmitButton>
            </form>
          ) : null}

          {ownerCanManage ? (
            <details className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2.5 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-amber-100">
                Transfer ownership
              </summary>
              <form action={changeTeamMemberRoleAction} className="mt-2 grid gap-2">
                <input type="hidden" name="organizationId" value={organization.id} />
                <input type="hidden" name="targetUserId" value={member.userId} />
                <label className="flex max-w-xs items-start gap-2 text-[11px] leading-4 text-amber-50/80">
                  <input
                    required
                    type="checkbox"
                    name="confirmation"
                    value="TRANSFER"
                    className="mt-0.5"
                  />
                  I understand this member becomes the owner and I become an administrator.
                </label>
                <SubmitButton
                  name="role"
                  value="owner"
                  pendingLabel="Transferring..."
                  className="giq-outline-action min-h-9 w-fit px-3 text-[11px]"
                >
                  <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                  Transfer ownership
                </SubmitButton>
              </form>
            </details>
          ) : null}

          {canRemove ? (
            <form action={removeTeamMemberAction} className="flex items-center gap-2">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input type="hidden" name="targetUserId" value={member.userId} />
              <label className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                <input required type="checkbox" name="confirmation" value="REMOVE" />
                Confirm
              </label>
              <SubmitButton
                pendingLabel="Removing..."
                className="giq-outline-action min-h-9 px-3 text-[11px]"
              >
                <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </SubmitButton>
            </form>
          ) : null}

          {member.isCurrentUser && member.role === "owner" ? (
            <p className="max-w-xs text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
              Transfer ownership to an active member before leaving this team.
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function formatLabel(value: string) {
  const cleaned = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "Unknown";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
