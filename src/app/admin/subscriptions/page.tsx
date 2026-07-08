import { AdminStatusForm } from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

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
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Subscriptions"
        description="Latest 20 local subscription rows. Private billing-provider identifiers and payload snapshots are excluded."
      />

      <section className="giq-panel p-6">
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
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
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
                    <td className="px-4 py-3">
                      <AdminStatusForm
                        resource="subscription"
                        id={subscription.id}
                        currentStatus={subscription.status}
                        statuses={["active", "past_due", "paused", "canceled", "ended"]}
                        path="/admin/subscriptions"
                      />
                    </td>
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
      withDbSystemContext((tx) =>
        tx.subscription.findMany({
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
        })
      ),
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
