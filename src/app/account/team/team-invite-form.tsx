"use client";

import { Check, Copy, Link2, Send } from "lucide-react";
import { useActionState, useState } from "react";

import {
  createTeamInvitationAction,
  type TeamInviteActionState,
} from "@/app/account/team/actions";

const INITIAL_STATE: TeamInviteActionState = {
  status: "idle",
  message: "",
};

export function TeamInviteForm({
  organizationId,
  canInviteAdmin,
}: {
  organizationId: string;
  canInviteAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createTeamInvitationAction,
    INITIAL_STATE,
  );
  const [copied, setCopied] = useState(false);

  async function copyInvitationLink() {
    if (!state.invitationPath) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${state.invitationPath}`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="giq-dashed-panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="giq-icon-plate flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Send className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
            Invite a team member
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
            The link expires after 72 hours and only the invited account email
            can accept it.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
            Account email
          </span>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            className="giq-input min-h-11"
            placeholder="member@example.com"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
            Role
          </span>
          <select name="role" className="giq-input min-h-11" defaultValue="member">
            <option value="member">Member</option>
            {canInviteAdmin ? <option value="admin">Administrator</option> : null}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="giq-button giq-button-primary min-h-11 self-end px-4 text-[12px] disabled:cursor-wait disabled:opacity-65"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {pending ? "Creating..." : "Create invite"}
        </button>
      </form>

      <div
        className={`mt-3 rounded-xl border px-3 py-2.5 text-[12px] leading-5 ${
          state.status === "error"
            ? "border-red-400/25 bg-red-500/10 text-red-100"
            : state.status === "success"
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
              : "sr-only"
        }`}
        role={state.status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {state.message}
      </div>

      {state.status === "success" && state.invitationPath ? (
        <div className="mt-3 rounded-xl border border-white/[0.09] bg-black/15 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                One-time invitation link
              </p>
              <code className="mt-1 block truncate text-[12px] text-[hsl(var(--foreground))]">
                {state.invitationPath}
              </code>
              {state.expiresAt ? (
                <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Expires {new Date(state.expiresAt).toLocaleString("en-AU")}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={copyInvitationLink}
              className="giq-outline-action shrink-0"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
