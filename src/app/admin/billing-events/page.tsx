import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminStatusForm } from "@/app/admin/form-controls";
import { requireAdminProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin billing events - GreyhoundIQ",
  description: "Read-only GreyhoundIQ billing event overview.",
};

type BillingEventRow = {
  id: string;
  userId: string | null;
  billingCustomerId: string | null;
  subscriptionId: string | null;
  invoiceRecordId: string | null;
  eventType: string;
  status: string;
  occurredAt: Date;
  createdAt: Date;
};

export default async function AdminBillingEventsPage() {
  await requireAdminProfile();
  const events = await getBillingEvents();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <AdminPageHeader
        title="Billing events"
        description="Latest 20 local billing event records. Provider event identifiers and raw payloads are not displayed here."
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell overflow-x-auto">
          <table className="w-full min-w-[1480px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Event ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Billing customer ID</th>
                <th className="px-4 py-3 text-left">Subscription ID</th>
                <th className="px-4 py-3 text-left">Invoice record ID</th>
                <th className="px-4 py-3 text-left">Event type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Occurred</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No billing events found.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-t border-white/[0.06]">
                    <MonoCell>{event.id}</MonoCell>
                    <MonoCell>{event.userId ?? "No user"}</MonoCell>
                    <MonoCell>
                      {event.billingCustomerId ?? "No customer"}
                    </MonoCell>
                    <MonoCell>{event.subscriptionId ?? "No subscription"}</MonoCell>
                    <MonoCell>{event.invoiceRecordId ?? "No invoice"}</MonoCell>
                    <MonoCell>{event.eventType}</MonoCell>
                    <TextCell>{event.status}</TextCell>
                    <DateCell date={event.occurredAt} />
                    <DateCell date={event.createdAt} />
                    <td className="px-4 py-3">
                      <AdminStatusForm
                        resource="billingEvent"
                        id={event.id}
                        currentStatus={event.status}
                        statuses={["recorded", "processed", "failed", "ignored"]}
                        path="/admin/billing-events"
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

function getBillingEvents() {
  return safeQuery<BillingEventRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.billingEvent.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
          select: {
            id: true,
            userId: true,
            billingCustomerId: true,
            subscriptionId: true,
            invoiceRecordId: true,
            eventType: true,
            status: true,
            occurredAt: true,
            createdAt: true,
          },
        })
      ),
    []
  );
}

function MonoCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function TextCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function DateCell({ date }: { date: Date }) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
      {formatDateTime(date)}
    </td>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
