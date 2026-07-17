import type { Prisma } from "@prisma/client";
import { Search, SlidersHorizontal, UserRoundSearch } from "lucide-react";
import Link from "next/link";

import {
  AdminCreateUserForm,
  AdminUserAccessForm,
} from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { lookupAdminUserAction } from "@/app/admin/users/actions";
import { StatusPill } from "@/components/admin/status-pill";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { requireAdminProfile } from "@/lib/auth";
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

type AdminUsersPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type AdminUsersQuery = {
  page: number;
  role: "" | "member" | "breeder" | "trainer" | "moderator" | "admin";
  selectedUserId: string | null;
  tier: "" | "free" | "pro" | "pro_plus";
};

type AdminUsersResult = {
  page: number;
  pageCount: number;
  total: number;
  users: AdminUserRow[];
};

const PAGE_SIZE = 20;
const USER_TIERS = ["free", "pro", "pro_plus"] as const;
const USER_ROLES = [
  "member",
  "breeder",
  "trainer",
  "moderator",
  "admin",
] as const;
const ADMIN_USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const current = await requireAdminProfile();
  const canManageAccess = current.profileRole === "admin";
  const rawSearchParams = await searchParams;
  const query = parseAdminUsersQuery(rawSearchParams);
  const lookupMessage = adminUserLookupMessage(
    singleQueryValue(rawSearchParams.lookup),
  );
  const result = await getUsers(query);
  const selectedUser = query.selectedUserId
    ? result.users.find((user) => user.id === query.selectedUserId) ?? null
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <AdminPageHeader
        title="Users"
        description={
          canManageAccess
            ? "Create local users, update tiers and roles, ban accounts, and cancel deletion requests. Every mutation requires a reason and is audited."
            : "Review identity and account state in moderator read-only mode. Administrator access is required for tier, role, ban, and deletion changes."
        }
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
          <span className="giq-badge giq-badge-neutral">
            {canManageAccess ? "Administrator controls" : "Read-only moderator view"}
          </span>
        </div>

        {canManageAccess ? (
          <div className="giq-subpanel mt-4 p-4">
            <AdminCreateUserForm path="/admin/users" />
          </div>
        ) : (
          <div className="giq-subpanel mt-4 border-amber-300/20 bg-amber-300/[0.04] p-4 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
            Account mutation controls are hidden under least privilege. Use the
            moderation queues for reports, safety and ownership decisions.
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              User directory
            </h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Look up an exact identity without placing email addresses in the
              URL, filter access state, and inspect audited controls.
            </p>
          </div>
          <span
            className="giq-badge giq-badge-gold"
            aria-label={`${result.total} matching user records`}
          >
            {result.total} matching
          </span>
        </div>

        <div className="giq-subpanel mt-4 grid gap-3 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <form action={lookupAdminUserAction} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0 space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-[hsl(var(--subtle-foreground))]">
                Exact user lookup
              </span>
              <input
                className="giq-form-control min-h-11 w-full px-3 py-2 text-[14px]"
                autoComplete="off"
                name="lookup"
                placeholder="Email or exact user ID"
                required
                type="text"
              />
            </label>
            <button className="giq-button giq-button-primary min-h-11 self-end px-4 text-[13px]" type="submit">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </button>
          </form>

          <form method="get" className="grid min-w-0 gap-2 sm:grid-cols-2 sm:items-end">
            <label className="min-w-0 space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-[hsl(var(--subtle-foreground))]">
                Tier filter
              </span>
              <AutoSubmitSelect
                aria-label="Filter users by tier"
                className="giq-form-control min-h-11 w-full px-3 py-2 text-[14px]"
                defaultValue={query.tier}
                name="tier"
              >
                <option value="">All tiers</option>
                {USER_TIERS.map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </AutoSubmitSelect>
            </label>
            <label className="min-w-0 space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-[hsl(var(--subtle-foreground))]">
                Role filter
              </span>
              <AutoSubmitSelect
                aria-label="Filter users by role"
                className="giq-form-control min-h-11 w-full px-3 py-2 text-[14px]"
                defaultValue={query.role}
                name="role"
              >
                <option value="">All roles</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </AutoSubmitSelect>
            </label>
            <button className="giq-button giq-button-glass min-h-11 px-4 text-[13px] sm:col-span-2" type="submit">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filter
            </button>
          </form>

          {(query.tier || query.role) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 lg:col-span-2">
              <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
                Showing page {result.page} of {result.pageCount} for the active directory filters.
              </p>
              <Link className="giq-outline-action" href="/admin/users">
                Clear filters
              </Link>
            </div>
          )}
        </div>

        {lookupMessage ? (
          <p
            className="giq-subpanel mt-3 px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]"
            data-admin-user-lookup-status
            role="status"
          >
            {lookupMessage}
          </p>
        ) : null}

        {selectedUser && (
          <section
            id="selected-user"
            className="giq-subpanel mt-4 border-[hsl(var(--primary-light)/0.24)] p-4"
            aria-labelledby="selected-user-heading"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[hsl(var(--primary-light))]">
                  <UserRoundSearch className="h-4 w-4" aria-hidden="true" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">Focused user record</p>
                </div>
                <h3 id="selected-user-heading" className="mt-2 break-all text-lg font-semibold text-[hsl(var(--foreground))]">
                  {selectedUser.email}
                </h3>
                <p className="mt-1 break-all font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
                  {selectedUser.id}
                </p>
              </div>
              <Link className="giq-outline-action" href={buildAdminUsersHref(query, result.page)}>
                Close details
              </Link>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <UserMetric label="Tier" value={selectedUser.subscriptionTier} />
              <UserMetric label="Role" value={selectedUser.profile?.role ?? "No profile"} />
              <UserMetric label="Verified" value={formatBoolean(selectedUser.profile?.verified ?? false)} />
              <UserMetric label="Account state" value={selectedUser.isBanned ? "Banned" : "Active"} />
              <UserMetric label="Created" value={formatDateTime(selectedUser.createdAt, "Not recorded")} />
              <UserMetric label="Last updated" value={formatDateTime(selectedUser.updatedAt, "Not recorded")} />
              <UserMetric label="Deletion request" value={formatDateTime(selectedUser.deletionRequestedAt, "Not requested")} />
              <UserMetric label="Access mode" value={canManageAccess ? "Audited admin controls" : "Read only"} />
            </dl>
          </section>
        )}

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
              {result.users.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No users match this search and filter combination.
                  </td>
                </tr>
              ) : (
                result.users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-white/[0.06] align-top transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="px-4 py-3">
                      <span className="block font-mono text-[12px] text-[hsl(var(--foreground))] [overflow-wrap:anywhere]">
                        {user.id}
                      </span>
                      <Link
                        className="mt-2 inline-flex min-h-11 items-center text-[12px] font-semibold text-[hsl(var(--primary-light))] hover:underline"
                        href={`${buildAdminUsersHref(query, result.page, user.id)}#selected-user`}
                      >
                        View details
                      </Link>
                    </td>
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
                      {canManageAccess ? (
                        <AdminUserAccessForm user={user} path="/admin/users" />
                      ) : (
                        <span className="giq-badge giq-badge-neutral">Read only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="User directory pages">
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Page {result.page} of {result.pageCount} · {result.users.length} shown · {result.total} matching
          </p>
          <div className="flex flex-wrap gap-2">
            {result.page > 1 ? (
              <Link className="giq-outline-action" href={buildAdminUsersHref(query, result.page - 1)}>
                Previous
              </Link>
            ) : (
              <span className="giq-outline-action opacity-45" aria-disabled="true">Previous</span>
            )}
            {result.page < result.pageCount ? (
              <Link className="giq-outline-action" href={buildAdminUsersHref(query, result.page + 1)}>
                Next
              </Link>
            ) : (
              <span className="giq-outline-action opacity-45" aria-disabled="true">Next</span>
            )}
          </div>
        </nav>
      </section>
    </main>
  );
}

function UserMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">{label}</dt>
      <dd className="mt-1 text-[13px] font-semibold text-[hsl(var(--foreground))]">{value}</dd>
    </div>
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

function getUsers(query: AdminUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.selectedUserId ? { id: query.selectedUserId } : {}),
    ...(query.tier ? { subscriptionTier: query.tier } : {}),
    ...(query.role ? { profile: { is: { role: query.role } } } : {}),
  };

  return safeQuery<AdminUsersResult>(
    () =>
      withDbSystemContext(async (tx) => {
        const total = await tx.user.count({ where });
        const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const page = Math.min(query.page, pageCount);
        const users = await tx.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
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
        });

        return { page, pageCount, total, users };
      }),
    { page: 1, pageCount: 1, total: 0, users: [] }
  );
}

function parseAdminUsersQuery(
  searchParams: { [key: string]: string | string[] | undefined }
): AdminUsersQuery {
  const tierValue = singleQueryValue(searchParams.tier);
  const roleValue = singleQueryValue(searchParams.role);
  const pageValue = Number.parseInt(singleQueryValue(searchParams.page) ?? "1", 10);
  const selectedUserId = singleQueryValue(searchParams.user)?.trim() ?? "";

  return {
    tier: USER_TIERS.includes(tierValue as (typeof USER_TIERS)[number])
      ? (tierValue as AdminUsersQuery["tier"])
      : "",
    role: USER_ROLES.includes(roleValue as (typeof USER_ROLES)[number])
      ? (roleValue as AdminUsersQuery["role"])
      : "",
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    selectedUserId: ADMIN_USER_ID_PATTERN.test(selectedUserId)
      ? selectedUserId
      : null,
  };
}

function buildAdminUsersHref(
  query: AdminUsersQuery,
  page: number,
  selectedUserId?: string
) {
  const params = new URLSearchParams();
  if (query.tier) params.set("tier", query.tier);
  if (query.role) params.set("role", query.role);
  if (page > 1) params.set("page", String(page));
  if (selectedUserId) params.set("user", selectedUserId);
  const search = params.toString();
  return search ? `/admin/users?${search}` : "/admin/users";
}

function adminUserLookupMessage(status: string | undefined) {
  if (status === "invalid") {
    return "Enter a valid email address or exact user ID.";
  }
  if (status === "not-found") {
    return "No user matched that exact email address or user ID.";
  }
  if (status === "rate-limited") {
    return "User lookup is temporarily limited. Wait a minute and try again.";
  }
  return null;
}

function singleQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
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
