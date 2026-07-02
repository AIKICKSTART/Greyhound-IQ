import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHero } from "@/components/page-hero";
import { requireCurrentUserProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account security - GreyhoundIQ",
  description:
    "Review the safe local security fields for your GreyhoundIQ account.",
};

const PANEL_CLASS = "giq-panel p-6";
const ACTION_CLASS = "giq-outline-action";
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
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Account
            <br />
            <span className="gradient-text">security.</span>
          </>
        }
        subtitle="WorkOS handles sign-in and session security; GreyhoundIQ only shows safe local account fields here."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to account
        </Link>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className={PANEL_CLASS}>
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
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
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
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
                className="giq-liquid-purple-button min-h-10 px-4 text-[13px] font-semibold"
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
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <span className="text-[hsl(var(--subtle-foreground))]">{label}</span>
      <span className="text-right font-semibold text-[hsl(var(--foreground))]">
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
