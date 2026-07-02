import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

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
  await requireModeratorProfile();
  const events = await getBillingEvents();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link href="/admin" className="giq-outline-action mb-6 w-fit">
        Back to admin
      </Link>

      <section className="giq-panel p-6">
        <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
          Billing events
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 local billing event records. Provider event identifiers and
          raw payloads are not displayed here.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
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
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
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
      prisma.billingEvent.findMany({
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
      }),
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
