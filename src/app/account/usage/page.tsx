import Link from "next/link";
import { ArrowLeft, BarChart3, Crown, Lock, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { PageTitle } from "@/components/page-title";
import { getCurrentUser } from "@/lib/auth";
import { getEntitlementLimitsForCurrentUser } from "@/lib/billing/entitlement-service";
import {
  BILLING_TIER_LABELS,
  formatUsageLimitDisplay,
} from "@/lib/billing/usage-display";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account usage - GreyhoundIQ",
  description: "Review your current GreyhoundIQ tier limits.",
};

const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const ACTION_CLASS = "giq-outline-action";

type UsageEventRow = {
  metricKey: string;
  quantity: number;
  status: string;
  occurredAt: Date;
  processedAt: Date | null;
  failedAt: Date | null;
};

export default async function AccountUsagePage() {
  const user = await getCurrentUser();

  return (
    <div>
      {user ? (
        <UsageMemberHeader tier={user.tier} />
      ) : (
        <PageHero
          image="/images/feature-advanced-stats-green.webp"
          title={
            <>
              Account
              <br />
              <span className="gradient-text">usage.</span>
            </>
          }
          subtitle="Current tier limits for your GreyhoundIQ account."
        />
      )}

      <section
        className={
          user
            ? "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
            : "mx-auto max-w-5xl px-6 py-12"
        }
      >
        {user ? (
          <SignedInUsage user={user} />
        ) : (
          <>
            <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to account
            </Link>
            <SignedOutUsage />
          </>
        )}
      </section>
    </div>
  );
}

function UsageMemberHeader({
  tier,
}: {
  tier: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>["tier"];
}) {
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
            Usage
          </PageTitle>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            See your current tier limits and recent account usage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="giq-status-pill giq-status-pill-purple min-h-8 px-3"
            aria-label={`Current tier ${BILLING_TIER_LABELS[tier]}`}
          >
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            {BILLING_TIER_LABELS[tier]}
          </span>
          <Link href="/account" className={ACTION_CLASS}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to account
          </Link>
        </div>
      </div>
    </header>
  );
}

async function SignedInUsage({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}) {
  const [entitlements, usageEvents] = await Promise.all([
    getEntitlementLimitsForCurrentUser(user),
    getUsageEventsForUser(user),
  ]);
  const limits = formatUsageLimitDisplay(entitlements);

  return (
    <div className="grid gap-6">
      <section className={PANEL_CLASS}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Crown
                className="h-5 w-5 text-[hsl(var(--secondary))]"
                aria-hidden="true"
              />
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
            className="giq-liquid-purple-button w-full px-4 text-[13px] font-semibold sm:w-auto"
          >
            Manage tier
          </Link>
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <div className="mb-5 flex items-center gap-3">
          <BarChart3
            className="h-5 w-5 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
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

      <UsageEventsTable rows={usageEvents} />
    </div>
  );
}

function UsageEventsTable({ rows }: { rows: UsageEventRow[] | null }) {
  return (
    <section className={PANEL_CLASS}>
      <div className="mb-5 flex items-center gap-3">
        <BarChart3
          className="h-5 w-5 text-[hsl(var(--primary-bright))]"
          aria-hidden="true"
        />
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
          Recent usage events
        </h2>
      </div>

      <div
        role="region"
        aria-label="Recent usage events"
        tabIndex={0}
        className="giq-table-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
      >
        <table className="w-full min-w-[760px]">
          <caption className="sr-only">
            The ten most recent usage events for this account
          </caption>
          <thead>
            <tr className="giq-table-head">
              <th scope="col" className="px-4 py-3 text-left">Metric</th>
              <th scope="col" className="px-4 py-3 text-left">Quantity</th>
              <th scope="col" className="px-4 py-3 text-left">Status</th>
              <th scope="col" className="px-4 py-3 text-left">Occurred</th>
              <th scope="col" className="px-4 py-3 text-left">Processed</th>
              <th scope="col" className="px-4 py-3 text-left">Failed</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                >
                  <span className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <BarChart3
                      className="h-6 w-6 text-[hsl(var(--primary-bright))]"
                      aria-hidden="true"
                    />
                    <strong className="text-[14px] text-[hsl(var(--foreground))]">
                      Usage history is temporarily unavailable
                    </strong>
                    Your usage records have not been removed. Refresh this page
                    in a moment to try again.
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                >
                  <span className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <BarChart3
                      className="h-6 w-6 text-[hsl(var(--primary-bright))]"
                      aria-hidden="true"
                    />
                    <strong className="text-[14px] text-[hsl(var(--foreground))]">
                      No usage events yet
                    </strong>
                    Usage activity will appear here after a tracked feature is used.
                  </span>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`${row.metricKey}-${row.occurredAt.toISOString()}-${index}`}
                  className="giq-table-row"
                >
                  <MonoCell>{row.metricKey}</MonoCell>
                  <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                    {formatCount(row.quantity)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                    {row.status}
                  </td>
                  <DateCell date={row.occurredAt} emptyLabel="Not recorded" />
                  <DateCell date={row.processedAt} emptyLabel="Not processed" />
                  <DateCell date={row.failedAt} emptyLabel="Not failed" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MonoCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function DateCell({
  date,
  emptyLabel,
}: {
  date: Date | null;
  emptyLabel: string;
}) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
      {formatDateTime(date, emptyLabel)}
    </td>
  );
}

function getUsageEventsForUser(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
  if (!user.dbUserId || !user.profileId) return Promise.resolve([]);
  const userId = user.dbUserId;

  return safeQuery<UsageEventRow[] | null>(
    () =>
      withDbRequestContext(
        {
          dbUserId: user.dbUserId!,
          profileId: user.profileId!,
          profileRole: user.role ?? "member",
          tier: user.tier,
        },
        (tx) =>
          tx.usageEvent.findMany({
            where: { userId },
            orderBy: { occurredAt: "desc" },
            take: 10,
            select: {
              metricKey: true,
              quantity: true,
              status: true,
              occurredAt: true,
              processedAt: true,
              failedAt: true,
            },
          })
      ),
    null
  );
}

function formatCount(value: number) {
  return value.toLocaleString("en-AU");
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
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
        <a
          href="/sign-in"
          className="giq-liquid-purple-button px-5 text-[13px] font-semibold"
        >
          Sign in
        </a>
        <Link href="/pricing" className={ACTION_CLASS}>
          <ShieldCheck className="h-3.5 w-3.5" />
          View plans
        </Link>
      </div>
    </div>
  );
}
