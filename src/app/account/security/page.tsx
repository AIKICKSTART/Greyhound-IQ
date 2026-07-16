import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireCurrentUserProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account security - GreyhoundIQ",
  description:
    "Review the safe local security fields for your GreyhoundIQ account.",
};

const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const ACTION_CLASS =
  "giq-outline-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]";
const TIER_LABELS = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
} as const;
const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Australia/Sydney",
});

type SecurityAccount = Pick<
  CurrentUserProfile,
  "deletionRequestedAt" | "email" | "profileRole" | "tier"
>;

export default async function AccountSecurityPage() {
  const account = await requireSecurityAccount();

  return (
    <div>
      <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
          <div className="max-w-2xl">
            <p className="program-label">Account settings</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
              Security
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
              WorkOS protects sign-in and sessions; GreyhoundIQ shows only safe
              local account details.
            </p>
          </div>
          <Link href="/account" className={ACTION_CLASS}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to account
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
          <section className={PANEL_CLASS}>
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                Local account fields
              </h2>
            </div>

            <div className="space-y-3 text-[14px]">
              <InfoRow label="Email" value={account.email} />
              <InfoRow label="Tier" value={TIER_LABELS[account.tier]} />
              <InfoRow
                label="Profile role"
                value={formatLabel(account.profileRole)}
              />
              <InfoRow
                label="Deletion requested"
                value={formatOptionalDate(account.deletionRequestedAt)}
              />
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <div className="mb-5 flex items-center gap-3">
              <Lock className="h-5 w-5 text-[hsl(var(--secondary))]" />
              <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                Identity handoff
              </h2>
            </div>
            <p className="text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Use WorkOS sign-in for identity and access changes. GreyhoundIQ
              does not display WorkOS identifiers, tokens, cookies, or session
              internals on this page.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/sign-in"
                className="giq-liquid-purple-button min-h-11 px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
              >
                Open sign-in
              </a>
              <Link href="/account/privacy" className={ACTION_CLASS}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Privacy records
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

async function requireSecurityAccount(): Promise<SecurityAccount> {
  try {
    const current = await requireCurrentUserProfile();
    return {
      deletionRequestedAt: current.deletionRequestedAt,
      email: current.email,
      profileRole: current.profileRole,
      tier: current.tier,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "auth.unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start justify-between gap-1.5 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-[hsl(var(--subtle-foreground))]">{label}</span>
      <span className="min-w-0 break-all font-semibold text-[hsl(var(--foreground))] sm:text-right">
        {value}
      </span>
    </div>
  );
}

function formatOptionalDate(value: Date | null) {
  return value ? DATE_FORMATTER.format(value) : "Not requested";
}

function formatLabel(value: string) {
  const text = value.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
