import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin organization invitations - GreyhoundIQ",
  description: "Read-only GreyhoundIQ organization invitation overview.",
};

type OrganizationInvitationRow = {
  id: string;
  organizationId: string;
  invitedByUserId: string | null;
  role: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminOrganizationInvitationsPage() {
  await requireModeratorProfile();
  const invitations = await getOrganizationInvitations();

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
          Organization invitations
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 local organization invitation rows with token hashes, email
          hashes, and provider data excluded.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1480px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Invitation ID</th>
                <th className="px-4 py-3 text-left">Organization ID</th>
                <th className="px-4 py-3 text-left">Invited by user ID</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Expires</th>
                <th className="px-4 py-3 text-left">Accepted</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No organization invitations found.
                  </td>
                </tr>
              ) : (
                invitations.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className="border-t border-white/[0.06]"
                  >
                    <MonoCell>{invitation.id}</MonoCell>
                    <MonoCell>{invitation.organizationId}</MonoCell>
                    <MonoCell>
                      {invitation.invitedByUserId ?? "No inviter"}
                    </MonoCell>
                    <TextCell>{invitation.role}</TextCell>
                    <TextCell>{invitation.status}</TextCell>
                    <DateCell date={invitation.expiresAt} />
                    <DateCell
                      date={invitation.acceptedAt}
                      emptyLabel="Not accepted"
                    />
                    <DateCell date={invitation.createdAt} />
                    <DateCell date={invitation.updatedAt} />
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

function getOrganizationInvitations() {
  return safeQuery<OrganizationInvitationRow[]>(
    () =>
      prisma.organizationInvitation.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          organizationId: true,
          invitedByUserId: true,
          role: true,
          status: true,
          expiresAt: true,
          acceptedAt: true,
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
  emptyLabel = "Not recorded",
}: {
  date: Date | null;
  emptyLabel?: string;
}) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
      {formatDateTime(date, emptyLabel)}
    </td>
  );
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
