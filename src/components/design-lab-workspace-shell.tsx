import {
  Blocks,
  ChevronDown,
  Library,
  ListChecks,
  Megaphone,
  Network,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DESIGN_LAB_SYNC_SNAPSHOT } from "@/components/design-lab-sync";
import {
  DESIGN_LAB_AREAS,
  designLabAreaHref,
  type DesignLabAreaId,
} from "@/components/design-lab-workspace";

const AREA_ICONS = {
  overview: Blocks,
  delivery: Rocket,
  architecture: Network,
  advertising: Megaphone,
  requirements: ListChecks,
  readiness: ShieldCheck,
  screens: Library,
} as const;

export function DesignLabWorkspaceShell({
  activeArea,
  basePath,
  children,
}: {
  activeArea: DesignLabAreaId;
  basePath: string;
  children: ReactNode;
}) {
  const active = DESIGN_LAB_AREAS.find((area) => area.id === activeArea)!;
  const releaseReady =
    DESIGN_LAB_SYNC_SNAPSHOT.release.status === "ready-for-approval";

  return (
    <>
      <div
        className="sticky top-2 z-30 mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[hsl(var(--background)/0.94)] p-2 shadow-xl backdrop-blur-xl md:grid-cols-3 2xl:grid-cols-6"
        aria-label="Design Lab live status"
        data-design-lab-status-ribbon
      >
        <StatusDatum
          label="Release"
          value={releaseReady ? "Ready for approval" : "Production locked"}
          tone={releaseReady ? "complete" : "blocked"}
        />
        <StatusDatum
          label="Verified"
          value={`${DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks} / ${DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks}`}
        />
        <StatusDatum
          label="Complete, awaiting verification"
          value={DESIGN_LAB_SYNC_SNAPSHOT.release.awaitingVerificationChecks.toLocaleString(
            "en-AU",
          )}
          tone="open"
        />
        <StatusDatum
          label="Implementation open"
          value={DESIGN_LAB_SYNC_SNAPSHOT.release.implementationOpenChecks.toLocaleString(
            "en-AU",
          )}
          tone="blocked"
        />
        <StatusDatum
          label="Team target"
          value={`${DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.window} · conditional`}
          tone="open"
        />
        <StatusDatum
          label="Registry sync"
          value={DESIGN_LAB_SYNC_SNAPSHOT.registrySync.status}
          tone={
            DESIGN_LAB_SYNC_SNAPSHOT.registrySync.status === "verified"
              ? "complete"
              : "open"
          }
        />
      </div>

      <details className="giq-panel group mt-4 p-2 2xl:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
          <span>Design Lab · {active.label}</span>
          <ChevronDown
            className="size-4 transition group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <DesignLabNavigation activeArea={activeArea} basePath={basePath} />
      </details>

      <div className="mt-5 grid items-start gap-5 2xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="giq-panel sticky top-28 hidden p-2 2xl:block">
          <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
            Mission control
          </p>
          <DesignLabNavigation activeArea={activeArea} basePath={basePath} />
          <div className="mx-2 mt-3 border-t border-white/[0.08] px-1 pt-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
            <b className="block text-[hsl(var(--foreground))]">
              Current evidence
            </b>
            <span className="block">
              {DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks.toLocaleString(
                "en-AU",
              )}
              /{DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks.toLocaleString(
                "en-AU",
              )} MVP verified ·{" "}
              {DESIGN_LAB_SYNC_SNAPSHOT.release.awaitingVerificationChecks.toLocaleString(
                "en-AU",
              )} complete awaiting verification
            </span>
            <span className="block">
              {DESIGN_LAB_SYNC_SNAPSHOT.release.implementationOpenChecks.toLocaleString(
                "en-AU",
              )} implementation checks open
            </span>
            <span className="block">
              {DESIGN_LAB_SYNC_SNAPSHOT.workstreams.verified}/
              {DESIGN_LAB_SYNC_SNAPSHOT.workstreams.total} workstreams verified ·{" "}
              {DESIGN_LAB_SYNC_SNAPSHOT.workstreams.active} active ·{" "}
              {DESIGN_LAB_SYNC_SNAPSHOT.workstreams.blocked} blocked
            </span>
            <span className="mt-1 block font-semibold text-amber-100">
              Target: {DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.window} ·{" "}
              {DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.teamSeats}-agent push
            </span>
          </div>
        </aside>

        <section
          aria-labelledby="design-lab-area-heading"
          data-design-lab-active-area={activeArea}
          className="min-w-0"
        >
          <header className="giq-panel mb-5 p-4 sm:p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
              {active.eyebrow}
            </p>
            <h2
              id="design-lab-area-heading"
              tabIndex={-1}
              className="mt-1 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
            >
              {active.label}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {active.description}
            </p>
          </header>
          {children}
        </section>
      </div>
    </>
  );
}

function DesignLabNavigation({
  activeArea,
  basePath,
}: {
  activeArea: DesignLabAreaId;
  basePath: string;
}) {
  return (
    <nav aria-label="Design Lab sections" className="grid gap-1 p-1">
      {DESIGN_LAB_AREAS.map((area) => {
        const Icon = AREA_ICONS[area.id];
        const current = area.id === activeArea;
        const status = DESIGN_LAB_SYNC_SNAPSHOT.missionControl[area.id];
        return (
          <Link
            key={area.id}
            href={designLabAreaHref(basePath, area.id)}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))] ${
              current
                ? "border border-[hsl(var(--primary-light)/0.28)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--foreground))]"
                : "border border-transparent text-[hsl(var(--muted-foreground))] hover:bg-white/[0.045] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <Icon
              className={`size-4 shrink-0 ${
                current
                  ? "text-[hsl(var(--secondary-light))]"
                  : "text-[hsl(var(--subtle-foreground))]"
              }`}
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">{area.label}</span>
            <span
              title={status.detail}
              data-design-lab-area-status={status.state}
              className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black tracking-[0.02em] ${areaStatusClass(status.state)}`}
            >
              {status.badge}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function areaStatusClass(state: "complete" | "active" | "blocked") {
  if (state === "complete") {
    return "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200";
  }
  if (state === "blocked") {
    return "border-rose-300/20 bg-rose-300/[0.06] text-rose-100";
  }
  return "border-amber-300/20 bg-amber-300/[0.06] text-amber-100";
}

function StatusDatum({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "complete" | "open" | "blocked";
}) {
  const toneClass = {
    neutral: "text-[hsl(var(--foreground))]",
    complete: "text-emerald-200",
    open: "text-amber-100",
    blocked: "text-rose-100",
  }[tone];
  return (
    <dl className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
      <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm font-semibold capitalize ${toneClass}`}>
        {value}
      </dd>
    </dl>
  );
}
