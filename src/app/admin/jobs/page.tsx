import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin jobs - GreyhoundIQ",
  description: "Read-only GreyhoundIQ operational job status overview.",
};

const RECENT_PER_SOURCE = 8;
const RECENT_ROWS_LIMIT = 20;

type StatusCountRow = {
  status: string;
  _count: {
    _all: number;
  };
};

type JobStatusSummary = {
  source: string;
  description: string;
  counts: StatusCountRow[];
};

type OperationalJobRow = {
  source: string;
  category: string;
  status: string;
  retryCount: number | null;
  startedAt: Date;
  lastAttemptAt: Date | null;
  nextActionAt: Date | null;
  finishedAt: Date | null;
};

type UsageOutboxRow = {
  metricKey: string;
  status: string;
  retryCount: number;
  occurredAt: Date;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
};

type UsageEventRow = {
  metricKey: string;
  status: string;
  retryCount: number;
  occurredAt: Date;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
};

type WebhookEventRow = {
  eventType: string;
  status: string;
  retryCount: number;
  receivedAt: Date;
  processedAt: Date | null;
};

type AgentRunRow = {
  agentType: string;
  status: string;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: Date;
  completedAt: Date | null;
};

export default async function AdminJobsPage() {
  await requireModeratorProfile();
  const [summaries, recentRows] = await Promise.all([
    getJobStatusSummaries(),
    getRecentOperationalRows(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link href="/admin" className="giq-outline-action mb-6 w-fit">
        Back to admin
      </Link>

      <div className="grid gap-6">
        <section className="giq-panel p-6">
          <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
            Jobs
          </h1>
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Read-only local operational status across usage outbox, usage
            events, webhook events, and agent runs. Raw payloads, webhook
            bodies, metadata, errors, user identifiers, provider identifiers,
            emails, IP addresses, and user agents are not selected or displayed.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaries.map((summary) => (
              <StatusSummaryCard key={summary.source} summary={summary} />
            ))}
          </div>
        </section>

        <RecentOperationalTable rows={recentRows} />
      </div>
    </main>
  );
}

function StatusSummaryCard({ summary }: { summary: JobStatusSummary }) {
  const total = summary.counts.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="giq-metric-card">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {summary.source}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
        {formatCount(total)}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {summary.description}
      </p>
      <div className="mt-4 grid gap-2">
        {summary.counts.length === 0 ? (
          <StatusPill status="No rows" count={0} />
        ) : (
          summary.counts.map((row) => (
            <StatusPill
              key={`${summary.source}-${row.status}`}
              status={row.status}
              count={row._count._all}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ status, count }: { status: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <span className="text-[12px] text-[hsl(var(--foreground))]">
        {formatStatus(status)}
      </span>
      <span className="font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
        {formatCount(count)}
      </span>
    </div>
  );
}

function RecentOperationalTable({ rows }: { rows: OperationalJobRow[] }) {
  return (
    <section className="giq-panel p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
            Recent activity
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
            Local operational rows
          </h2>
        </div>
        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
          Latest {RECENT_ROWS_LIMIT} sanitized records
        </p>
      </div>

      <div className="giq-table-shell mt-6 overflow-x-auto">
        <table className="w-full min-w-[1180px]">
          <thead>
            <tr className="giq-table-head">
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Retries</th>
              <th className="px-4 py-3 text-left">Started</th>
              <th className="px-4 py-3 text-left">Last attempt</th>
              <th className="px-4 py-3 text-left">Next action</th>
              <th className="px-4 py-3 text-left">Finished</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                >
                  No local operational rows found.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`${row.source}-${row.category}-${row.startedAt.toISOString()}-${index}`}
                  className="border-t border-white/[0.06]"
                >
                  <TextCell>{row.source}</TextCell>
                  <MonoCell>{row.category}</MonoCell>
                  <TextCell>{formatStatus(row.status)}</TextCell>
                  <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                    {row.retryCount == null ? "N/A" : formatCount(row.retryCount)}
                  </td>
                  <DateCell date={row.startedAt} emptyLabel="Not recorded" />
                  <DateCell date={row.lastAttemptAt} emptyLabel="Not attempted" />
                  <DateCell date={row.nextActionAt} emptyLabel="Not scheduled" />
                  <DateCell date={row.finishedAt} emptyLabel="Not finished" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TextCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
      {children}
    </td>
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

async function getJobStatusSummaries(): Promise<JobStatusSummary[]> {
  const [usageOutbox, usageEvents, webhookEvents, agentRuns] = await Promise.all([
    getUsageOutboxStatusCounts(),
    getUsageEventStatusCounts(),
    getWebhookEventStatusCounts(),
    getAgentRunStatusCounts(),
  ]);

  return [
    {
      source: "Usage outbox",
      description: "Delivery queue records for locally captured usage.",
      counts: usageOutbox,
    },
    {
      source: "Usage events",
      description: "Local usage intake records before downstream delivery.",
      counts: usageEvents,
    },
    {
      source: "Webhook events",
      description: "Stored webhook processing records from the local database.",
      counts: webhookEvents,
    },
    {
      source: "Agent runs",
      description: "Local agent harness run records without prompts or outputs.",
      counts: agentRuns,
    },
  ];
}

function getUsageOutboxStatusCounts() {
  return safeQuery(
    async () => {
      const rows = await prisma.usageOutbox.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" },
      });
      return normalizeStatusCounts(rows);
    },
    []
  );
}

function getUsageEventStatusCounts() {
  return safeQuery(
    async () => {
      const rows = await prisma.usageEvent.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" },
      });
      return normalizeStatusCounts(rows);
    },
    []
  );
}

function getWebhookEventStatusCounts() {
  return safeQuery(
    async () => {
      const rows = await prisma.webhookEvent.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" },
      });
      return normalizeStatusCounts(rows);
    },
    []
  );
}

function getAgentRunStatusCounts() {
  return safeQuery(
    async () => {
      const rows = await prisma.agentRun.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" },
      });
      return normalizeStatusCounts(rows);
    },
    []
  );
}

function normalizeStatusCounts(rows: StatusCountRow[]): StatusCountRow[] {
  return rows.map((row) => ({
    status: row.status,
    _count: { _all: row._count._all },
  }));
}

async function getRecentOperationalRows(): Promise<OperationalJobRow[]> {
  const [usageOutbox, usageEvents, webhookEvents, agentRuns] = await Promise.all([
    getRecentUsageOutboxRows(),
    getRecentUsageEventRows(),
    getRecentWebhookEventRows(),
    getRecentAgentRunRows(),
  ]);

  return [
    ...usageOutbox.map(toUsageOutboxJobRow),
    ...usageEvents.map(toUsageEventJobRow),
    ...webhookEvents.map(toWebhookEventJobRow),
    ...agentRuns.map(toAgentRunJobRow),
  ]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, RECENT_ROWS_LIMIT);
}

function getRecentUsageOutboxRows() {
  return safeQuery<UsageOutboxRow[]>(
    () =>
      prisma.usageOutbox.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: RECENT_PER_SOURCE,
        select: {
          metricKey: true,
          status: true,
          retryCount: true,
          occurredAt: true,
          lastAttemptAt: true,
          nextRetryAt: true,
          sentAt: true,
          failedAt: true,
        },
      }),
    []
  );
}

function getRecentUsageEventRows() {
  return safeQuery<UsageEventRow[]>(
    () =>
      prisma.usageEvent.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: RECENT_PER_SOURCE,
        select: {
          metricKey: true,
          status: true,
          retryCount: true,
          occurredAt: true,
          lastAttemptAt: true,
          nextRetryAt: true,
          processedAt: true,
          failedAt: true,
        },
      }),
    []
  );
}

function getRecentWebhookEventRows() {
  return safeQuery<WebhookEventRow[]>(
    () =>
      prisma.webhookEvent.findMany({
        orderBy: [{ receivedAt: "desc" }],
        take: RECENT_PER_SOURCE,
        select: {
          eventType: true,
          status: true,
          retryCount: true,
          receivedAt: true,
          processedAt: true,
        },
      }),
    []
  );
}

function getRecentAgentRunRows() {
  return safeQuery<AgentRunRow[]>(
    () =>
      prisma.agentRun.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: RECENT_PER_SOURCE,
        select: {
          agentType: true,
          status: true,
          durationMs: true,
          promptTokens: true,
          completionTokens: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    []
  );
}

function toUsageOutboxJobRow(row: UsageOutboxRow): OperationalJobRow {
  return {
    source: "Usage outbox",
    category: row.metricKey,
    status: row.status,
    retryCount: row.retryCount,
    startedAt: row.occurredAt,
    lastAttemptAt: row.lastAttemptAt,
    nextActionAt: row.nextRetryAt,
    finishedAt: row.sentAt ?? row.failedAt,
  };
}

function toUsageEventJobRow(row: UsageEventRow): OperationalJobRow {
  return {
    source: "Usage event",
    category: row.metricKey,
    status: row.status,
    retryCount: row.retryCount,
    startedAt: row.occurredAt,
    lastAttemptAt: row.lastAttemptAt,
    nextActionAt: row.nextRetryAt,
    finishedAt: row.processedAt ?? row.failedAt,
  };
}

function toWebhookEventJobRow(row: WebhookEventRow): OperationalJobRow {
  return {
    source: "Webhook event",
    category: row.eventType,
    status: row.status,
    retryCount: row.retryCount,
    startedAt: row.receivedAt,
    lastAttemptAt: null,
    nextActionAt: null,
    finishedAt: row.processedAt,
  };
}

function toAgentRunJobRow(row: AgentRunRow): OperationalJobRow {
  return {
    source: "Agent run",
    category: formatAgentRunCategory(row),
    status: row.status,
    retryCount: null,
    startedAt: row.createdAt,
    lastAttemptAt: null,
    nextActionAt: null,
    finishedAt: row.completedAt,
  };
}

function formatAgentRunCategory(row: AgentRunRow) {
  const tokens = row.promptTokens ?? row.completionTokens;
  const duration = row.durationMs == null ? null : formatDuration(row.durationMs);
  const details = [duration, tokens == null ? null : `${formatCount(tokens)} tokens`]
    .filter(Boolean)
    .join(", ");

  return details ? `${row.agentType} (${details})` : row.agentType;
}

function formatStatus(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(value: number) {
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toLocaleString("en-AU", {
    maximumFractionDigits: 1,
  })}s`;
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
