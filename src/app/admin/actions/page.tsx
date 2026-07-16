import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { requireAdminProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin actions - GreyhoundIQ",
  description: "Read-only GreyhoundIQ admin action overview.",
};

type AdminActionRow = {
  id: string;
  adminId: string | null;
  affectedUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  createdAt: Date;
};

export default async function AdminActionsPage() {
  const current = await requireAdminProfile();
  const actions = await getAdminActions(current);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Actions"
        description="Latest 20 admin action rows from the local database. Only action IDs, user IDs, target identifiers, reasons, and timestamps are displayed."
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Action ID</th>
                <th className="px-4 py-3 text-left">Admin ID</th>
                <th className="px-4 py-3 text-left">Affected user ID</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Target type</th>
                <th className="px-4 py-3 text-left">Target ID</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {actions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No admin actions found.
                  </td>
                </tr>
              ) : (
                actions.map((action) => (
                  <tr key={action.id} className="border-t border-white/[0.06]">
                    <MonoCell>{action.id}</MonoCell>
                    <MonoCell>{action.adminId ?? "No admin"}</MonoCell>
                    <MonoCell>
                      {action.affectedUserId ?? "No affected user"}
                    </MonoCell>
                    <MonoCell>{action.action}</MonoCell>
                    <MonoCell>{action.targetType ?? "No target"}</MonoCell>
                    <MonoCell>{action.targetId ?? "No target ID"}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {action.reason}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(action.createdAt)}
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

function getAdminActions(current: CurrentUserProfile) {
  return safeQuery<AdminActionRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.adminAction.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          adminId: true,
          affectedUserId: true,
          action: true,
          targetType: true,
          targetId: true,
          reason: true,
          createdAt: true,
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
