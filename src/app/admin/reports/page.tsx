import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin reports - GreyhoundIQ",
  description: "Read-only GreyhoundIQ report overview.",
};

type ReportRow = {
  id: string;
  targetType: string;
  reason: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

export default async function AdminReportsPage() {
  await requireModeratorProfile();
  const reports = await getReports();

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
          Reports
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 local report records. Reporter details, reported user
          details, target IDs, descriptions, and resolution notes are not
          displayed.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Report ID</th>
                <th className="px-4 py-3 text-left">Target type</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No reports found.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
                      {report.id}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {report.targetType}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {report.reason}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {report.status}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(report.resolvedAt, "Not resolved")}
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

function getReports() {
  return safeQuery<ReportRow[]>(
    () =>
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          targetType: true,
          reason: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
    []
  );
}

function formatDateTime(date: Date | null, emptyLabel = "Not recorded") {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
