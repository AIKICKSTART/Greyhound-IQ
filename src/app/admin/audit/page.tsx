import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin audit log - GreyhoundIQ",
  description: "Read-only GreyhoundIQ audit log overview.",
};

type AuditLogRow = {
  id: bigint;
  actorType: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: Date;
};

export default async function AdminAuditLogPage() {
  await requireModeratorProfile();
  const auditLogs = await getAuditLogs();

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
          Audit log
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 audit log rows from the local database. Metadata, IP
          addresses, user agents, actor IDs, and payloads are not displayed.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Row ID</th>
                <th className="px-4 py-3 text-left">Actor type</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Target type</th>
                <th className="px-4 py-3 text-left">Target ID</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No audit log rows found.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id.toString()} className="border-t border-white/[0.06]">
                    <MonoCell>{log.id.toString()}</MonoCell>
                    <MonoCell>{log.actorType}</MonoCell>
                    <MonoCell>{log.action}</MonoCell>
                    <MonoCell>{log.targetType ?? "No target"}</MonoCell>
                    <MonoCell>{log.targetId ?? "No target ID"}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(log.createdAt)}
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

function getAuditLogs() {
  return safeQuery<AuditLogRow[]>(
    () =>
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          actorType: true,
          action: true,
          targetType: true,
          targetId: true,
          createdAt: true,
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
