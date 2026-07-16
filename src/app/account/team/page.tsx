import { ArrowLeft, Building2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TeamInvitationReview } from "@/app/account/team/team-invitation-review";
import { TeamManagement } from "@/app/account/team/team-management";
import { PageTitle } from "@/components/page-title";
import { requireCurrentUserProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import {
  getOrganizationTeamInvitation,
  isTeamInvitationToken,
  listOrganizationTeams,
} from "@/lib/organization-team-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account team - GreyhoundIQ",
  description: "Manage GreyhoundIQ organization memberships and invitations.",
};

const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const ACTION_CLASS = "giq-outline-action";

type AccountTeamPageProps = {
  searchParams: Promise<{
    invitation?: string | string[];
    team?: string | string[];
  }>;
};

const TEAM_RESULT_MESSAGES: Record<
  string,
  { tone: "success" | "error"; message: string }
> = {
  "invitation-accepted": {
    tone: "success",
    message: "Invitation accepted. Your team access is active.",
  },
  "invitation-rejected": {
    tone: "success",
    message: "Invitation declined. No team access was added.",
  },
  "team-left": {
    tone: "success",
    message: "You left the team. Your other account access is unchanged.",
  },
  "member-removed": {
    tone: "success",
    message: "The member was removed from this team.",
  },
  "role-updated": {
    tone: "success",
    message: "The member role was updated.",
  },
  "owner-transferred": {
    tone: "success",
    message: "Ownership was transferred atomically. You are now an administrator.",
  },
  "error-rate-limited": {
    tone: "error",
    message: "Team changes are paused briefly. Wait and try again.",
  },
  "error-last-owner": {
    tone: "error",
    message: "That change would remove or alter the required owner. Transfer ownership first.",
  },
  "error-invitation-state": {
    tone: "error",
    message: "That invitation is unavailable, expired, or has already been used.",
  },
  "error-forbidden": {
    tone: "error",
    message: "Your current team role does not allow that change.",
  },
  "error-invalid": {
    tone: "error",
    message: "The team change was not valid. Review the form and try again.",
  },
  "error-unavailable": {
    tone: "error",
    message: "The team change could not be completed. No access was changed.",
  },
};

export default async function AccountTeamPage({
  searchParams,
}: AccountTeamPageProps) {
  const query = await searchParams;
  const rawInvitation =
    typeof query.invitation === "string" ? query.invitation : null;
  const invitationRequested = rawInvitation !== null;
  const invitationToken =
    rawInvitation && isTeamInvitationToken(rawInvitation)
      ? rawInvitation
      : null;
  const returnTo = invitationToken
    ? `/account/team?invitation=${encodeURIComponent(invitationToken)}`
    : "/account/team";
  const current = await requireTeamProfile(returnTo);
  const organizations = await safeQuery(
    () => listOrganizationTeams(current),
    null,
  );
  const invitation = invitationToken
    ? await safeQuery(
        () => getOrganizationTeamInvitation(current, invitationToken),
        null,
      )
    : null;
  const result = typeof query.team === "string" ? TEAM_RESULT_MESSAGES[query.team] : null;

  return (
    <div>
      <TeamMemberHeader />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {result ? <TeamResultNotice {...result} /> : null}
        {invitationRequested ? (
          <TeamInvitationReview
            invitation={invitation}
            token={invitationToken ?? ""}
          />
        ) : null}

        {organizations === null ? (
          <UnavailableState />
        ) : organizations.length > 0 ? (
          <TeamManagement organizations={organizations} />
        ) : (
          <section className={PANEL_CLASS}>
            <EmptyState />
          </section>
        )}
      </section>
    </div>
  );
}

function TeamMemberHeader() {
  return (
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member settings</p>
          <PageTitle className="mt-2">
            Team
          </PageTitle>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Invite members, manage least-privilege roles, and transfer ownership safely.
          </p>
        </div>
        <Link href="/account" className={`${ACTION_CLASS} w-full sm:w-auto`}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to account
        </Link>
      </div>
    </header>
  );
}

async function requireTeamProfile(returnTo: string) {
  try {
    return await requireCurrentUserProfile();
  } catch (error) {
    if (error instanceof Error && error.message === "auth.unauthorized") {
      redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    }
    throw error;
  }
}

function TeamResultNotice({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] leading-5 ${
        tone === "error"
          ? "border-red-400/25 bg-red-500/10 text-red-100"
          : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
      }`}
    >
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="giq-dashed-panel px-5 py-10 text-center sm:px-8">
      <div className="giq-icon-plate mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        No organizations linked
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
        Ask an organization owner to create an invitation for your verified account email.
      </p>
    </div>
  );
}

function UnavailableState() {
  return (
    <section className={PANEL_CLASS}>
      <div className="giq-dashed-panel px-5 py-10 text-center sm:px-8" role="status">
        <div className="giq-icon-plate mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
          <Users className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
          Teams are temporarily unavailable
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
          No membership was changed. Refresh this page in a moment to try again.
        </p>
      </div>
    </section>
  );
}
