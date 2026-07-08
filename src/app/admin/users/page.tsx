import Link from "next/link";

import {
  AdminCreateUserForm,
  AdminUserAccessForm,
} from "@/app/admin/form-controls";
import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin users - GreyhoundIQ",
  description: "Read-only GreyhoundIQ user operations overview.",
};

type AdminUserRow = {
  id: string;
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
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/admin" className="giq-outline-action mb-6 w-fit">
        Back to admin
      </Link>

      <section className="giq-panel p-6">
        <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
          Users
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Create local users, update tiers and roles, ban accounts, and cancel
          deletion requests. Every mutation requires a reason and is audited.
        </p>

        <div className="mt-6">
          <AdminCreateUserForm path="/admin/users" />
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1280px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">User ID</th>
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
                    colSpan={9}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-white/[0.06]">
                    <MonoCell>{user.id}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {user.subscriptionTier}
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
    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
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

function getUsers() {
  return safeQuery<AdminUserRow[]>(
    () =>
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
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
      }),
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
