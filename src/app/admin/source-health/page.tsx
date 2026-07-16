import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { StatusPill } from "@/components/admin/status-pill";
import {
  AdminSourceHealthForm,
  AdminStatusForm,
} from "@/app/admin/form-controls";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { requireAdminProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";
import { getLiveFeedStatus } from "@/lib/live/status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin source health - GreyhoundIQ",
  description: "Read-only GreyhoundIQ live source health overview.",
};

type LiveFeedStatus = Awaited<ReturnType<typeof getLiveFeedStatus>>;

type DataSourceHealthRow = {
  id: string;
  sourceProvider: string;
  status: string;
  lastCheckedAt: Date;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  latencyMs: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminSourceHealthPage() {
  const current = await requireAdminProfile();
  const [liveStatus, dataSourceHealthRows] = await Promise.all([
    getLiveFeedStatus(),
    getDataSourceHealthRows(current),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Source health"
        description="Live feed status from the local health helper plus editable DataSourceHealth rows. This page does not trigger provider imports or external feed calls."
      />

      <section className="giq-panel p-6">
        <div>
          <AdminSourceHealthForm path="/admin/source-health" />
        </div>

        <StatusSummary liveStatus={liveStatus} />
        <StatusDetails liveStatus={liveStatus} />
        <DataSourceHealthTable rows={dataSourceHealthRows} />
      </section>
    </main>
  );
}

function StatusSummary({ liveStatus }: { liveStatus: LiveFeedStatus }) {
  const configured = liveStatus.status === "configured";

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label="Feed status"
        value={configured ? "Configured" : "Waiting for credentials"}
      />
      <SummaryCard
        label="Active provider"
        value={liveStatus.activeProvider ?? "None"}
      />
      <SummaryCard
        label="Database"
        value={liveStatus.data.database === "ok" ? "OK" : "Error"}
      />
      <SummaryCard label="Updated" value={formatTimestamp(liveStatus.timestamp)} />
    </div>
  );
}

function StatusDetails({ liveStatus }: { liveStatus: LiveFeedStatus }) {
  const freshnessRows = [
    ["Upcoming meetings", formatCount(liveStatus.data.upcomingMeetings)],
    ["Upcoming races", formatCount(liveStatus.data.upcomingRaces)],
    ["Upcoming runners", formatCount(liveStatus.data.upcomingRunners)],
    ["Live sourced meetings", formatCount(liveStatus.data.liveSourcedMeetings)],
    ["Live sourced races", formatCount(liveStatus.data.liveSourcedRaces)],
    ["Total results", formatCount(liveStatus.data.totalResults)],
    ["Latest race", formatTimestamp(liveStatus.data.latestRaceTime, "None")],
    ["Latest result sync", formatTimestamp(liveStatus.data.latestResultAt, "None")],
    ["Live providers", formatLiveProviders(liveStatus.data.liveProviders)],
  ];

  return (
    <div className="mt-6 grid gap-4">
      {liveStatus.blockers.length > 0 && (
        <div className="rounded-lg border border-[hsl(var(--secondary)/0.18)] bg-[hsl(var(--secondary)/0.08)] p-4 text-[13px] text-[hsl(var(--secondary-light))]">
          <p className="font-semibold text-[hsl(var(--foreground))]">Blockers</p>
          <p className="mt-1">{liveStatus.blockers.join(", ")}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoPanel title="Scheduler">
          <StatusRow label="Primary" value={liveStatus.scheduler.primary} />
          <StatusRow
            label="Primary schedule"
            value={liveStatus.scheduler.primarySchedule}
          />
          <StatusRow label="Backup" value={liveStatus.scheduler.backup} />
          <StatusRow
            label="Backup schedule"
            value={liveStatus.scheduler.backupSchedule}
          />
        </InfoPanel>

        <InfoPanel title="Data freshness">
          {freshnessRows.map(([label, value]) => (
            <StatusRow key={label} label={label} value={value} />
          ))}
        </InfoPanel>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        data-source-feed-grid
      >
        {liveStatus.feeds.map((feed) => (
          <article
            key={feed.name}
            className="giq-subpanel min-w-0 p-4"
            data-live-feed={feed.name}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="break-words font-mono text-[12px] text-[hsl(var(--foreground))]">
                  {feed.name}
                </h3>
                <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                  {feed.role}
                </p>
              </div>
              <StatusPill value={feed.configured ? "configured" : "unknown"} />
            </div>
            <dl className="mt-4 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
              <FeedFact label="Implemented" value={formatBoolean(feed.implemented)} />
              <FeedFact label="Configured" value={formatBoolean(feed.configured)} />
              <FeedFact label="Blocking" value={formatBoolean(feed.blocking)} />
              <FeedFact label="Missing env" value={formatList(feed.missingEnv)} mono />
              <FeedFact label="Optional env" value={formatList(feed.optionalEnv)} mono />
            </dl>
          </article>
        ))}
      </div>

      <InfoPanel title="Status payload">
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/[0.08] bg-black/20 p-4 font-mono text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          {JSON.stringify(liveStatus, null, 2)}
        </pre>
      </InfoPanel>
    </div>
  );
}

function DataSourceHealthTable({ rows }: { rows: DataSourceHealthRow[] }) {
  return (
    <div className="mt-6">
      <h2 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        Data source health
      </h2>
      <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
        Local DataSourceHealth rows. Error text and provider payloads are not
        selected or displayed.
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2" data-source-health-grid>
        {rows.length === 0 ? (
          <p className="giq-subpanel p-5 text-[13px] text-[hsl(var(--muted-foreground))] lg:col-span-2">
            No data source health rows found.
          </p>
        ) : (
          rows.map((row) => (
            <article
              key={row.sourceProvider}
              className="giq-subpanel min-w-0 p-4"
              data-source-health-row={row.sourceProvider}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="min-w-0 break-words font-mono text-[12px] text-[hsl(var(--foreground))]">
                  {row.sourceProvider}
                </h3>
                <StatusPill value={row.status} />
              </div>
              <dl className="mt-4 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
                <FeedFact label="Last checked" value={formatTimestamp(row.lastCheckedAt)} />
                <FeedFact
                  label="Last success"
                  value={formatTimestamp(row.lastSuccessAt, "No success")}
                />
                <FeedFact
                  label="Last failure"
                  value={formatTimestamp(row.lastFailureAt, "No failure")}
                />
                <FeedFact label="Latency" value={formatLatency(row.latencyMs)} mono />
                <FeedFact label="Created" value={formatTimestamp(row.createdAt)} />
                <FeedFact label="Updated" value={formatTimestamp(row.updatedAt)} />
              </dl>
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <AdminStatusForm
                  resource="dataSourceHealth"
                  id={row.id}
                  currentStatus={row.status}
                  statuses={["ok", "degraded", "error", "unknown"]}
                  path="/admin/source-health"
                />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="giq-metric-card">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[hsl(var(--foreground))]">
        {value}
      </p>
    </div>
  );
}

function InfoPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="giq-subpanel p-4">
      <h2 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        {title}
      </h2>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
      <span className="text-[12px] text-[hsl(var(--subtle-foreground))]">
        {label}
      </span>
      <span className="text-right text-[12px] font-semibold text-[hsl(var(--foreground))]">
        {value}
      </span>
    </div>
  );
}

function FeedFact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[12px] text-[hsl(var(--foreground))] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatCount(value: number | null | undefined) {
  return value == null ? "Unavailable" : value.toLocaleString("en-AU");
}

function formatList(values: readonly string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

function formatLiveProviders(
  providers: LiveFeedStatus["data"]["liveProviders"]
) {
  if (providers.length === 0) return "None";
  return providers
    .map((provider) => `${provider.name ?? "unknown"} (${provider.meetings})`)
    .join(", ");
}

function getDataSourceHealthRows(current: CurrentUserProfile) {
  return safeQuery<DataSourceHealthRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.dataSourceHealth.findMany({
          orderBy: [{ lastCheckedAt: "desc" }, { sourceProvider: "asc" }],
          take: 100,
          select: {
            id: true,
            sourceProvider: true,
            status: true,
            lastCheckedAt: true,
            lastSuccessAt: true,
            lastFailureAt: true,
            latencyMs: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      ),
    []
  );
}

function formatLatency(value: number | null) {
  return value === null ? "Unavailable" : `${value.toLocaleString("en-AU")} ms`;
}

function formatTimestamp(
  value: string | Date | null | undefined,
  fallback = "Unavailable"
) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
