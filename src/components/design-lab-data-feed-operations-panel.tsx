import {
  Activity,
  AlertTriangle,
  DatabaseZap,
  ShieldAlert,
} from "lucide-react";

import {
  DESIGN_LAB_ALL_DATA_FEEDS,
  DESIGN_LAB_DATA_FEED_DISCOVERY_GAPS,
  DESIGN_LAB_DATA_FEED_GATES,
  type DesignLabDataFeed,
  type DesignLabDataFeedGate,
} from "./design-lab-data-feed-registry";

const runtimeSnapshotCount = DESIGN_LAB_ALL_DATA_FEEDS.filter(
  (feed) => feed.runtime.snapshot !== null,
).length;
const approvedThresholdCount = DESIGN_LAB_ALL_DATA_FEEDS.filter(
  (feed) =>
    feed.freshness.degradedAfterMinutes !== null &&
    feed.freshness.downAfterMinutes !== null,
).length;

/** Read-only source-contract and operational-evidence view for every reviewed data feed. */
export function DesignLabDataFeedOperationsPanel() {
  return (
    <section
      className="giq-panel mt-5 overflow-hidden p-4 sm:p-6"
      aria-labelledby="design-lab-data-feed-operations-heading"
      data-design-lab-data-feed-operations
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
            <DatabaseZap className="size-4" aria-hidden="true" />
            Read-only data operations registry
          </p>
          <h2
            id="design-lab-data-feed-operations-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
          >
            Every known feed, its lineage and its missing production proof
          </h2>
          <p className="mt-3 max-w-3xl text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
            This view reports reviewed source contracts only. It cannot start a
            sync, change a health state or approve a gate. Runtime values must
            arrive from an authoritative server snapshot; absent evidence is
            shown as unknown, never inferred as healthy.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Known feeds" value={DESIGN_LAB_ALL_DATA_FEEDS.length} />
          <Metric label="Blocking gates" value={DESIGN_LAB_DATA_FEED_GATES.length} />
          <Metric
            label="Runtime snapshots"
            value={`${runtimeSnapshotCount}/${DESIGN_LAB_ALL_DATA_FEEDS.length}`}
          />
          <Metric
            label="Approved thresholds"
            value={`${approvedThresholdCount}/${DESIGN_LAB_ALL_DATA_FEEDS.length}`}
          />
        </dl>
      </div>

      <div
        className="mt-5 flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4"
        role="status"
        data-runtime-evidence-state="absent"
      >
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-amber-100"
          aria-hidden="true"
        />
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.11em] text-amber-100">
            Runtime status: UNKNOWN for all 13 feeds
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
            Every registry entry currently has a null server snapshot. No
            approved refresh SLA, degraded threshold, down threshold, automated
            alert, exercised runbook or runtime evidence has been supplied.
          </p>
        </div>
      </div>

      <section
        className="mt-6"
        aria-labelledby="design-lab-data-feed-inventory-heading"
      >
        <div className="max-w-4xl">
          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[hsl(var(--secondary-light))]">
            Source inventory
          </p>
          <h3
            id="design-lab-data-feed-inventory-heading"
            className="mt-1 text-xl font-semibold"
          >
            Thirteen independently named ingestion pipelines
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
            Cards replace a wide desktop table so provider contracts, lineage
            and operational gaps remain readable on phones, tablets and the
            Design Lab operations desk.
          </p>
        </div>

        <div className="mt-4 grid gap-4">
          {DESIGN_LAB_ALL_DATA_FEEDS.map((feed) => (
            <DataFeedCard key={feed.id} feed={feed} />
          ))}
        </div>
      </section>

      <details className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/[0.035]">
        <summary className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.11em] text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light))]">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          Nine cross-feed discovery gaps
        </summary>
        <ol className="grid gap-2 border-t border-rose-300/15 px-4 py-4 sm:grid-cols-2">
          {DESIGN_LAB_DATA_FEED_DISCOVERY_GAPS.map((gap, index) => (
            <li
              key={gap}
              className="flex gap-3 rounded-lg border border-white/[0.07] bg-black/10 p-3 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]"
            >
              <span className="font-mono text-rose-100" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              {gap}
            </li>
          ))}
        </ol>
      </details>

      <section
        className="mt-6"
        aria-labelledby="design-lab-data-feed-gates-heading"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[hsl(var(--secondary-light))]">
              Fail-closed release controls
            </p>
            <h3
              id="design-lab-data-feed-gates-heading"
              className="mt-1 text-xl font-semibold"
            >
              Six data-feed gates block production
            </h3>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-rose-100">
            0 of 6 verified
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {DESIGN_LAB_DATA_FEED_GATES.map((gate) => (
            <DataFeedGateCard key={gate.id} gate={gate} />
          ))}
        </div>
      </section>
    </section>
  );
}

function DataFeedCard({ feed }: { feed: DesignLabDataFeed }) {
  const family = feedFamily(feed.id);
  const runtimeStatus = feed.runtime.snapshot?.status ?? "unknown";
  const cadence = feed.cadence.intervalMinutes.length
    ? `${feed.cadence.intervalMinutes.join(" and ")} minute code interval${feed.cadence.intervalMinutes.length > 1 ? "s" : ""}`
    : "No interval encoded; operator-triggered";
  const headingId = `data-feed-${feed.id.toLowerCase().replaceAll(".", "-")}`;

  return (
    <article
      className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-4 sm:p-5"
      aria-labelledby={headingId}
      data-feed-id={feed.id}
      data-feed-family={family.toLowerCase()}
      data-runtime-status={runtimeStatus}
      data-runtime-snapshot={feed.runtime.snapshot === null ? "absent" : "present"}
      data-freshness-threshold={
        feed.freshness.degradedAfterMinutes === null ||
        feed.freshness.downAfterMinutes === null
          ? "unknown"
          : "approved"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-4xl">
          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[hsl(var(--secondary-light))]">
            {family} source family · {feed.provider}
          </p>
          <h4
            id={headingId}
            className="mt-1 break-words text-base font-semibold text-[hsl(var(--foreground))]"
          >
            {feed.source}
          </h4>
          <code className="mt-2 block break-all text-[9px] text-[hsl(var(--subtle-foreground))]">
            {feed.id}
          </code>
        </div>
        <span className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 text-[9px] font-black uppercase tracking-[0.09em] text-amber-100">
          <Activity className="size-3.5" aria-hidden="true" />
          Runtime {runtimeStatus.toUpperCase()}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 border-y border-white/[0.07] py-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Source trigger" value={feed.cadence.sourceDeclaredTrigger} />
        <Fact label="Verified code cadence" value={cadence} />
        <Fact label="Refresh SLA" value="UNKNOWN — approval absent" />
        <Fact
          label="Freshness thresholds"
          value="UNKNOWN — degraded and down limits absent"
        />
        <Fact
          label="Accountable owner"
          value={`${feed.owner.accountableRole} proposed; named owner UNKNOWN`}
        />
        <Fact label="Runbook" value="UNKNOWN — not implemented or exercised" />
        <Fact
          label="Runtime evidence"
          value={`${feed.operations.runtimeEvidence.length} accepted items; server snapshot null`}
        />
        <Fact
          label="Source contract evidence"
          value={`${feed.operations.sourceEvidence.length} reviewed code paths`}
        />
      </dl>

      <details className="mt-3 rounded-lg border border-white/[0.07] bg-black/10">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-[10px] font-bold uppercase tracking-[0.09em] text-[hsl(var(--secondary-light))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light))]">
          Lineage, journeys, source facts and evidence gaps
        </summary>
        <div className="grid gap-4 border-t border-white/[0.07] p-3 lg:grid-cols-2">
          <DetailList label="Lineage" ordered values={feed.lineage} />
          <DetailList label="Downstream journeys" values={feed.downstreamJourneys} />
          <DetailList label="Verified code facts" values={feed.verifiedCodeFacts} />
          <DetailList label="Dependencies" values={feed.dependencies} />
          <DetailList
            label="Owner, SLA and operating gaps"
            values={feed.unknownOperatorMetadata}
          />
          <div>
            <h5 className="text-[9px] font-black uppercase tracking-[0.1em] text-[hsl(var(--subtle-foreground))]">
              Governance and evidence
            </h5>
            <dl className="mt-2 grid gap-2">
              <Fact label="Licence" value={feed.governance.licensing} />
              <Fact label="Runtime source" value="Server-supplied only; snapshot UNKNOWN" />
              <Fact
                label="Credential references"
                value={`${feed.auth.secretReferenceLabels.join(" · ")} — labels only; values never rendered`}
              />
              <Fact
                label="Reviewed source paths"
                value={feed.operations.sourceEvidence.join(" · ")}
              />
            </dl>
          </div>
        </div>
      </details>
    </article>
  );
}

function DataFeedGateCard({ gate }: { gate: DesignLabDataFeedGate }) {
  return (
    <article
      className="rounded-xl border border-rose-300/20 bg-rose-300/[0.035] p-4 sm:p-5"
      data-data-feed-gate={gate.id}
      data-release-blocking="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-[9px] text-rose-100">{gate.id}</p>
          <h4 className="mt-1 text-[13px] font-semibold leading-5">{gate.title}</h4>
        </div>
        <span className="rounded-md border border-rose-300/20 bg-rose-300/[0.06] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-rose-100">
          Release blocker · not verified
        </span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <Fact label="Surface" value={gate.surface} />
        <Fact label="Owner" value={gate.owner} />
        <Fact label="Accepted evidence" value={`${gate.evidence.length} items`} />
      </dl>
      <ol className="mt-3 grid gap-2" aria-label={`${gate.title} acceptance criteria`}>
        {gate.acceptanceCriteria.map((criterion, index) => (
          <li
            key={criterion}
            className="flex gap-3 rounded-lg border border-white/[0.07] bg-black/10 p-3 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]"
          >
            <span className="font-mono text-rose-100" aria-hidden="true">
              {index + 1}
            </span>
            {criterion}
          </li>
        ))}
      </ol>
    </article>
  );
}

function DetailList({
  label,
  ordered = false,
  values,
}: {
  label: string;
  ordered?: boolean;
  values: readonly string[];
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <h5 className="text-[9px] font-black uppercase tracking-[0.1em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </h5>
      <List className="mt-2 grid gap-1.5">
        {values.map((value, index) => (
          <li
            key={value}
            className="flex gap-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]"
          >
            <span className="font-mono text-[hsl(var(--secondary-light))]" aria-hidden="true">
              {ordered ? `${index + 1}.` : "•"}
            </span>
            <span className="break-words">{value}</span>
          </li>
        ))}
      </List>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-center">
      <dt className="text-[9px] font-black uppercase tracking-[0.11em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[8px] font-black uppercase tracking-[0.09em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
        {value}
      </dd>
    </div>
  );
}

function feedFamily(id: string) {
  return id.split(".")[2] ?? "UNKNOWN";
}
