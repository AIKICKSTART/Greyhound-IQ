import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminSubmitButton } from "@/app/admin/admin-submit-button";
import { StatusPill } from "@/components/admin/status-pill";
import { resolveReport } from "@/app/actions";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin reports - GreyhoundIQ",
  description: "Read-only GreyhoundIQ report overview.",
};

type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  reporter: {
    email: string;
    name: string | null;
  };
  reported: {
    email: string;
    name: string | null;
  } | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  messagePreview?: {
    conversationId: string | null;
    sender: string;
    recipient: string;
    body: string;
    createdAt: Date;
  } | null;
};

export default async function AdminReportsPage() {
  await requireModeratorProfile();
  const reports = await getReports();
  const openReports = reports.filter((report) => report.status === "open").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <AdminPageHeader
        title="Reports"
        description="Latest 50 local report records. Moderators can dismiss reports or mark them resolved after taking the appropriate content or user action."
      />

      <section className="giq-panel p-4 sm:p-6" aria-labelledby="reports-queue-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="reports-queue-heading"
              className="text-xl font-semibold text-[hsl(var(--foreground))]"
            >
              Moderation queue
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Review the reporter context and target evidence before recording a resolution.
            </p>
          </div>
          <span className="giq-badge giq-badge-gold" aria-label={`${openReports} open reports`}>
            {openReports} open
          </span>
        </div>

        <div
          className="giq-table-shell mt-4 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
          role="region"
          aria-label="Report moderation queue"
          tabIndex={0}
        >
          <table className="w-full min-w-[1180px]">
            <caption className="sr-only">
              Latest reports with reporter context and resolution controls
            </caption>
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Report ID</th>
                <th className="px-4 py-3 text-left">Reporter</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Resolved</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No reports are waiting for review.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-t border-white/[0.06] align-top transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))] [overflow-wrap:anywhere]">
                      {report.id}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {report.reporter.name ?? "Unnamed"}
                      <p className="mt-1 break-all text-[11px] text-[hsl(var(--subtle-foreground))]">
                        {report.reporter.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {report.targetType}
                      <p className="mt-1 font-mono text-[11px] text-[hsl(var(--subtle-foreground))] [overflow-wrap:anywhere]">
                        {report.targetId}
                      </p>
                      {report.reported ? (
                        <p className="mt-1 break-all text-[11px] text-[hsl(var(--subtle-foreground))]">
                          Reported: {report.reported.email}
                        </p>
                      ) : null}
                      {report.messagePreview ? (
                        <div className="mt-2 max-w-sm rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                          <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">
                            {report.messagePreview.sender} to{" "}
                            {report.messagePreview.recipient} ·{" "}
                            {formatDateTime(report.messagePreview.createdAt)}
                          </p>
                          <p className="mt-1 line-clamp-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                            {report.messagePreview.body}
                          </p>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))] [overflow-wrap:anywhere]">
                      {report.reason}
                      {report.description ? (
                        <p className="mt-1 max-w-xs text-[12px] text-[hsl(var(--muted-foreground))]">
                          {report.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={report.status} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(report.resolvedAt, "Not resolved")}
                      {report.resolutionNotes ? (
                        <p className="mt-1 max-w-xs text-[12px] text-[hsl(var(--muted-foreground))]">
                          {report.resolutionNotes}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {report.status === "open" ? (
                        <ReportResolutionForm reportId={report.id} />
                      ) : (
                        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
                          Closed
                        </span>
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

function ReportResolutionForm({ reportId }: { reportId: string }) {
  const action = resolveReport.bind(null, reportId);

  return (
    <form action={action} className="flex min-w-[340px] flex-wrap gap-2">
      <select
        name="action"
        defaultValue="dismiss"
        aria-label="Resolution action"
        className="giq-form-control min-h-11 px-3 py-2 text-[12px]"
      >
        <option value="dismiss">Dismiss</option>
        <option value="hide_content">Hide content</option>
        <option value="warn_user">Warn user</option>
        <option value="ban_user">Ban user</option>
        <option value="delete_content">Delete content</option>
      </select>
      <input
        name="notes"
        maxLength={1000}
        placeholder="Resolution notes"
        aria-label="Resolution notes"
        className="giq-form-control min-h-11 w-44 px-3 py-2 text-[12px]"
      />
      <AdminSubmitButton
        label="Resolve"
        pendingLabel="Resolving…"
        confirmMessage="Resolve this report with the selected moderation action?"
        className="giq-button giq-button-glass min-h-11 px-3 text-[12px]"
      />
    </form>
  );
}

async function getReports() {
  const reports = await safeQuery<ReportRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.report.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            targetType: true,
            targetId: true,
            reason: true,
            description: true,
            status: true,
            reporter: {
              select: {
                email: true,
                name: true,
              },
            },
            reported: {
              select: {
                email: true,
                name: true,
              },
            },
            createdAt: true,
            resolvedAt: true,
            resolutionNotes: true,
          },
        })
      ),
    []
  );

  const messageIds = reports
    .filter((report) => report.targetType === "message")
    .map((report) => report.targetId);
  if (messageIds.length === 0) return reports;

  const messages = await safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.message.findMany({
          where: { id: { in: messageIds } },
          take: 50,
          select: {
            id: true,
            conversationId: true,
            body: true,
            createdAt: true,
            sender: { select: { displayName: true } },
            recipient: { select: { displayName: true } },
          },
        })
      ),
    []
  );
  const previews = new Map(
    messages.map((message) => [
      message.id,
      {
        conversationId: message.conversationId,
        sender: message.sender.displayName,
        recipient: message.recipient.displayName,
        body: message.body,
        createdAt: message.createdAt,
      },
    ])
  );

  return reports.map((report) =>
    report.targetType === "message"
      ? { ...report, messagePreview: previews.get(report.targetId) ?? null }
      : report
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
