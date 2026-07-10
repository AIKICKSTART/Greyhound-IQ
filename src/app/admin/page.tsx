import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { ADMIN_NAV } from "@/app/admin/admin-nav-data";
import { BarList, Sparkline } from "@/components/admin/charts";
import { getAdminReporting } from "@/lib/admin-reporting";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";
import { cached } from "@/lib/ttl-cache";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin - GreyhoundIQ",
  description: "Read-only GreyhoundIQ administration overview.",
};

// Maps a nav route to the dashboard count it should surface (label + value key).
const ROUTE_COUNT: Partial<Record<string, { key: CountKey; label: string }>> = {
  "/admin/users": { key: "users", label: "users" },
  "/admin/organizations": { key: "invitations", label: "invitations" },
  "/admin/invitations": { key: "invitations", label: "invitations" },
  "/admin/account-deletion": { key: "deletionJobs", label: "deletion jobs" },
  "/admin/plans": { key: "plans", label: "plans" },
  "/admin/subscriptions": { key: "subscriptions", label: "subscriptions" },
  "/admin/invoices": { key: "invoiceRecords", label: "invoices" },
  "/admin/payments": { key: "paymentRecords", label: "payments" },
  "/admin/billing": { key: "billingCustomers", label: "customers" },
  "/admin/reports": { key: "openReports", label: "open" },
  "/admin/safety": { key: "openSafetyFlags", label: "open flags" },
  "/admin/listings": { key: "pendingListings", label: "pending" },
  "/admin/feed": { key: "feedPosts", label: "posts" },
  "/admin/feedback": { key: "feedback", label: "items" },
  "/admin/bug-reports": { key: "bugReports", label: "reports" },
  "/admin/retention": { key: "retentionPolicies", label: "policies" },
  "/admin/exports": { key: "exportArtifacts", label: "artifacts" },
  "/admin/actions": { key: "adminActions", label: "actions" },
  "/admin/jobs": { key: "jobRuns", label: "job runs" },
  "/admin/webhooks": { key: "webhookEvents", label: "events" },
  "/admin/usage": { key: "usageAggregates", label: "aggregates" },
  "/admin/source-health": { key: "dataSourceHealth", label: "sources" },
};

// Count keys are sourced from getAdminCounts's return shape (below), so there is
// one list to keep in sync, not two.
type AdminCounts = Awaited<ReturnType<typeof getAdminCounts>>;
type CountKey = keyof AdminCounts;

const audCurrency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export default async function AdminPage() {
  await requireModeratorProfile();
  const [counts, reporting] = await Promise.all([
    cached("admin:dashboard:counts", 120_000, getAdminCounts),
    cached("admin:dashboard:reporting", 120_000, getAdminReporting),
  ]);

  const sections = ADMIN_NAV.filter((group) => group.title !== "Overview");

  // Queues an admin actually needs to work down, surfaced up top.
  const queues = [
    { label: "Pending listings", href: "/admin/listings", value: counts.pendingListings },
    { label: "Open reports", href: "/admin/reports", value: counts.openReports },
    { label: "Safety flags", href: "/admin/safety", value: counts.openSafetyFlags },
    { label: "Ownership claims", href: "/admin/dog-ownership", value: reporting.pendingOwnership },
    { label: "Support tickets", href: "/admin/support", value: reporting.openSupport },
  ];
  const queueTotal = queues.reduce((sum, q) => sum + (q.value ?? 0), 0);
  const signupsLast7 = reporting.signupsByDay.values.slice(-7).reduce((a, b) => a + b, 0);
  const payingUsers = reporting.subscriptionTiers
    .filter((tier) => tier.label !== "free")
    .reduce((sum, tier) => sum + tier.value, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <AdminPageHeader
        title="Dashboard"
        description="Operational snapshot across every admin domain. Pick a section from the sidebar, or jump straight from a card below."
      />

      <section aria-label="Key metrics" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Users"
          value={formatCount(counts.users)}
          hint={
            reporting.seriesAvailable
              ? `+${signupsLast7.toLocaleString("en-AU")} in the last 7 days`
              : "Signup trend unavailable"
          }
        >
          {reporting.seriesAvailable ? (
            <Sparkline
              values={reporting.signupsByDay.values}
              className="mt-3 h-11 w-full text-[hsl(var(--primary-light))]"
            />
          ) : null}
        </KpiCard>
        <KpiCard
          label="Revenue (30d)"
          value={
            reporting.seriesAvailable
              ? audCurrency.format(reporting.revenueCentsByDay.total / 100)
              : "Unavailable"
          }
          hint="Succeeded payments, Sydney days"
        >
          {reporting.seriesAvailable ? (
            <Sparkline
              values={reporting.revenueCentsByDay.values}
              className="mt-3 h-11 w-full text-[hsl(var(--secondary))]"
            />
          ) : null}
        </KpiCard>
        <KpiCard
          label="Paying users"
          value={
            reporting.subscriptionTiers.length > 0
              ? payingUsers.toLocaleString("en-AU")
              : "Unavailable"
          }
          hint={`${formatCount(counts.subscriptions)} subscription records`}
        />
        <KpiCard
          label="Review queue"
          value={queueTotal.toLocaleString("en-AU")}
          hint="Listings, reports, flags, claims, tickets"
        />
      </section>

      <section aria-labelledby="admin-attention-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="admin-attention-heading"
              className="text-xl font-semibold text-[hsl(var(--foreground))]"
            >
              Needs attention
            </h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Work through active moderation and member-support queues.
            </p>
          </div>
          <span className="giq-badge giq-badge-gold">
            {queueTotal.toLocaleString("en-AU")} queued
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {queues.map((item) => {
            const attention = typeof item.value === "number" && item.value > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`giq-panel giq-panel-hover flex min-h-20 items-center justify-between gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] ${
                  attention ? "border-amber-300/40 bg-amber-300/[0.06]" : ""
                }`}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
                    {attention ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                    ) : null}
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
                    {formatCount(item.value)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="admin-reporting-heading" className="mb-8 grid gap-3 lg:grid-cols-2">
        <div className="mb-1 lg:col-span-2">
          <h2
            id="admin-reporting-heading"
            className="text-xl font-semibold text-[hsl(var(--foreground))]"
          >
            Reporting snapshot
          </h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            Thirty-day membership, revenue, and marketplace trends.
          </p>
        </div>
        <ChartPanel
          title="Signups"
          hint={
            reporting.seriesAvailable
              ? `${reporting.signupsByDay.total.toLocaleString("en-AU")} in the last 30 days`
              : "Unavailable"
          }
        >
          {reporting.seriesAvailable ? (
            <Sparkline
              values={reporting.signupsByDay.values}
              height={72}
              className="h-[72px] w-full text-[hsl(var(--primary-light))]"
            />
          ) : (
            <ChartUnavailable />
          )}
        </ChartPanel>
        <ChartPanel
          title="Revenue"
          hint={
            reporting.seriesAvailable
              ? `${audCurrency.format(reporting.revenueCentsByDay.total / 100)} in the last 30 days`
              : "Unavailable"
          }
        >
          {reporting.seriesAvailable ? (
            <Sparkline
              values={reporting.revenueCentsByDay.values}
              height={72}
              className="h-[72px] w-full text-[hsl(var(--secondary))]"
            />
          ) : (
            <ChartUnavailable />
          )}
        </ChartPanel>
        <ChartPanel title="Listings by status" hint="All marketplace listings">
          <BarList items={reporting.listingsByStatus} />
        </ChartPanel>
        <ChartPanel title="Subscription tiers" hint="All users by tier">
          <BarList
            items={reporting.subscriptionTiers}
            barClassName="bg-[hsl(var(--secondary))]"
          />
        </ChartPanel>
      </section>

      <section aria-labelledby="admin-health-heading" className="mb-8">
        <div className="mb-3">
          <h2
            id="admin-health-heading"
            className="text-xl font-semibold text-[hsl(var(--foreground))]"
          >
            System health
          </h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            Live operational signals from platform services and ingestion jobs.
          </p>
        </div>
        <div className="giq-panel grid gap-6 p-4 sm:p-6 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
              Platform
            </h3>
            <ul className="grid gap-2.5 text-[13px]">
              <HealthRow
                label="Database"
                status={counts.users === null ? "failed" : "ok"}
                detail={counts.users === null ? "Queries failing" : "Queries responding"}
              />
              <HealthRow
                label="Webhooks"
                status={reporting.latestWebhook?.status ?? "unknown"}
                detail={
                  reporting.latestWebhook
                    ? `Last received ${timeAgo(reporting.latestWebhook.receivedAt)}`
                    : "No events recorded"
                }
              />
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
              Data sources
            </h3>
            {reporting.sources.length === 0 ? (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                No sources tracked.{" "}
                <Link
                  href="/admin/source-health"
                  className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
                >
                  Source health
                </Link>
              </p>
            ) : (
              <ul className="grid gap-2.5 text-[13px]">
                {reporting.sources.map((source) => (
                  <HealthRow
                    key={source.sourceProvider}
                    label={source.sourceProvider}
                    status={source.status}
                    detail={
                      source.lastSuccessAt
                        ? `Last success ${timeAgo(source.lastSuccessAt)}`
                        : "No successful sync yet"
                    }
                  />
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
              Recent jobs
            </h3>
            {reporting.recentJobs.length === 0 ? (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                No job runs recorded.
              </p>
            ) : (
              <ul className="grid gap-2.5 text-[13px]">
                {reporting.recentJobs.map((job) => (
                  <HealthRow
                    key={job.id}
                    label={job.name}
                    status={job.status}
                    detail={timeAgo(job.completedAt ?? job.createdAt)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-8">
        {sections.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
              {group.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => {
                const count = ROUTE_COUNT[item.href];
                const value = count ? counts[count.key] : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="giq-panel giq-panel-hover group flex min-h-28 flex-col gap-2 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
                        {item.label}
                      </span>
                      {count ? (
                        <span className="shrink-0 text-right">
                          <span className="block text-[20px] font-semibold leading-none text-[hsl(var(--foreground))]">
                            {formatCount(value)}
                          </span>
                          <span className="text-[11px] text-[hsl(var(--subtle-foreground))]">
                            {count.label}
                          </span>
                        </span>
                      ) : (
                        <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {item.blurb}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="giq-panel flex flex-col p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold text-[hsl(var(--foreground))]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

function ChartPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="giq-panel p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
          {title}
        </h3>
        {hint ? (
          <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ChartUnavailable() {
  return (
    <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
      Data unavailable right now.
    </p>
  );
}

function HealthRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: string;
  detail?: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDot(status)}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-[hsl(var(--foreground))]">{label}</span>
          <span className="text-[11px] uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
            {status}
          </span>
        </p>
        {detail ? (
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">{detail}</p>
        ) : null}
      </div>
    </li>
  );
}

const HEALTHY_STATUSES = new Set([
  "ok",
  "healthy",
  "succeeded",
  "success",
  "completed",
  "processed",
  "active",
]);
const FAILED_STATUSES = new Set(["failed", "error", "down", "unhealthy"]);

function statusDot(status: string) {
  const normalized = status.toLowerCase();
  if (HEALTHY_STATUSES.has(normalized)) return "bg-emerald-400";
  if (FAILED_STATUSES.has(normalized)) return "bg-red-400";
  return "bg-amber-300";
}

const relativeTime = new Intl.RelativeTimeFormat("en-AU", { numeric: "auto" });

function timeAgo(date: Date) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relativeTime.format(seconds, "second");
  if (abs < 3600) return relativeTime.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relativeTime.format(Math.round(seconds / 3600), "hour");
  return relativeTime.format(Math.round(seconds / 86_400), "day");
}

async function getAdminCounts() {
  const [
    users,
    invitations,
    billingCustomers,
    plans,
    subscriptions,
    termsAcceptances,
    consentEvents,
    marketingPreferences,
    retentionPolicies,
    deletionJobs,
    feedback,
    bugReports,
    webhookEvents,
    invoiceRecords,
    paymentRecords,
    usageOutbox,
    usageAggregates,
    agentRunUsage,
    adminActions,
    pendingListings,
    openReports,
    openSafetyFlags,
    bannedPhrases,
    feedTopics,
    feedPosts,
    jobRuns,
    exportArtifacts,
    dataSourceHealth,
  ] = await Promise.all([
    countRows(() => withDbSystemContext((tx) => tx.user.count())),
    countRows(() => withDbSystemContext((tx) => tx.organizationInvitation.count())),
    countRows(() => withDbSystemContext((tx) => tx.billingCustomer.count())),
    countRows(() => withDbSystemContext((tx) => tx.plan.count())),
    countRows(() => withDbSystemContext((tx) => tx.subscription.count())),
    countRows(() => withDbSystemContext((tx) => tx.termsAcceptance.count())),
    countRows(() => withDbSystemContext((tx) => tx.consentEvent.count())),
    countRows(() => withDbSystemContext((tx) => tx.marketingPreference.count())),
    countRows(() => withDbSystemContext((tx) => tx.retentionPolicy.count())),
    countRows(() => withDbSystemContext((tx) => tx.deletionJob.count())),
    countRows(() => withDbSystemContext((tx) => tx.feedback.count())),
    countRows(() => withDbSystemContext((tx) => tx.bugReport.count())),
    countRows(() => withDbSystemContext((tx) => tx.webhookEvent.count())),
    countRows(() => withDbSystemContext((tx) => tx.invoiceRecord.count())),
    countRows(() => withDbSystemContext((tx) => tx.paymentRecord.count())),
    countRows(() => withDbSystemContext((tx) => tx.usageOutbox.count())),
    countRows(() => withDbSystemContext((tx) => tx.usageAggregate.count())),
    countRows(() => withDbSystemContext((tx) => tx.agentRunUsage.count())),
    countRows(() => withDbSystemContext((tx) => tx.adminAction.count())),
    countRows(() =>
      withDbSystemContext((tx) =>
        tx.listing.count({ where: { status: "pending_review" } })
      )
    ),
    countRows(() =>
      withDbSystemContext((tx) => tx.report.count({ where: { status: "open" } }))
    ),
    countRows(() =>
      withDbSystemContext((tx) =>
        tx.trustSafetyFlag.count({ where: { status: "open" } })
      )
    ),
    countRows(() => withDbSystemContext((tx) => tx.bannedPhrase.count())),
    countRows(() => withDbSystemContext((tx) => tx.feedTopic.count())),
    countRows(() => withDbSystemContext((tx) => tx.feedPost.count())),
    countRows(() => withDbSystemContext((tx) => tx.jobRun.count())),
    countRows(() => withDbSystemContext((tx) => tx.exportArtifact.count())),
    countRows(() => withDbSystemContext((tx) => tx.dataSourceHealth.count())),
  ]);

  return {
    users,
    invitations,
    billingCustomers,
    plans,
    subscriptions,
    termsAcceptances,
    consentEvents,
    marketingPreferences,
    retentionPolicies,
    deletionJobs,
    feedback,
    bugReports,
    webhookEvents,
    invoiceRecords,
    paymentRecords,
    usageOutbox,
    usageAggregates,
    agentRunUsage,
    adminActions,
    pendingListings,
    openReports,
    openSafetyFlags,
    bannedPhrases,
    feedTopics,
    feedPosts,
    jobRuns,
    exportArtifacts,
    dataSourceHealth,
  };
}

function countRows(fn: () => Promise<number>) {
  return safeQuery<number | null>(fn, null);
}

function formatCount(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString("en-AU");
}
