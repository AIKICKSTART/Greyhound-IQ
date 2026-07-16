import { AdminStatusForm } from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { requireAdminProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

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
  const current = await requireAdminProfile();
  const invitations = await getOrganizationInvitations(current);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <AdminPageHeader
        title="Organization invitations"
        description="Latest 20 local organization invitation rows. Token hashes, email hashes, and provider data stay hidden; status changes are audited."
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1620px]">
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
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
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
                    <td className="px-4 py-3">
                      <AdminStatusForm
                        resource="organizationInvitation"
                        id={invitation.id}
                        currentStatus={invitation.status}
                        statuses={["pending", "accepted", "cancelled", "expired"]}
                        path="/admin/invitations"
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

function getOrganizationInvitations(current: CurrentUserProfile) {
  return safeQuery<OrganizationInvitationRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.organizationInvitation.findMany({
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
