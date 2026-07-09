import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminBugReportForm } from "@/app/admin/form-controls";
import { StatusPill } from "@/components/admin/status-pill";
import { requireModeratorProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

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
  const current = await requireModeratorProfile();
  const bugReports = await getBugReports(current);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Bug reports"
        description="Latest 20 stored bug report records with status controls. Report descriptions stay out of this overview."
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Bug report ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {bugReports.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
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
                    <td className="px-4 py-3">
                      <StatusPill value={bugReport.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={bugReport.status} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(bugReport.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(bugReport.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminBugReportForm
                        bugReport={bugReport}
                        path="/admin/bug-reports"
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

function MonoCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function getBugReports(current: CurrentUserProfile) {
  return safeQuery<BugReportRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.bugReport.findMany({
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
      ),
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
