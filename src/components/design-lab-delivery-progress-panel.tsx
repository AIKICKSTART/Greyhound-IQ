import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Workflow,
} from "lucide-react";

import {
  DESIGN_LAB_DELIVERY_PROGRESS,
  DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY,
  type DesignLabDeliveryProgressStatus,
} from "./design-lab-delivery-progress";
import { DESIGN_LAB_SYNC_SNAPSHOT } from "./design-lab-sync";

const GATE_CATEGORY_SUMMARY = [
  ["Screen contracts", "screen:"],
  ["Master requirements", "master:"],
  ["Pre-production", "preproduction:"],
  ["Database operations", "database:"],
].map(([label, prefix]) => ({
  label,
  prefix,
  ...DESIGN_LAB_SYNC_SNAPSHOT.sections
    .filter((item) => item.id.startsWith(prefix))
    .reduce(
      (total, item) => ({
        completed: total.completed + item.completed,
        checks: total.checks + item.total,
      }),
      { completed: 0, checks: 0 },
    ),
}));

export function DesignLabDeliveryProgressPanel() {
  return (
    <section
      className="giq-panel mt-5 p-4 sm:p-6"
      aria-labelledby="design-lab-delivery-progress-heading"
      data-design-lab-delivery-progress
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
            <Workflow className="size-4" aria-hidden="true" />
            Active production-gate work
          </p>
          <h2
            id="design-lab-delivery-progress-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
          >
            Agent delivery progress
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
            This operational view shows what the team is fixing now. It does not
            relax the release gate: only independently verified evidence moves
            the production counters.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Metric
            label="Gate"
            value={`${DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks}/${DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks}`}
          />
          <Metric label="Verified" value={DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.verified} />
          <Metric label="Active" value={DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.active} />
          <Metric label="Waiting" value={DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.waiting} />
          <Metric label="Blocked" value={DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.blocked} />
          <Metric
            label="Sections"
            value={`${DESIGN_LAB_SYNC_SNAPSHOT.sectionSummary.complete}/${DESIGN_LAB_SYNC_SNAPSHOT.sectionSummary.total}`}
          />
        </dl>
      </div>

      <div
        className="mt-5 rounded-xl border border-sky-300/15 bg-sky-300/[0.035] p-4"
        data-design-lab-gate-explainer
      >
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-100">
          Verified evidence coverage — not a launch-readiness percentage
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {GATE_CATEGORY_SUMMARY.map((category) => (
            <div
              key={category.prefix}
              className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2"
              data-design-lab-gate-category={category.prefix.slice(0, -1)}
            >
              <dt className="text-[9px] text-[hsl(var(--muted-foreground))]">
                {category.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]">
                {category.completed}/{category.checks}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <details
        className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
        data-design-lab-sync-ledger
      >
        <summary className="flex min-h-11 cursor-pointer items-center py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[hsl(var(--secondary-light))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
          Canonical gate ledger · {DESIGN_LAB_SYNC_SNAPSHOT.sectionSummary.complete} complete ·{" "}
          {DESIGN_LAB_SYNC_SNAPSHOT.sectionSummary.open} open ·{" "}
          {DESIGN_LAB_SYNC_SNAPSHOT.sectionSummary.blocked} blocked
        </summary>
        <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
          Every row below is derived from the same registries as the production
          release gate. The sync command fails when a counter, workstream or
          evidence artifact disagrees with this ledger.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {DESIGN_LAB_SYNC_SNAPSHOT.sections.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2 text-[9px]"
              data-design-lab-sync-section={item.id}
              data-design-lab-sync-section-status={item.status}
            >
              <span className="min-w-0 truncate text-[hsl(var(--muted-foreground))]">
                {item.title}
              </span>
              <b className="shrink-0 text-[hsl(var(--foreground))]">
                {item.completed}/{item.total}
              </b>
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {DESIGN_LAB_DELIVERY_PROGRESS.map((item) => (
          <article
            key={item.id}
            className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
            data-delivery-progress-id={item.id}
            data-delivery-progress-status={item.status}
          >
            <div className="flex items-start gap-3">
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="break-all text-[9px] font-semibold text-[hsl(var(--primary-light))]">
                    {item.id}
                  </code>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <h3 className="mt-2 text-[13px] font-semibold leading-5 text-[hsl(var(--foreground))]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {item.summary}
                </p>
                {item.nextStep ? (
                  <p className="mt-2 text-[9px] leading-4 text-amber-100">
                    Next: {item.nextStep}
                  </p>
                ) : null}
                <p className="mt-3 text-[9px] text-[hsl(var(--subtle-foreground))]">
                  {item.owner} · updated {item.updatedAt}
                </p>
                <details className="mt-2 rounded-lg border border-white/[0.07] bg-black/10 p-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-[9px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--secondary-light))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
                    Evidence and checks
                  </summary>
                  <ul className="mt-2 min-w-0 max-w-full space-y-1 text-[9px] leading-4 text-[hsl(var(--muted-foreground))]">
                    {item.evidence.map((path) => (
                      <li key={path} className="min-w-0 max-w-full break-all font-mono">
                        {path}
                      </li>
                    ))}
                    {item.verification.map((check) => (
                      <li key={check}>✓ {check}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: DesignLabDeliveryProgressStatus }) {
  const className = "size-5";
  if (status === "verified") {
    return <CheckCircle2 className={`${className} text-emerald-200`} aria-hidden="true" />;
  }
  if (status === "in-progress") {
    return (
      <LoaderCircle
        className={`${className} motion-safe:animate-spin text-sky-200`}
        aria-hidden="true"
      />
    );
  }
  if (status === "waiting") {
    return <Clock3 className={`${className} text-amber-100`} aria-hidden="true" />;
  }
  return <CircleAlert className={`${className} text-rose-100`} aria-hidden="true" />;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-20 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-center">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function statusClass(status: DesignLabDeliveryProgressStatus) {
  if (status === "verified") {
    return "rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.07em] text-emerald-200";
  }
  if (status === "in-progress") {
    return "rounded-md border border-sky-300/20 bg-sky-300/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.07em] text-sky-100";
  }
  if (status === "waiting") {
    return "rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.07em] text-amber-100";
  }
  return "rounded-md border border-rose-300/20 bg-rose-300/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.07em] text-rose-100";
}
