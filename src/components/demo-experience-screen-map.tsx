"use client";

import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  ListChecks,
  LockKeyhole,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";

import {
  DEMO_SCREEN_COUNT,
  DEMO_SCREEN_FAMILIES,
  DEMO_USER_JOURNEYS,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACT_CHECKLIST,
  SCREEN_CONTRACT_COVERAGE_AREAS,
  type ScreenContractCoverageStatus,
} from "@/components/demo-experience-registry";
import {
  DESIGN_LAB_PRODUCTION_PROMOTION,
} from "@/components/design-lab-release-gate";
import { DESIGN_LAB_SYNC_SNAPSHOT } from "@/components/design-lab-sync";
import { DesignLabDeliveryProgressPanel } from "@/components/design-lab-delivery-progress-panel";
import { DesignLabDeploymentRace } from "@/components/design-lab-deployment-race";
import { DesignLabAdvertisingConsole } from "@/components/design-lab-advertising-console";
import { DesignLabArchitectureLab } from "@/components/design-lab-architecture-lab";
import { DesignLabContractInspectorPrototype } from "@/components/design-lab-contract-inspector-prototype";
import { DesignLabContractInspector } from "@/components/design-lab-contract-inspector";
import {
  DesignLabScenarioControls,
  DesignLabScenarioControlsFallback,
} from "@/components/design-lab-scenario-controls";
import { DesignLabDataFeedOperationsPanel } from "@/components/design-lab-data-feed-operations-panel";
import { DesignLabOperatingModelPanel } from "@/components/design-lab-operating-model-panel";
import { DesignLabPendingWorkPanel } from "@/components/design-lab-pending-work-panel";
import { DesignLabPreproductionChecklist } from "@/components/design-lab-preproduction-checklist";
import { DesignLabWorkspaceShell } from "@/components/design-lab-workspace-shell";
import {
  designLabAreaHref,
  type DesignLabAreaId,
} from "@/components/design-lab-workspace";
import { MasterAuditChecklist } from "@/components/master-audit-checklist";

export function DemoExperienceScreenMap({
  initialArea = "overview",
  initialContractRoute,
  basePath = "/design-lab",
}: {
  initialArea?: DesignLabAreaId;
  initialContractRoute?: string;
  basePath?: string;
}) {
  const [query, setQuery] = useState("");
  const [familyKey, setFamilyKey] = useState("all");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleFamilies = useMemo(
    () =>
      DEMO_SCREEN_FAMILIES.map((family) => ({
        ...family,
        screens: family.screens.filter((screen) => {
          const familyMatches = familyKey === "all" || family.key === familyKey;
          const queryMatches =
            !normalizedQuery ||
            screen.route.toLowerCase().includes(normalizedQuery) ||
            family.label.toLowerCase().includes(normalizedQuery) ||
            family.userStory.toLowerCase().includes(normalizedQuery);
          return familyMatches && queryMatches;
        }),
      })).filter((family) => family.screens.length > 0),
    [familyKey, normalizedQuery],
  );
  const visibleCount = visibleFamilies.reduce(
    (total, family) => total + family.screens.length,
    0,
  );

  return (
    <div
      data-demo-experience-map
      className="min-h-screen bg-[radial-gradient(circle_at_82%_0%,hsl(var(--primary)/0.17),transparent_34%),hsl(var(--background))] px-4 py-6 text-[hsl(var(--foreground))] sm:px-6 lg:px-10"
    >
      <style>{`
        body:has([data-demo-experience-map]) .giq-site-header,
        body:has([data-demo-experience-map]) .giq-member-header,
        body:has([data-demo-experience-map]) .giq-mobile-dock,
        body:has([data-demo-experience-map]) .giq-hub-conversation-dock,
        body:has([data-demo-experience-map]) .giq-footer-shell {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto max-w-[1500px]">
        <header className="giq-panel relative overflow-hidden p-5 sm:p-6">
          <div
            aria-hidden="true"
            className="race-box-strip absolute inset-x-5 top-0"
          />
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[hsl(var(--secondary-light))]">
                <Sparkles className="size-4" aria-hidden="true" />
                Production evidence workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                Design Lab mission control
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Navigate launch evidence, team delivery, commercial contracts
                and the complete GreyhoundIQ screen inventory without losing the
                canonical release state.
              </p>
            </div>
            <dl className="grid w-full grid-cols-3 gap-2 sm:w-auto">
              <Metric label="Screens" value={String(DEMO_SCREEN_COUNT)} />
              <Metric
                label="Families"
                value={String(DEMO_SCREEN_FAMILIES.length)}
              />
              <Metric
                label="Journeys"
                value={String(DEMO_USER_JOURNEYS.length)}
              />
            </dl>
            {basePath === "/design-lab/demo-experience" ? (
              <a
                className="giq-outline-action min-h-11 px-4 text-sm font-semibold"
                data-admin-frames-open
                href="/design-lab/demo-experience?view=admin-frames"
              >
                Review Control Centre frames
              </a>
            ) : null}
          </div>
        </header>

        <DesignLabWorkspaceShell activeArea={initialArea} basePath={basePath}>
          {initialArea === "overview" ? (
            <>
              <DesignLabDeploymentRace basePath={basePath} />
              <DesignLabOperatingModelPanel />
            </>
          ) : null}

          {initialArea === "overview" || initialArea === "requirements" ? (
            <section
              className="giq-panel mt-5 p-4 sm:p-6"
              aria-labelledby="contract-checklist-heading"
              data-design-lab-audit-checklist
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <h2
                    id="contract-checklist-heading"
                    className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]"
                  >
                    <ListChecks
                      className="size-5 text-[hsl(var(--secondary-light))]"
                      aria-hidden="true"
                    />
                    Product-contract capture checklist
                  </h2>
                  <p className="mt-2 text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
                    Every status is derived from the screen registry and its
                    evidence. Captured means the contract has been recorded;
                    only verified, tested or explicitly excluded work counts as
                    complete. Release approval is tracked separately.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
                    {SCREEN_CONTRACT_COVERAGE_AREAS.length} checks ×{" "}
                    {DEMO_SCREEN_COUNT} screens
                  </p>
                  {initialArea === "overview" ? (
                    <Link
                      href={designLabAreaHref(basePath, "requirements")}
                      prefetch={false}
                      className="giq-outline-action min-h-9 px-3 text-[10px] font-bold"
                    >
                      Open final to-do list
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {SCREEN_CONTRACT_CHECKLIST.map((item) => (
                  <article
                    key={item.area}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.12em] text-[hsl(var(--foreground))]">
                        {formatCoverageArea(item.area)}
                      </h3>
                      <b className="text-[12px] text-emerald-300">
                        {item.completed}/{item.total}
                      </b>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                      aria-label={`${formatCoverageArea(item.area)}: ${item.completed} of ${item.total} complete`}
                    >
                      <span
                        className="block h-full rounded-full bg-emerald-300"
                        style={{
                          width: `${(item.completed / item.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[9px] leading-4 text-[hsl(var(--subtle-foreground))]">
                      {item.captured} captured · {item.remaining} open
                      {item.blocked > 0 ? ` · ${item.blocked} blocked` : ""}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {initialArea === "delivery" ? (
            <DesignLabDeliveryProgressPanel />
          ) : null}

          {initialArea === "architecture" ? (
            <>
              <DesignLabArchitectureLab />
              <DesignLabDataFeedOperationsPanel />
            </>
          ) : null}

          {initialArea === "advertising" ? (
            <DesignLabAdvertisingConsole />
          ) : null}

          {initialArea === "requirements" ? (
            <Suspense fallback={<AuditChecklistFallback />}>
              <DesignLabPendingWorkPanel />
              <MasterAuditChecklist />
            </Suspense>
          ) : null}

          {initialArea === "readiness" ? (
            <DesignLabPreproductionChecklist />
          ) : null}

          {initialArea === "readiness" ? (
            <section
              className="giq-panel mt-5 p-4 sm:p-6"
              aria-labelledby="production-release-gate-heading"
              data-design-lab-production-gate={DESIGN_LAB_SYNC_SNAPSHOT.release.status}
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(340px,0.45fr)]">
                <div>
                  <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
                    <LockKeyhole className="size-4" aria-hidden="true" />
                    Production promotion control
                  </p>
                  <h2
                    id="production-release-gate-heading"
                    className="mt-2 text-xl font-semibold tracking-[-0.02em]"
                  >
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.status ===
                    "ready-for-approval"
                      ? "Ready for authorised production approval"
                      : "Production remains locked"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
                    The gate is derived from this checklist:{" "}
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks} of{" "}
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks} screen, product,
                    security, provider, capacity and database-query checks are
                    complete. A visual selection is not a release approval, and
                    browser input can never unlock production.
                  </p>
                  <div
                    className="mt-4 flex flex-wrap gap-2"
                    aria-label="Production release blockers"
                  >
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.blockers.map((blocker) => (
                      <span
                        key={blocker.area}
                        className="inline-flex min-h-8 items-center rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-100"
                      >
                        {formatCoverageArea(blocker.area)} · {blocker.remaining}{" "}
                        open
                      </span>
                    ))}
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.blockers.length === 0 ? (
                      <span className="inline-flex min-h-8 items-center rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-200">
                        All contract areas complete
                      </span>
                    ) : null}
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.masterBlockers.map(
                      (blocker) => (
                      <span
                        key={blocker.prompt}
                        className="inline-flex min-h-8 items-center rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-rose-100"
                      >
                        {blocker.prompt} master prompt · {blocker.remaining}{" "}
                        open
                      </span>
                      ),
                    )}
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.preproductionBlockers.map(
                      (blocker) => (
                        <span
                          key={blocker.system}
                          className="inline-flex min-h-8 items-center rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-rose-100"
                        >
                          {blocker.system} · {blocker.remaining} open
                          {blocker.blocked > 0
                            ? ` · ${blocker.blocked} blocked`
                            : ""}
                        </span>
                      ),
                    )}
                    {DESIGN_LAB_SYNC_SNAPSHOT.release.databaseBlocker ? (
                      <span className="inline-flex min-h-8 items-center rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-rose-100">
                        database query contracts ·{" "}
                        {DESIGN_LAB_SYNC_SNAPSHOT.release.databaseBlocker.remaining} open
                      </span>
                    ) : null}
                  </div>
                </div>

                <aside className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                  <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[hsl(var(--foreground))]">
                    <Rocket
                      className="size-4 text-[hsl(var(--primary-light))]"
                      aria-hidden="true"
                    />
                    Approved release path
                  </h3>
                  <ol className="mt-3 grid gap-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
                    <li>
                      1. Complete and test every registered Design Lab contract.
                    </li>
                    <li>
                      2. Generate the SHA-256 digest of that commit&apos;s
                      checklist evidence.
                    </li>
                    <li>
                      3. Approve the exact successful-CI commit and evidence
                      digest in the protected GitHub environment.
                    </li>
                    <li>
                      4. Deploy the resolved immutable image digest to{" "}
                      {DESIGN_LAB_PRODUCTION_PROMOTION.target}.
                    </li>
                  </ol>
                  <p className="mt-3 border-t border-white/[0.07] pt-3 text-[9px] leading-4 text-[hsl(var(--subtle-foreground))]">
                    {DESIGN_LAB_PRODUCTION_PROMOTION.dataBoundary}
                  </p>
                </aside>
              </div>
            </section>
          ) : null}

          {initialArea === "screens" ? (
            <DesignLabContractInspectorPrototype>
              <>
              <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
                <div className="giq-panel p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
                    <label className="relative block">
                      <span className="sr-only">Search demo screens</span>
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                        aria-hidden="true"
                      />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        type="search"
                        placeholder="Search routes or user stories"
                        className="giq-form-control min-h-11 w-full pl-10 pr-3"
                      />
                    </label>
                    <label>
                      <span className="sr-only">Filter screen family</span>
                      <select
                        value={familyKey}
                        onChange={(event) => setFamilyKey(event.target.value)}
                        className="giq-form-control min-h-11 w-full px-3"
                      >
                        <option value="all">All screen families</option>
                        {DEMO_SCREEN_FAMILIES.map((family) => (
                          <option key={family.key} value={family.key}>
                            {family.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p
                    className="mt-3 text-[11px] text-[hsl(var(--subtle-foreground))]"
                    aria-live="polite"
                  >
                    Showing {visibleCount} of {DEMO_SCREEN_COUNT} registered
                    screens.
                  </p>
                </div>

                <aside
                  className="giq-panel p-4 sm:p-5"
                  aria-labelledby="journey-heading"
                >
                  <h2
                    id="journey-heading"
                    className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--secondary-light))]"
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    End-to-end journeys
                  </h2>
                  <ol
                    className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]"
                    aria-label={`${DEMO_USER_JOURNEYS.length} end-to-end journeys`}
                    tabIndex={0}
                  >
                    {DEMO_USER_JOURNEYS.map((journey, index) => (
                      <li
                        key={journey}
                        className="flex gap-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"
                      >
                        <b className="text-[hsl(var(--primary-light))]">
                          {String(index + 1).padStart(2, "0")}
                        </b>
                        {journey}
                      </li>
                    ))}
                  </ol>
                </aside>
              </section>

              <Suspense fallback={<DesignLabScenarioControlsFallback />}>
                <DesignLabScenarioControls />
              </Suspense>

              <DesignLabContractInspector initialRoute={initialContractRoute} />

              <div className="mt-5 grid gap-5">
                {visibleFamilies.map((family) => (
                  <section
                    key={family.key}
                    className="giq-panel overflow-hidden p-4 sm:p-6"
                    aria-labelledby={`screen-family-${family.key}`}
                  >
                    <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.38fr)_minmax(0,1fr)]">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[hsl(var(--primary-light))]">
                          {family.audience}
                        </p>
                        <h2
                          id={`screen-family-${family.key}`}
                          className="mt-2 text-2xl font-semibold"
                        >
                          {family.label}
                        </h2>
                        <p className="mt-3 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
                          {family.userStory}
                        </p>
                        <h3 className="mt-5 text-[10px] font-black uppercase tracking-[0.15em] text-[hsl(var(--secondary-light))]">
                          Acceptance criteria
                        </h3>
                        <ul className="mt-2 grid gap-2">
                          {family.acceptance.map((criterion) => (
                            <li
                              key={criterion}
                              className="flex gap-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"
                            >
                              <CheckCircle2
                                className="mt-0.5 size-3.5 shrink-0 text-emerald-300"
                                aria-hidden="true"
                              />
                              {criterion}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {family.screens.map((screen) => {
                          const href = screen.href ?? screen.route;
                          const dynamic = screen.route.includes("[");
                          const contract = SCREEN_CONTRACT_BY_ROUTE.get(
                            screen.route,
                          )!;
                          const completedChecks =
                            SCREEN_CONTRACT_COVERAGE_AREAS.filter((area) =>
                              isCoverageComplete(
                                contract.coverage[area].status,
                              ),
                            ).length;
                          return (
                            <Link
                              key={screen.route}
                              href={href}
                              className="group flex min-h-36 min-w-0 flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary-light)/0.42)] hover:bg-[hsl(var(--primary)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]"
                            >
                              <span>
                                <code className="break-all text-[11px] font-semibold text-[hsl(var(--foreground))]">
                                  {screen.route}
                                </code>
                                <span className="mt-2 block text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300">
                                  {completedChecks}/
                                  {SCREEN_CONTRACT_COVERAGE_AREAS.length}{" "}
                                  complete
                                </span>
                                <span
                                  className="mt-2 grid grid-cols-3 gap-1"
                                  aria-label="Contract coverage"
                                >
                                  {SCREEN_CONTRACT_COVERAGE_AREAS.map(
                                    (area) => {
                                      const status =
                                        contract.coverage[area].status;
                                      const complete =
                                        isCoverageComplete(status);
                                      return (
                                        <span
                                          key={area}
                                          className={`inline-flex min-h-6 items-center gap-1 rounded-md border px-1.5 text-[8px] font-bold uppercase tracking-[0.05em] ${coverageTone(status)}`}
                                          title={`${formatCoverageArea(area)}: ${status}`}
                                        >
                                          {complete ? (
                                            <CheckCircle2
                                              className="size-2.5 shrink-0"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <CircleDashed
                                              className="size-2.5 shrink-0"
                                              aria-hidden="true"
                                            />
                                          )}
                                          {formatCoverageArea(area)}
                                        </span>
                                      );
                                    },
                                  )}
                                </span>
                              </span>
                              <span className="mt-3 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
                                {dynamic
                                  ? "Open runnable parent/sample"
                                  : "Open screen"}
                                <ExternalLink
                                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                                  aria-hidden="true"
                                />
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
              </>
            </DesignLabContractInspectorPrototype>
          ) : null}
        </DesignLabWorkspaceShell>
      </div>
    </div>
  );
}

function isCoverageComplete(status: ScreenContractCoverageStatus) {
  return status === "verified" || status === "tested" || status === "excluded";
}

function coverageTone(status: ScreenContractCoverageStatus) {
  if (isCoverageComplete(status)) {
    return "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200";
  }
  if (status === "blocked") {
    return "border-rose-300/20 bg-rose-300/[0.06] text-rose-200";
  }
  if (status === "captured") {
    return "border-amber-300/20 bg-amber-300/[0.06] text-amber-100";
  }
  return "border-white/[0.08] bg-white/[0.025] text-[hsl(var(--subtle-foreground))]";
}

function formatCoverageArea(
  area: (typeof SCREEN_CONTRACT_COVERAGE_AREAS)[number],
) {
  return area.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.09] bg-white/[0.035] p-2 text-center sm:min-w-24 sm:p-3">
      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
        {value}
      </dd>
    </div>
  );
}

function AuditChecklistFallback() {
  return (
    <section className="giq-panel mt-5 p-6" aria-busy="true">
      <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
        Loading the product and security requirement registry…
      </p>
    </section>
  );
}
