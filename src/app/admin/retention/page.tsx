import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin retention - GreyhoundIQ",
  description: "Read-only GreyhoundIQ retention policy and deletion job overview.",
};

const RECENT_LIMIT = 20;

type RetentionPolicyRow = {
  id: string;
  code: string;
  targetType: string;
  retentionDays: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type DeletionJobRow = {
  id: string;
  policyId: string | null;
  targetType: string;
  targetUserId: string | null;
  status: string;
  scheduledFor: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminRetentionPage() {
  await requireModeratorProfile();
  const [policies, jobs] = await Promise.all([
    getRetentionPolicies(),
    getDeletionJobs(),
  ]);

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
          Retention
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Read-only retention policies and deletion jobs using only the approved
          operational identifiers, statuses, schedules, and timestamps.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MetricCard label="Policies shown" value={policies.length} />
          <MetricCard label="Deletion jobs shown" value={jobs.length} />
        </div>
      </section>

      <section className="giq-panel mt-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Policies
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
              Retention policies
            </h2>
          </div>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Latest {RECENT_LIMIT} by update time
          </p>
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Policy ID</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Target type</th>
                <th className="px-4 py-3 text-left">Days</th>
                <th className="px-4 py-3 text-left">Enabled</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No retention policies found.
                  </td>
                </tr>
              ) : (
                policies.map((policy) => (
                  <tr key={policy.id} className="border-t border-white/[0.06]">
                    <MonoCell>{policy.id}</MonoCell>
                    <MonoCell>{policy.code}</MonoCell>
                    <MonoCell>{policy.targetType}</MonoCell>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {formatCount(policy.retentionDays)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {formatBoolean(policy.enabled)}
                    </td>
                    <DateCell date={policy.createdAt} emptyLabel="Not recorded" />
                    <DateCell date={policy.updatedAt} emptyLabel="Not recorded" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="giq-panel mt-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Jobs
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
              Deletion jobs
            </h2>
          </div>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Latest {RECENT_LIMIT} by schedule time
          </p>
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1280px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Job ID</th>
                <th className="px-4 py-3 text-left">Policy ID</th>
                <th className="px-4 py-3 text-left">Target type</th>
                <th className="px-4 py-3 text-left">Target user ID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Scheduled</th>
                <th className="px-4 py-3 text-left">Completed</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No deletion jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-t border-white/[0.06]">
                    <MonoCell>{job.id}</MonoCell>
                    <MonoCell>{job.policyId ?? "No policy"}</MonoCell>
                    <MonoCell>{job.targetType}</MonoCell>
                    <MonoCell>{job.targetUserId ?? "No user"}</MonoCell>
                    <MonoCell>{job.status}</MonoCell>
                    <DateCell date={job.scheduledFor} emptyLabel="Not scheduled" />
                    <DateCell date={job.completedAt} emptyLabel="Not completed" />
                    <DateCell date={job.createdAt} emptyLabel="Not recorded" />
                    <DateCell date={job.updatedAt} emptyLabel="Not recorded" />
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="giq-metric-card">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
        {formatCount(value)}
      </p>
    </div>
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

function getRetentionPolicies() {
  return safeQuery<RetentionPolicyRow[]>(
    () =>
      prisma.retentionPolicy.findMany({
        orderBy: { updatedAt: "desc" },
        take: RECENT_LIMIT,
        select: {
          id: true,
          code: true,
          targetType: true,
          retentionDays: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    []
  );
}

function getDeletionJobs() {
  return safeQuery<DeletionJobRow[]>(
    () =>
      prisma.deletionJob.findMany({
        orderBy: { scheduledFor: "desc" },
        take: RECENT_LIMIT,
        select: {
          id: true,
          policyId: true,
          targetType: true,
          targetUserId: true,
          status: true,
          scheduledFor: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    []
  );
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatCount(value: number) {
  return value.toLocaleString("en-AU");
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
