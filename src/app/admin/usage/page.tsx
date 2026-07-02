import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin usage - GreyhoundIQ",
  description: "Read-only GreyhoundIQ usage event overview.",
};

type UsageEventRow = {
  id: string;
  metricKey: string;
  quantity: number;
  status: string;
  retryCount: number;
  occurredAt: Date;
  processedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
};

type UsageOutboxRow = {
  id: string;
  usageEventId: string | null;
  metricKey: string;
  quantity: number;
  status: string;
  retryCount: number;
  occurredAt: Date;
  sentAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
};

export default async function AdminUsagePage() {
  await requireModeratorProfile();
  const [events, outboxRows] = await Promise.all([
    getUsageEvents(),
    getUsageOutboxRows(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/admin" className="giq-outline-action mb-6 w-fit">
        Back to admin
      </Link>

      <div className="grid gap-6">
        <section className="giq-panel p-6">
          <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
            Usage
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Latest local usage event and usage outbox rows. Sensitive metadata,
            external billing identifiers, idempotency keys, user IDs, and error
            payloads are not displayed.
          </p>
        </section>

        <UsageEventsTable rows={events} />
        <UsageOutboxTable rows={outboxRows} />
      </div>
    </main>
  );
}

function UsageEventsTable({ rows }: { rows: UsageEventRow[] }) {
  return (
    <section className="giq-panel p-6">
      <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
        Usage events
      </h2>
      <p className="mt-2 text-[14px] text-[hsl(var(--muted-foreground))]">
        Latest 10 rows from the local UsageEvent table.
      </p>

      <div className="giq-table-shell mt-6 overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="giq-table-head">
              <th className="px-4 py-3 text-left">Row ID</th>
              <th className="px-4 py-3 text-left">Metric</th>
              <th className="px-4 py-3 text-left">Quantity</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Retries</th>
              <th className="px-4 py-3 text-left">Occurred</th>
              <th className="px-4 py-3 text-left">Processed</th>
              <th className="px-4 py-3 text-left">Failed</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                >
                  No usage events found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <MonoCell>{row.id}</MonoCell>
                  <MonoCell>{row.metricKey}</MonoCell>
                  <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                    {formatCount(row.quantity)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                    {row.status}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                    {row.retryCount}
                  </td>
                  <DateCell date={row.occurredAt} emptyLabel="Not recorded" />
                  <DateCell date={row.processedAt} emptyLabel="Not processed" />
                  <DateCell date={row.failedAt} emptyLabel="Not failed" />
                  <DateCell date={row.createdAt} emptyLabel="Not recorded" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsageOutboxTable({ rows }: { rows: UsageOutboxRow[] }) {
  return (
    <section className="giq-panel p-6">
      <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
        Usage outbox
      </h2>
      <p className="mt-2 text-[14px] text-[hsl(var(--muted-foreground))]">
        Latest 10 rows from the local UsageOutbox table.
      </p>

      <div className="giq-table-shell mt-6 overflow-x-auto">
        <table className="w-full min-w-[1040px]">
          <thead>
            <tr className="giq-table-head">
              <th className="px-4 py-3 text-left">Row ID</th>
              <th className="px-4 py-3 text-left">Usage event ID</th>
              <th className="px-4 py-3 text-left">Metric</th>
              <th className="px-4 py-3 text-left">Quantity</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Retries</th>
              <th className="px-4 py-3 text-left">Occurred</th>
              <th className="px-4 py-3 text-left">Sent</th>
              <th className="px-4 py-3 text-left">Failed</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                >
                  No usage outbox rows found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <MonoCell>{row.id}</MonoCell>
                  <MonoCell>{row.usageEventId ?? "No event"}</MonoCell>
                  <MonoCell>{row.metricKey}</MonoCell>
                  <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                    {formatCount(row.quantity)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                    {row.status}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                    {row.retryCount}
                  </td>
                  <DateCell date={row.occurredAt} emptyLabel="Not recorded" />
                  <DateCell date={row.sentAt} emptyLabel="Not sent" />
                  <DateCell date={row.failedAt} emptyLabel="Not failed" />
                  <DateCell date={row.createdAt} emptyLabel="Not recorded" />
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

function getUsageEvents() {
  return safeQuery<UsageEventRow[]>(
    () =>
      prisma.usageEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          metricKey: true,
          quantity: true,
          status: true,
          retryCount: true,
          occurredAt: true,
          processedAt: true,
          failedAt: true,
          createdAt: true,
        },
      }),
    []
  );
}

function getUsageOutboxRows() {
  return safeQuery<UsageOutboxRow[]>(
    () =>
      prisma.usageOutbox.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          usageEventId: true,
          metricKey: true,
          quantity: true,
          status: true,
          retryCount: true,
          occurredAt: true,
          sentAt: true,
          failedAt: true,
          createdAt: true,
        },
      }),
    []
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
