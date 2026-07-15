import { Check, Clock3, ShieldCheck, X } from "lucide-react";

import { decideTeamInvitationAction } from "@/app/account/team/actions";
import { SubmitButton } from "@/components/submit-button";
import type { TeamInvitationPreview } from "@/lib/organization-team-service";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TeamInvitationReview({
  invitation,
  token,
}: {
  invitation: TeamInvitationPreview | null;
  token: string;
}) {
  if (!invitation) {
    return (
      <section className="giq-panel mb-5 p-5 sm:p-6" role="alert">
        <div className="flex items-start gap-3">
          <div className="giq-icon-plate flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
              Invitation unavailable
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
              The link is invalid, belongs to another account email, or could
              not be checked safely. No team access was changed.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="giq-panel mb-5 p-5 sm:p-6" aria-labelledby="team-invitation-heading">
      <div className="flex items-start gap-3">
        <div className="giq-icon-plate flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="program-label">Protected team invitation</p>
          <h2
            id="team-invitation-heading"
            className="mt-2 text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl"
          >
            {invitation.organizationName}
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
            This invitation grants {formatLabel(invitation.role)} access and is
            bound to your authenticated account email.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
            Role
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[hsl(var(--foreground))]">
            {formatLabel(invitation.role)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
            Expires
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-[hsl(var(--foreground))]">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {DATE_FORMATTER.format(invitation.expiresAt)}
          </p>
        </div>
      </div>

      {invitation.status === "pending" ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <form action={decideTeamInvitationAction} className="flex-1">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="decision" value="accept" />
            <SubmitButton
              pendingLabel="Accepting..."
              className="giq-button giq-button-primary min-h-11 w-full justify-center px-5 text-[13px]"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Accept invitation
            </SubmitButton>
          </form>
          <form action={decideTeamInvitationAction} className="flex-1">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="decision" value="reject" />
            <SubmitButton
              pendingLabel="Declining..."
              className="giq-outline-action min-h-11 w-full justify-center px-5 text-[13px]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Decline invitation
            </SubmitButton>
          </form>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-[13px] leading-5 text-[hsl(var(--muted-foreground))]">
          This invitation is {formatLabel(invitation.status)} and cannot be used
          again.
        </div>
      )}
    </section>
  );
}

function formatLabel(value: string) {
  const cleaned = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "Unknown";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
