import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin subscriptions - GreyhoundIQ",
  description: "Read-only GreyhoundIQ subscription overview.",
};

type SubscriptionRow = {
  id: string;
  userId: string | null;
  billingCustomerId: string | null;
  planCode: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminSubscriptionsPage() {
  await requireModeratorProfile();
  const subscriptions = await getSubscriptions();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/admin" className="giq-outline-action mb-6 w-fit">
        Back to admin
      </Link>

      <section className="giq-panel p-6">
        <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
          Subscriptions
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 local subscription rows. Private billing-provider
          identifiers and payload snapshots are excluded.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1280px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Subscription ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Billing customer ID</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Period end</th>
                <th className="px-4 py-3 text-left">Canceled</th>
                <th className="px-4 py-3 text-left">Ended</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                subscriptions.map((subscription) => (
                  <tr
                    key={subscription.id}
                    className="border-t border-white/[0.06]"
                  >
                    <MonoCell>{subscription.id}</MonoCell>
                    <MonoCell>{subscription.userId ?? "No user"}</MonoCell>
                    <MonoCell>
                      {subscription.billingCustomerId ?? "No customer"}
                    </MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {subscription.planCode ?? "No plan"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {subscription.status}
                    </td>
                    <DateCell
                      date={subscription.currentPeriodEnd}
                      emptyLabel="No period end"
                    />
                    <DateCell
                      date={subscription.canceledAt}
                      emptyLabel="Not canceled"
                    />
                    <DateCell date={subscription.endedAt} emptyLabel="Not ended" />
                    <DateCell
                      date={subscription.createdAt}
                      emptyLabel="Not recorded"
                    />
                    <DateCell
                      date={subscription.updatedAt}
                      emptyLabel="Not recorded"
                    />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
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

function getSubscriptions() {
  return safeQuery<SubscriptionRow[]>(
    () =>
      prisma.subscription.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          userId: true,
          billingCustomerId: true,
          planCode: true,
          status: true,
          currentPeriodEnd: true,
          canceledAt: true,
          endedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    []
  );
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
