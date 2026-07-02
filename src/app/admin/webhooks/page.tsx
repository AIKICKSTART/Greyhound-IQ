import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

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

export default async function AdminWebhooksPage() {
  await requireModeratorProfile();
  const events = await getWebhookEvents();

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
          Webhook events
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 10 stored webhook events from the local database.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Event type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Retries</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-left">Processed</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {event.status}
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

function getWebhookEvents() {
  return safeQuery<WebhookEventRow[]>(
    () =>
      prisma.webhookEvent.findMany({
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
      }),
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
