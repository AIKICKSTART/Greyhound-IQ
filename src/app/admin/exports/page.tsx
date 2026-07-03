import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

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
  await requireModeratorProfile();
  const artifacts = await getExportArtifacts();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link href="/admin" className="giq-outline-action mb-6 w-fit">
        Back to admin
      </Link>

      <section className="giq-panel p-6">
        <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
          Export artifacts
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 export artifact records with identifiers, status, size, and
          lifecycle timestamps.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1680px]">
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
              </tr>
            </thead>
            <tbody>
              {artifacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
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

function getExportArtifacts() {
  return safeQuery<ExportArtifactRow[]>(
    () =>
      prisma.exportArtifact.findMany({
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
      }),
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
