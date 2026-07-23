import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminStatusForm } from "@/app/admin/form-controls";
import { StatusPill } from "@/components/admin/status-pill";
import { requireModeratorProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin feedback - GreyhoundIQ",
  description: "Read-only GreyhoundIQ feedback overview.",
};

type FeedbackRow = {
  id: string;
  userId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminFeedbackPage() {
  const current = await requireModeratorProfile();
  const canManageFeedback = current.profileRole === "admin";
  const feedback = await getFeedback(current);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Feedback"
        description={
          canManageFeedback
            ? "Latest 20 stored feedback records. Only identifiers, status, timestamps, and audited status controls are shown."
            : "Latest 20 stored feedback records. Moderator access is read-only; an administrator is required to change feedback status."
        }
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Feedback ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {feedback.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No feedback found.
                  </td>
                </tr>
              ) : (
                feedback.map((item) => (
                  <tr key={item.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
                      {item.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
                      {item.userId ?? "No user"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={item.status} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {canManageFeedback ? (
                        <AdminStatusForm
                          resource="feedback"
                          id={item.id}
                          currentStatus={item.status}
                          statuses={["new", "reviewing", "planned", "closed"]}
                          path="/admin/feedback"
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

function getFeedback(current: CurrentUserProfile) {
  return safeQuery<FeedbackRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.feedback.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            userId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        })
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
