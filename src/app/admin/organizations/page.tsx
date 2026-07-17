import { AdminOrganizationForms } from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { requireAdminProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin organizations - GreyhoundIQ",
  description: "Read-only GreyhoundIQ organization overview.",
};

type OrganizationRow = {
  id: string;
  name: string;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    memberships: number;
  };
};

export default async function AdminOrganizationsPage() {
  const current = await requireAdminProfile();
  const organizations = await getOrganizations(current);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Organizations"
        description="Create or update local organization rows and generate organization invitations. Token hashes and provider secrets are not displayed."
      />

      <section className="giq-panel p-6">
        <div className="mt-6">
          <AdminOrganizationForms path="/admin/organizations" />
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Owner ID</th>
                <th className="px-4 py-3 text-left">Memberships</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {organizations.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No organization rows found.
                  </td>
                </tr>
              ) : (
                organizations.map((organization) => (
                  <tr
                    key={organization.id}
                    className="border-t border-white/[0.06]"
                  >
                    <MonoCell>{organization.id}</MonoCell>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[hsl(var(--foreground))]">
                      {organization.name}
                    </td>
                    <MonoCell>{organization.ownerId ?? "No owner"}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {organization._count.memberships.toLocaleString("en-AU")}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(organization.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(organization.updatedAt)}
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

function getOrganizations(current: CurrentUserProfile) {
  return safeQuery<OrganizationRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.organization.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              memberships: true,
            },
          },
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
