import { ArrowLeft, Building2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireCurrentUserProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account team - GreyhoundIQ",
  description: "Review your GreyhoundIQ organization memberships.",
};

const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const ACTION_CLASS = "giq-outline-action";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type TeamMembership = {
  organization: {
    name: string;
  };
  role: string;
  status: string;
  acceptedAt: Date | null;
  createdAt: Date;
};

export default async function AccountTeamPage() {
  const current = await requireTeamProfile();
  const memberships = await getTeamMemberships(current);

  return (
    <div>
      <TeamMemberHeader />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className={PANEL_CLASS}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Users
                className="h-5 w-5 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                  Organizations
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                  Read-only memberships linked to your account.
                </p>
              </div>
            </div>
            <span className="giq-status-pill">
              {memberships === null
                ? "Unavailable"
                : `${memberships.length.toLocaleString("en-AU")} linked`}
            </span>
          </div>

          {memberships === null ? (
            <UnavailableState />
          ) : memberships.length > 0 ? (
            <MembershipTable memberships={memberships} />
          ) : (
            <EmptyState />
          )}
        </section>
      </section>
    </div>
  );
}

function TeamMemberHeader() {
  return (
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
            Team
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Review read-only organization memberships linked through WorkOS.
          </p>
        </div>
        <Link href="/account" className={`${ACTION_CLASS} w-full sm:w-auto`}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to account
        </Link>
      </div>
    </header>
  );
}

async function requireTeamProfile() {
  try {
    return await requireCurrentUserProfile();
  } catch (err) {
    if (err instanceof Error && err.message === "auth.unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

async function getTeamMemberships(
  current: CurrentUserProfile
): Promise<TeamMembership[] | null> {
  return safeQuery<TeamMembership[] | null>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.membership.findMany({
          where: { userId: current.dbUserId },
          orderBy: [{ createdAt: "desc" }],
          select: {
            organization: {
              select: {
                name: true,
              },
            },
            role: true,
            status: true,
            acceptedAt: true,
            createdAt: true,
          },
        })
      ),
    null
  );
}

function MembershipTable({
  memberships,
}: {
  memberships: TeamMembership[];
}) {
  return (
    <div
      role="region"
      aria-label="Organization memberships"
      tabIndex={0}
      className="giq-table-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
    >
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <caption className="sr-only">
          WorkOS organization memberships for this account
        </caption>
        <thead>
          <tr className="giq-table-head">
            <th scope="col" className="px-4 py-3">Organization</th>
            <th scope="col" className="px-4 py-3">Role</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Accepted</th>
            <th scope="col" className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((membership, index) => (
            <tr
              key={`${membership.organization.name}-${membership.createdAt.toISOString()}-${index}`}
              className="giq-table-row"
            >
              <td className="px-4 py-4 font-semibold text-[hsl(var(--foreground))]">
                {membership.organization.name}
              </td>
              <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                {formatLabel(membership.role)}
              </td>
              <td className="px-4 py-4">
                <span className="giq-status-pill giq-status-pill-purple">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatLabel(membership.status)}
                </span>
              </td>
              <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                {formatDate(membership.acceptedAt)}
              </td>
              <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                {formatDate(membership.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="giq-dashed-panel px-5 py-10 text-center sm:px-8">
      <div className="giq-icon-plate mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        No organizations linked
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
        No WorkOS organization memberships are linked to this account yet.
      </p>
    </div>
  );
}

function UnavailableState() {
  return (
    <div
      className="giq-dashed-panel px-5 py-10 text-center sm:px-8"
      role="status"
    >
      <div className="giq-icon-plate mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        Organizations are temporarily unavailable
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
        Your memberships have not changed. Refresh this page in a moment to
        try again.
      </p>
    </div>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "Not recorded";
  return DATE_FORMATTER.format(value);
}

function formatLabel(value: string) {
  const text = value.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
