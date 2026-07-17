import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminSupportTicketForm } from "@/app/admin/form-controls";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin support - GreyhoundIQ",
  description: "Read-only GreyhoundIQ support ticket overview.",
};

type SupportTicketSummaryRow = {
  id: string;
  userId: string | null;
  status: string;
  priority: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    messages: number;
  };
};

type SupportTicketCountRow = {
  name: string;
  count: number;
};

type SupportTicketCounts = {
  total: number;
  statuses: SupportTicketCountRow[];
  priorities: SupportTicketCountRow[];
};

export default async function AdminSupportPage() {
  const current = await requireModeratorProfile();
  const canManageTickets = current.profileRole === "admin";
  const [ticketCounts, tickets] = await Promise.all([
    getSupportTicketCounts(current),
    getSupportTickets(current),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Support ticket counts"
        description={
          canManageTickets
            ? "Aggregate support ticket counts and recent ticket rows. Status changes are audited; support message contents are not displayed."
            : "Aggregate support ticket counts and recent ticket rows. Moderator access is read-only; an administrator is required to change status or send a support reply."
        }
      />

      <section className="giq-panel p-6">
        <div className="grid gap-4 lg:grid-cols-[0.75fr_1fr_1fr]">
          <div className="giq-subpanel p-5">
            <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Total
            </p>
            <p className="mt-2 text-4xl font-semibold text-[hsl(var(--foreground))]">
              {formatCount(ticketCounts.total)}
            </p>
          </div>
          <CountGroup title="Status" items={ticketCounts.statuses} />
          <CountGroup title="Priority" items={ticketCounts.priorities} />
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Ticket ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Messages</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No support tickets found.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-white/[0.06]">
                    <MonoCell>{ticket.id}</MonoCell>
                    <MonoMutedCell>{ticket.userId ?? "No user"}</MonoMutedCell>
                    <TextCell>{formatLabel(ticket.category)}</TextCell>
                    <TextCell>{formatCount(ticket._count.messages)}</TextCell>
                    <TextCell>{formatLabel(ticket.status)}</TextCell>
                    <TextCell>{formatLabel(ticket.priority)}</TextCell>
                    <DateCell date={ticket.createdAt} />
                    <DateCell date={ticket.updatedAt} />
                    <td className="px-4 py-3">
                      {canManageTickets ? (
                        <AdminSupportTicketForm
                          ticket={ticket}
                          path="/admin/support"
                        />
                      ) : (
                        <AdminRequiredLabel />
                      )}
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

function AdminRequiredLabel() {
  return (
    <span className="inline-flex min-h-11 items-center rounded-lg border border-amber-300/20 bg-amber-300/[0.07] px-3 text-[12px] font-semibold text-amber-200">
      Administrator required
    </span>
  );
}

function getSupportTicketCounts(current: CurrentUserProfile) {
  return safeQuery<SupportTicketCounts>(
    async () => {
      const [statuses, priorities, total] = await withDbRequestContext(
        current,
        (tx) =>
          Promise.all([
            tx.supportTicket.groupBy({
              by: ["status"],
              orderBy: { status: "asc" },
              _count: { _all: true },
              take: 20,
            }),
            tx.supportTicket.groupBy({
              by: ["priority"],
              orderBy: { priority: "asc" },
              _count: { _all: true },
              take: 20,
            }),
            tx.supportTicket.count(),
          ])
      );

      return {
        total,
        statuses: statuses.map((row) => ({
          name: row.status,
          count: row._count._all,
        })),
        priorities: priorities.map((row) => ({
          name: row.priority,
          count: row._count._all,
        })),
      };
    },
    { total: 0, statuses: [], priorities: [] }
  );
}

function CountGroup({
  title,
  items,
}: {
  title: string;
  items: SupportTicketCountRow[];
}) {
  return (
    <div className="giq-subpanel p-5">
      <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-[13px] text-[hsl(var(--muted-foreground))]">
          No support tickets found.
        </p>
      ) : (
        <dl className="mt-4 grid gap-3">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-4 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2"
            >
              <dt className="text-[13px] font-medium text-[hsl(var(--foreground))]">
                {formatLabel(item.name)}
              </dt>
              <dd className="font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                {formatCount(item.count)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function getSupportTickets(current: CurrentUserProfile) {
  return safeQuery<SupportTicketSummaryRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.supportTicket.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            userId: true,
            status: true,
            priority: true,
            category: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                messages: true,
              },
            },
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

function MonoMutedCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
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

function formatCount(value: number) {
  return value.toLocaleString("en-AU");
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}

function formatLabel(value: string) {
  const text = value.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const clipped = cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}
