import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminStatusForm } from "@/app/admin/form-controls";
import { StatusPill } from "@/components/admin/status-pill";
import { requireAdminProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin webhooks - GreyhoundIQ",
  description: "Read-only GreyhoundIQ webhook event overview.",
};

type WebhookEventRow = {
  id: string;
  eventType: string;
  status: string;
  retryCount: number;
  receivedAt: Date;
  processedAt: Date | null;
};

type WebhookStatusCountRow = {
  status: string;
  _count: { _all: number };
};

export default async function AdminWebhooksPage() {
  await requireAdminProfile();
  const [events, statusCounts] = await Promise.all([
    getWebhookEvents(),
    getWebhookStatusCounts(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Webhook events"
        description="Latest 10 stored webhook events from the local database."
      />

      <section className="giq-panel p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statusCounts.length === 0 ? (
            <div className="giq-metric-card">
              <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                No statuses
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[hsl(var(--foreground))]">
                0
              </p>
            </div>
          ) : (
            statusCounts.map((row) => (
              <div key={row.status} className="giq-metric-card">
                <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  {row.status}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-[hsl(var(--foreground))]">
                  {row._count._all.toLocaleString("en-AU")}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Event type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Retries</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-left">Processed</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No webhook events found.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
                      {event.eventType}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={event.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                      {event.retryCount}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(event.receivedAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(event.processedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusForm
                        resource="webhookEvent"
                        id={event.id}
                        currentStatus={event.status}
                        statuses={["received", "processed", "failed", "ignored"]}
                        path="/admin/webhooks"
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

function getWebhookStatusCounts() {
  return safeQuery<WebhookStatusCountRow[]>(
    () =>
      withDbSystemContext(async (tx) => {
        const rows = await tx.webhookEvent.groupBy({
          by: ["status"],
          _count: { _all: true },
          orderBy: { status: "asc" },
          take: 20,
        });
        return rows;
      }),
    []
  );
}

function getWebhookEvents() {
  return safeQuery<WebhookEventRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.webhookEvent.findMany({
          orderBy: { receivedAt: "desc" },
          take: 10,
          select: {
            id: true,
            eventType: true,
            status: true,
            retryCount: true,
            receivedAt: true,
            processedAt: true,
          },
        })
      ),
    []
  );
}

function formatDateTime(date: Date | null) {
  if (!date) return "Not processed";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
