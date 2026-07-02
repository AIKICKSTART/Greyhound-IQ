import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin account deletion - GreyhoundIQ",
  description: "Read-only GreyhoundIQ account deletion activity overview.",
};

const RECENT_LIMIT = 20;
const ACCOUNT_DELETION_AUDIT_ACTIONS = [
  "user.delete",
  "user.delete.finalize",
  "user.delete.maintenance",
];

type PendingDeletionUserRow = {
  id: string;
  subscriptionTier: string;
  isBanned: boolean;
  deletionRequestedAt: Date | null;
  updatedAt: Date;
};

type AccountDeletionAuditRow = {
  id: bigint;
  actorType: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: Date;
};

export default async function AdminAccountDeletionPage() {
  await requireModeratorProfile();
  const [pendingRequests, auditLogs] = await Promise.all([
    getPendingDeletionRequests(),
    getAccountDeletionAuditLogs(),
  ]);

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
          Account deletion
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Recent account deletion requests and audit activity. Email, WorkOS
          identifiers, actor IDs, IP addresses, user agents, and metadata are
          not selected or displayed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="giq-metric-card">
            <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Pending requests shown
            </p>
            <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
              {formatCount(pendingRequests.length)}
            </p>
          </div>
          <div className="giq-metric-card">
            <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Audit rows shown
            </p>
            <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
              {formatCount(auditLogs.length)}
            </p>
          </div>
        </div>
      </section>

      <section className="giq-panel mt-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Requests
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
              Pending deletion requests
            </h2>
          </div>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Latest {RECENT_LIMIT} by request time
          </p>
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Banned</th>
                <th className="px-4 py-3 text-left">Deletion requested</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No pending deletion requests found.
                  </td>
                </tr>
              ) : (
                pendingRequests.map((user) => (
                  <tr key={user.id} className="border-t border-white/[0.06]">
                    <MonoCell>{user.id}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {user.subscriptionTier}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {formatBoolean(user.isBanned)}
                    </td>
                    <DateCell
                      date={user.deletionRequestedAt}
                      emptyLabel="Not requested"
                    />
                    <DateCell date={user.updatedAt} emptyLabel="Not recorded" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="giq-panel mt-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Audit
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
              Account deletion audit activity
            </h2>
          </div>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Latest {RECENT_LIMIT} matching deletion actions
          </p>
        </div>

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
                    No account deletion audit activity found.
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
                    <DateCell date={log.createdAt} emptyLabel="Not recorded" />
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

function getPendingDeletionRequests() {
  return safeQuery<PendingDeletionUserRow[]>(
    () =>
      prisma.user.findMany({
        where: {
          deletionRequestedAt: { not: null },
        },
        orderBy: { deletionRequestedAt: "desc" },
        take: RECENT_LIMIT,
        select: {
          id: true,
          subscriptionTier: true,
          isBanned: true,
          deletionRequestedAt: true,
          updatedAt: true,
        },
      }),
    []
  );
}

function getAccountDeletionAuditLogs() {
  return safeQuery<AccountDeletionAuditRow[]>(
    () =>
      prisma.auditLog.findMany({
        where: {
          action: { in: ACCOUNT_DELETION_AUDIT_ACTIONS },
        },
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
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

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
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
