import {
  AdminCreateUserForm,
  AdminUserAccessForm,
} from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin users - GreyhoundIQ",
  description: "Read-only GreyhoundIQ user operations overview.",
};

type AdminUserRow = {
  id: string;
  email: string;
  subscriptionTier: string;
  isBanned: boolean;
  deletionRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    role: string;
    verified: boolean;
  } | null;
};

export default async function AdminUsersPage() {
  await requireModeratorProfile();
  const users = await getUsers();

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <AdminPageHeader
        title="Users"
        description="Create local users, update tiers and roles, ban accounts, and cancel deletion requests. Every mutation requires a reason and is audited."
      />

      <section className="giq-panel p-4 sm:p-6" aria-labelledby="user-access-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="user-access-heading"
              className="text-xl font-semibold text-[hsl(var(--foreground))]"
            >
              Create or update a user
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Use an account email to create a local record or update its profile access.
              A reason is required for the audit trail.
            </p>
          </div>
          <span className="giq-badge giq-badge-neutral">Moderator only</span>
        </div>

        <div className="giq-subpanel mt-4 p-4">
          <AdminCreateUserForm path="/admin/users" />
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              Latest users
            </h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Review identity state, subscription access, and account controls.
            </p>
          </div>
          <span className="giq-badge giq-badge-gold" aria-label={`${users.length} user records shown`}>
            {users.length} shown
          </span>
        </div>

        <div
          className="giq-table-shell mt-4 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
          role="region"
          aria-label="Latest users and access controls"
          tabIndex={0}
        >
          <table className="w-full min-w-[1280px]">
            <caption className="sr-only">
              Latest users and moderator-only account access controls
            </caption>
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Verified</th>
                <th className="px-4 py-3 text-left">Banned</th>
                <th className="px-4 py-3 text-left">Deletion requested</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No user records are available yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-white/[0.06] align-top transition-colors hover:bg-white/[0.025]"
                  >
                    <MonoCell>{user.id}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))] break-all">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={user.subscriptionTier} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {user.profile?.role ?? "No profile"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {formatBoolean(user.profile?.verified ?? false)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {formatBoolean(user.isBanned)}
                    </td>
                    <DateCell
                      date={user.deletionRequestedAt}
                      emptyLabel="Not requested"
                    />
                    <DateCell date={user.createdAt} emptyLabel="Not recorded" />
                    <DateCell date={user.updatedAt} emptyLabel="Not recorded" />
                    <td className="px-4 py-3">
                      <AdminUserAccessForm user={user} path="/admin/users" />
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
    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))] [overflow-wrap:anywhere]">
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
    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
      {formatDateTime(date, emptyLabel)}
    </td>
  );
}

function getUsers() {
  return safeQuery<AdminUserRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            email: true,
            subscriptionTier: true,
            isBanned: true,
            deletionRequestedAt: true,
            createdAt: true,
            updatedAt: true,
            profile: {
              select: {
                role: true,
                verified: true,
              },
            },
          },
        })
      ),
    []
  );
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
