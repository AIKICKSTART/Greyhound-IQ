import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

type BugReportRow = {
  id: string;
  userId: string | null;
  status: string;
  severity: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminBugReportsPage() {
  await requireModeratorProfile();
  const bugReports = await getBugReports();

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
          Bug reports
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 stored bug report records with only status fields shown.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Bug report ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {bugReports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No bug reports found.
                  </td>
                </tr>
              ) : (
                bugReports.map((bugReport) => (
                  <tr key={bugReport.id} className="border-t border-white/[0.06]">
                    <MonoCell>{bugReport.id}</MonoCell>
                    <MonoCell>{bugReport.userId ?? "No user"}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {bugReport.severity}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {bugReport.status}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(bugReport.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(bugReport.updatedAt)}
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

function getBugReports() {
  return safeQuery<BugReportRow[]>(
    () =>
      prisma.bugReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          userId: true,
          status: true,
          severity: true,
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
