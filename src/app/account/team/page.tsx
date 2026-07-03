import { ArrowLeft, Building2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHero } from "@/components/page-hero";
import { requireCurrentUserProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account team - GreyhoundIQ",
  description: "Review your GreyhoundIQ organization memberships.",
};

const PANEL_CLASS = "giq-panel p-6";
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
  const memberships = await getTeamMemberships(current.dbUserId);

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Account
            <br />
            <span className="gradient-text">team.</span>
          </>
        }
        subtitle="Read-only organization memberships linked to your WorkOS account."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to account
        </Link>

        <section className={PANEL_CLASS}>
          <div className="mb-5 flex items-center gap-3">
            <Users className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
              Organizations
            </h2>
          </div>

          {memberships.length > 0 ? (
            <MembershipTable memberships={memberships} />
          ) : (
            <EmptyState />
          )}
        </section>
      </section>
    </div>
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

async function getTeamMemberships(userId: string): Promise<TeamMembership[]> {
  return safeQuery(
    () =>
      prisma.membership.findMany({
        where: { userId },
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
      }),
    []
  );
}

function MembershipTable({
  memberships,
}: {
  memberships: TeamMembership[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.03] text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
            <th className="px-4 py-3">Organization</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Accepted</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((membership, index) => (
            <tr
              key={`${membership.organization.name}-${membership.createdAt.toISOString()}-${index}`}
              className="border-b border-white/[0.05] last:border-0"
            >
              <td className="px-4 py-4 font-semibold text-[hsl(var(--foreground))]">
                {membership.organization.name}
              </td>
              <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                {formatLabel(membership.role)}
              </td>
              <td className="px-4 py-4">
                <span className="giq-status-pill giq-status-pill-purple">
                  <ShieldCheck className="h-3.5 w-3.5" />
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
    <div className="giq-dashed-panel p-5">
      <div className="giq-icon-plate mb-3 flex h-8 w-8 items-center justify-center rounded-md">
        <Building2 className="h-4 w-4" />
      </div>
      <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        No organizations linked
      </h3>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        This account has no local organization membership rows yet.
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
