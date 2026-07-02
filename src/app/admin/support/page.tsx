import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin support - GreyhoundIQ",
  description: "Read-only GreyhoundIQ support ticket overview.",
};

type SupportTicketRow = {
  id: string;
  userId: string | null;
  status: string;
  priority: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminSupportPage() {
  await requireModeratorProfile();
  const tickets = await getSupportTickets();

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
          Support tickets
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 10 stored support tickets from the local database.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Ticket ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No support tickets found.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
                      {ticket.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
                      {ticket.userId ?? "No user"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {ticket.category}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {ticket.status}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {ticket.priority}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(ticket.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(ticket.updatedAt)}
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

function getSupportTickets() {
  return safeQuery<SupportTicketRow[]>(
    () =>
      prisma.supportTicket.findMany({
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
        },
      }),
    []
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
