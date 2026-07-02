import Link from "next/link";
import { ArrowLeft, BarChart3, Crown, Lock, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getCurrentUser } from "@/lib/auth";
import { getEntitlementLimitsForCurrentUser } from "@/lib/billing/entitlement-service";
import {
  BILLING_TIER_LABELS,
  formatUsageLimitDisplay,
} from "@/lib/billing/usage-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account usage - GreyhoundIQ",
  description: "Review your current GreyhoundIQ tier limits.",
};

const PANEL_CLASS = "giq-panel p-6";
const ACTION_CLASS = "giq-outline-action";

export default async function AccountUsagePage() {
  const user = await getCurrentUser();

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Account
            <br />
            <span className="gradient-text">usage.</span>
          </>
        }
        subtitle="Current tier limits for your GreyhoundIQ account."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to account
        </Link>

        {!user ? <SignedOutUsage /> : <SignedInUsage user={user} />}
      </section>
    </div>
  );
}

async function SignedInUsage({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}) {
  const entitlements = await getEntitlementLimitsForCurrentUser(user);
  const limits = formatUsageLimitDisplay(entitlements);

  return (
    <div className="grid gap-6">
      <section className={PANEL_CLASS}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Crown className="h-5 w-5 text-[hsl(var(--secondary))]" />
              <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Current tier
              </p>
            </div>
            <h2 className="text-3xl font-semibold text-[hsl(var(--foreground))]">
              {BILLING_TIER_LABELS[user.tier]}
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              These limits come from your latest local entitlement snapshot,
              with tier defaults used when no active snapshot exists.
            </p>
          </div>
          <Link
            href="/pricing"
            className="giq-liquid-purple-button min-h-10 px-4 text-[13px] font-semibold"
          >
            Manage tier
          </Link>
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <div className="mb-5 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Limits
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {limits.map((limit) => (
            <div
              key={limit.key}
              className="giq-subpanel flex items-center justify-between gap-4 p-4"
            >
              <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
                {limit.label}
              </span>
              <span className="text-right text-[14px] font-semibold text-[hsl(var(--foreground))]">
                {limit.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SignedOutUsage() {
  return (
    <div className={PANEL_CLASS}>
      <Lock className="mb-4 h-7 w-7 text-[hsl(var(--primary-bright))]" />
      <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
        Sign in to view usage limits
      </h2>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        Usage limits are tied to the active tier on your GreyhoundIQ account.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/sign-in"
          className="giq-liquid-purple-button px-5 text-[13px] font-semibold"
        >
          Sign in
        </Link>
        <Link href="/pricing" className={ACTION_CLASS}>
          <ShieldCheck className="h-3.5 w-3.5" />
          View plans
        </Link>
      </div>
    </div>
  );
}
