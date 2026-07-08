import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { ADMIN_NAV } from "@/app/admin/admin-nav-data";
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

// Queues an admin actually needs to work down, surfaced up top.
const PRIORITY = [
  { key: "pendingListings", label: "Pending listings", href: "/admin/listings" },
  { key: "openReports", label: "Open reports", href: "/admin/reports" },
  { key: "openSafetyFlags", label: "Open safety flags", href: "/admin/safety" },
] as const;

// Count keys are sourced from getAdminCounts's return shape (below), so there is
// one list to keep in sync, not two.
type AdminCounts = Awaited<ReturnType<typeof getAdminCounts>>;
type CountKey = keyof AdminCounts;

export default async function AdminPage() {
  await requireModeratorProfile();
  const counts = await cached("admin:dashboard:counts", 120_000, getAdminCounts);

  const sections = ADMIN_NAV.filter((group) => group.title !== "Overview");

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Dashboard"
        description="Operational snapshot across every admin domain. Pick a section from the sidebar, or jump straight from a card below."
      />

      <section aria-label="Needs attention" className="mb-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {PRIORITY.map((item) => {
            const value = counts[item.key];
            const attention = typeof value === "number" && value > 0;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`giq-panel giq-panel-hover flex items-center justify-between gap-4 p-5 ${
                  attention
                    ? "border-amber-300/40 bg-amber-300/[0.06]"
                    : ""
                }`}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
                    {attention ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                    ) : null}
                    {item.label}
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-[hsl(var(--foreground))]">
                    {formatCount(value)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </Link>
            );
          })}
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
                    className="giq-panel giq-panel-hover group flex flex-col gap-2 p-5"
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
