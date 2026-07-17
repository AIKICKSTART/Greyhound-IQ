import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminExportForm, AdminStatusForm } from "@/app/admin/form-controls";
import { requireAdminProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

type ExportArtifactRow = {
  id: string;
  exportType: string;
  status: string;
  targetUserId: string | null;
  organizationId: string | null;
  requestedByUserId: string | null;
  sizeBytes: number | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminExportsPage() {
  const current = await requireAdminProfile();
  const artifacts = await getExportArtifacts(current);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <AdminPageHeader
        title="Export artifacts"
        description="Create local export artifact records and update their lifecycle status. Storage paths and object contents are not displayed here."
      />

      <section className="giq-panel p-6">
        <div>
          <AdminExportForm path="/admin/exports" />
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1880px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Artifact ID</th>
                <th className="px-4 py-3 text-left">Export type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Target user ID</th>
                <th className="px-4 py-3 text-left">Organization ID</th>
                <th className="px-4 py-3 text-left">Requested by user ID</th>
                <th className="px-4 py-3 text-right">Size bytes</th>
                <th className="px-4 py-3 text-left">Completed</th>
                <th className="px-4 py-3 text-left">Expires</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No export artifacts found.
                  </td>
                </tr>
              ) : (
                artifacts.map((artifact) => (
                  <tr key={artifact.id} className="border-t border-white/[0.06]">
                    <MonoCell>{artifact.id}</MonoCell>
                    <TextCell>{artifact.exportType}</TextCell>
                    <TextCell>{artifact.status}</TextCell>
                    <MonoCell>{artifact.targetUserId ?? "No target user"}</MonoCell>
                    <MonoCell>
                      {artifact.organizationId ?? "No organization"}
                    </MonoCell>
                    <MonoCell>
                      {artifact.requestedByUserId ?? "No requester"}
                    </MonoCell>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatNullableNumber(artifact.sizeBytes)}
                    </td>
                    <DateCell date={artifact.completedAt} emptyLabel="Not completed" />
                    <DateCell date={artifact.expiresAt} emptyLabel="No expiry" />
                    <DateCell date={artifact.createdAt} emptyLabel="Not recorded" />
                    <DateCell date={artifact.updatedAt} emptyLabel="Not recorded" />
                    <td className="px-4 py-3">
                      <AdminStatusForm
                        resource="exportArtifact"
                        id={artifact.id}
                        currentStatus={artifact.status}
                        statuses={["created", "processing", "completed", "failed", "expired"]}
                        path="/admin/exports"
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

function getExportArtifacts(current: CurrentUserProfile) {
  return safeQuery<ExportArtifactRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.exportArtifact.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          exportType: true,
          status: true,
          targetUserId: true,
          organizationId: true,
          requestedByUserId: true,
          sizeBytes: true,
          completedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
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

function TextCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
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

function formatNullableNumber(value: number | null) {
  return value === null ? "Not recorded" : value.toLocaleString("en-AU");
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
