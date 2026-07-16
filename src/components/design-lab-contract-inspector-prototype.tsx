"use client";

// PROTOTYPE: three contract-inspector layouts on the existing Design Lab route.
// Delete the losing variants and switcher after the review decision.

import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  FileCode2,
  LayoutPanelLeft,
  ListTree,
  Route as RouteIcon,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACT_COVERAGE_AREAS,
  type ScreenContract,
  type ScreenContractCoverageStatus,
} from "@/components/demo-experience-registry";
import { removeDesignLabTransientQueries } from "@/components/design-lab-url-state";

const PROTOTYPE_LAYOUTS = [
  { key: "A", label: "Split inspector" },
  { key: "B", label: "Audit table" },
  { key: "C", label: "Route dossier" },
] as const;

type PrototypeLayout = (typeof PROTOTYPE_LAYOUTS)[number]["key"];

const DEFAULT_CONTRACT = SCREEN_CONTRACT_BY_ROUTE.get("/dogs/[id]") ?? SCREEN_CONTRACTS[0]!;

export function DesignLabContractInspectorPrototype({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const layout = resolveLayout(searchParams.get("contractLayout"));
  const contract =
    SCREEN_CONTRACT_BY_ROUTE.get(searchParams.get("route") ?? "") ??
    DEFAULT_CONTRACT;

  if (process.env.NODE_ENV === "production" || !layout) return children;

  function replaceQuery(name: "contractLayout" | "route", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    removeDesignLabTransientQueries(next);
    next.set(name, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div
      className="relative pb-28"
      data-contract-inspector-prototype
      data-contract-layout={layout}
      data-selected-contract={contract.route}
    >
      <PrototypeHeader
        contract={contract}
        layout={layout}
        onRouteChange={(route) => replaceQuery("route", route)}
      />

      {layout === "A" ? (
        <SplitInspectorVariant
          contract={contract}
          onRouteChange={(route) => replaceQuery("route", route)}
        />
      ) : null}
      {layout === "B" ? (
        <AuditTableVariant
          contract={contract}
          onRouteChange={(route) => replaceQuery("route", route)}
        />
      ) : null}
      {layout === "C" ? <RouteDossierVariant contract={contract} /> : null}

      <PrototypeSwitcher
        current={layout}
        onChange={(next) => replaceQuery("contractLayout", next)}
      />
    </div>
  );
}

function PrototypeHeader({
  contract,
  layout,
  onRouteChange,
}: {
  contract: ScreenContract;
  layout: PrototypeLayout;
  onRouteChange: (route: string) => void;
}) {
  return (
    <header className="giq-panel mb-4 overflow-hidden p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-amber-200">
            Throwaway prototype · Layout {layout}
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
            Contract inspector comparison
          </h3>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            Read-only registry rendering. This comparison does not verify,
            test, approve, or otherwise complete an evidence gate.
          </p>
        </div>
        <Link
          href={contract.concreteRoute}
          target="_blank"
          rel="noopener noreferrer"
          className="giq-outline-action min-h-11 px-4 text-sm"
        >
          Open actual screen
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
          Allowlisted route contract
        </span>
        <select
          aria-label="Selected screen contract"
          className="giq-form-control min-h-11 w-full px-3 font-mono text-sm"
          value={contract.route}
          onChange={(event) => onRouteChange(event.target.value)}
        >
          {SCREEN_CONTRACTS.map((item) => (
            <option key={item.route} value={item.route}>
              {item.route} · {item.productArea}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}

function SplitInspectorVariant({
  contract,
  onRouteChange,
}: {
  contract: ScreenContract;
  onRouteChange: (route: string) => void;
}) {
  return (
    <section
      aria-label="Split registry and sticky inspector prototype"
      className="grid items-start gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]"
    >
      <aside className="giq-panel max-h-[74vh] overflow-y-auto p-3 sm:p-4">
        <div className="sticky top-0 z-10 mb-3 border-b border-white/[0.08] bg-[hsl(var(--background))] pb-3">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.13em] text-[hsl(var(--secondary-light))]">
            <LayoutPanelLeft className="size-4" aria-hidden="true" />
            Registry rail
          </p>
          <p className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
            {SCREEN_CONTRACTS.length} routes grouped by product area
          </p>
        </div>
        <div className="grid gap-4">
          {DEMO_SCREEN_FAMILIES.map((family) => (
            <section key={family.key} aria-labelledby={`prototype-family-${family.key}`}>
              <h4
                id={`prototype-family-${family.key}`}
                className="mb-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-[hsl(var(--subtle-foreground))]"
              >
                {family.label} · {family.screens.length}
              </h4>
              <div className="grid gap-1">
                {family.screens.map((screen) => {
                  const selected = screen.route === contract.route;
                  return (
                    <button
                      key={screen.route}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onRouteChange(screen.route)}
                      className={`min-h-10 rounded-lg border px-2.5 py-2 text-left font-mono text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))] ${
                        selected
                          ? "border-[hsl(var(--primary-light)/0.42)] bg-[hsl(var(--primary)/0.14)] text-white"
                          : "border-transparent bg-white/[0.025] text-[hsl(var(--muted-foreground))] hover:border-white/10 hover:text-white"
                      }`}
                    >
                      {screen.route}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <article className="giq-panel p-4 sm:p-6 xl:sticky xl:top-28">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[hsl(var(--primary-light))]">
              Sticky inspector
            </p>
            <h3 className="mt-2 text-2xl font-semibold">{contract.title}</h3>
            <code className="mt-1 block break-all text-[11px] text-[hsl(var(--secondary-light))]">
              {contract.route}
            </code>
          </div>
          <CoverageScore contract={contract} />
        </div>
        <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          {contract.description}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Fact label="Area" value={contract.productArea} />
          <Fact label="Access" value={contract.authentication} />
          <Fact label="Production" value={contract.productionEnabled ? "enabled" : "gated"} />
        </div>
        <CoverageGrid contract={contract} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InventoryList label="Primary actions" values={contract.primaryActions} />
          <InventoryList label="Supported states" values={contract.supportedStates} />
          <InventoryList label="Roles" values={contract.roles} />
          <InventoryList label="Source files" values={contract.sourceFiles} />
        </div>
      </article>
    </section>
  );
}

function AuditTableVariant({
  contract,
  onRouteChange,
}: {
  contract: ScreenContract;
  onRouteChange: (route: string) => void;
}) {
  return (
    <section aria-label="Dense audit table prototype" className="grid gap-4">
      <div className="giq-panel overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] p-4 sm:p-5">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-[hsl(var(--secondary-light))]">
              <ListTree className="size-4" aria-hidden="true" />
              Dense audit ledger
            </p>
            <h3 className="mt-1 text-xl font-semibold">Every contract in one scan</h3>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
            {SCREEN_CONTRACTS.length} rows
          </span>
        </div>
        <div
          className="grid max-h-[58vh] gap-2 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3"
          data-contract-audit-grid
        >
          {SCREEN_CONTRACTS.map((item) => {
            const selected = item.route === contract.route;
            return (
              <button
                key={item.route}
                type="button"
                aria-pressed={selected}
                onClick={() => onRouteChange(item.route)}
                className={`min-h-11 min-w-0 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))] ${
                  selected
                    ? "border-[hsl(var(--primary-light)/0.45)] bg-[hsl(var(--primary)/0.14)]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]"
                }`}
                data-contract-audit-card={item.route}
              >
                <span className="block break-all font-mono text-[10px] font-semibold text-white">
                  {item.route}
                </span>
                <span className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-[hsl(var(--muted-foreground))]">
                  <span className="break-words">{item.productArea}</span>
                  <span className="text-right capitalize">{item.authentication}</span>
                </span>
                <span className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <CoverageScore contract={item} compact />
                  <StatusChip
                    status={item.productionEnabled ? "verified" : "blocked"}
                    label={item.productionEnabled ? "enabled" : "gated"}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <article className="giq-panel grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[hsl(var(--primary-light))]">
            Selected row detail
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{contract.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{contract.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Fact label="Pattern" value={contract.routePattern ?? "static"} />
            <Fact label="Concrete" value={contract.concreteRoute} />
            <Fact label="Actors" value={contract.actors.join(", ")} />
            <Fact label="Tiers" value={contract.tiers.join(", ")} />
          </dl>
        </div>
        <CoverageGrid contract={contract} />
      </article>
    </section>
  );
}

function RouteDossierVariant({ contract }: { contract: ScreenContract }) {
  return (
    <section aria-label="Route dossier and evidence timeline prototype" className="grid gap-4">
      <article className="giq-panel overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
              <RouteIcon className="size-4" aria-hidden="true" />
              Route dossier
            </p>
            <code className="mt-4 block break-all text-xl font-semibold text-white sm:text-3xl">
              {contract.route}
            </code>
            <h3 className="mt-3 text-lg text-[hsl(var(--muted-foreground))]">{contract.title}</h3>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              {contract.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Product area" value={contract.productArea} />
            <Fact label="Authentication" value={contract.authentication} />
            <Fact label="Indexing" value={contract.noindex ? "noindex" : "indexable"} />
            <Fact label="Concrete route" value={contract.concreteRoute} />
          </div>
        </div>
      </article>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <article className="giq-panel p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.1em]">
            <ShieldCheck className="size-4 text-[hsl(var(--secondary-light))]" aria-hidden="true" />
            Evidence timeline
          </h3>
          <ol className="relative mt-5 grid gap-0 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-white/10">
            {SCREEN_CONTRACT_COVERAGE_AREAS.map((area, index) => {
              const claim = contract.coverage[area];
              return (
                <li key={area} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                  <span className="z-10 mt-1 grid size-6 place-items-center rounded-full border border-white/15 bg-[#15131a] text-[9px] font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b className="text-[11px] uppercase tracking-[0.1em]">{formatArea(area)}</b>
                      <StatusChip status={claim.status} />
                    </div>
                    <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--subtle-foreground))]">
                      {claim.evidence.length > 0
                        ? `${claim.evidence.length} linked evidence source${claim.evidence.length === 1 ? "" : "s"}`
                        : "No linked evidence yet"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </article>

        <aside className="giq-panel grid gap-5 p-4 sm:p-6 xl:sticky xl:top-28">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[hsl(var(--primary-light))]">
              <FileCode2 className="size-4" aria-hidden="true" />
              Implementation dossier
            </p>
            <CoverageScore contract={contract} />
          </div>
          <InventoryList label="Dynamic parameters" values={contract.dynamicParameters} />
          <InventoryList label="Query parameters" values={contract.queryParameters} />
          <InventoryList label="Roles" values={contract.roles} />
          <InventoryList label="Fixture IDs" values={contract.designLabFixtureIds} />
          <InventoryList label="Source files" values={contract.sourceFiles} />
        </aside>
      </div>
    </section>
  );
}

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: PrototypeLayout;
  onChange: (layout: PrototypeLayout) => void;
}) {
  const enabled = process.env.NODE_ENV !== "production";
  const currentIndex = PROTOTYPE_LAYOUTS.findIndex((item) => item.key === current);

  function cycle(offset: -1 | 1) {
    const next = PROTOTYPE_LAYOUTS[
      (currentIndex + offset + PROTOTYPE_LAYOUTS.length) % PROTOTYPE_LAYOUTS.length
    ];
    onChange(next.key);
  }

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!enabled) return null;

  const active = PROTOTYPE_LAYOUTS[currentIndex];
  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-200/30 bg-[#0b0a0e]/95 p-1.5 text-white shadow-2xl shadow-black/70 backdrop-blur-xl"
      aria-label="Contract inspector prototype layout"
    >
      <button
        type="button"
        onClick={() => cycle(-1)}
        className="grid size-11 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        aria-label="Previous prototype layout"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-32 px-2 text-center text-[11px] font-bold uppercase tracking-[0.11em]">
        {active.key} · {active.label}
      </span>
      <button
        type="button"
        onClick={() => cycle(1)}
        className="grid size-11 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        aria-label="Next prototype layout"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function CoverageGrid({ contract }: { contract: ScreenContract }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {SCREEN_CONTRACT_COVERAGE_AREAS.map((area) => (
        <div key={area} className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5">
          <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
            {formatArea(area)}
          </span>
          <StatusChip status={contract.coverage[area].status} />
        </div>
      ))}
    </div>
  );
}

function CoverageScore({
  contract,
  compact = false,
}: {
  contract: ScreenContract;
  compact?: boolean;
}) {
  const complete = SCREEN_CONTRACT_COVERAGE_AREAS.filter((area) =>
    isComplete(contract.coverage[area].status),
  ).length;
  return (
    <span className={compact ? "font-semibold text-emerald-200" : "mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1.5 text-[11px] font-bold text-emerald-200"}>
      {complete}/{SCREEN_CONTRACT_COVERAGE_AREAS.length} complete
    </span>
  );
}

function StatusChip({
  status,
  label = status,
}: {
  status: ScreenContractCoverageStatus;
  label?: string;
}) {
  const tone = isComplete(status)
    ? "text-emerald-200"
    : status === "blocked"
      ? "text-rose-200"
      : status === "captured"
        ? "text-amber-100"
        : "text-[hsl(var(--subtle-foreground))]";
  return <span className={`mt-1 block text-[10px] font-bold capitalize ${tone}`}>{label}</span>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
      <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </span>
      <span className="mt-1 block break-words text-[11px] font-semibold capitalize text-white">
        {value}
      </span>
    </div>
  );
}

function InventoryList({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <section>
      <h4 className="text-[10px] font-black uppercase tracking-[0.11em] text-[hsl(var(--secondary-light))]">{label}</h4>
      {values.length > 0 ? (
        <ul className="mt-2 grid gap-1.5">
          {values.map((value) => (
            <li key={value} className="break-all rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-[hsl(var(--subtle-foreground))]">None registered</p>
      )}
    </section>
  );
}

function resolveLayout(value: string | null): PrototypeLayout | null {
  return PROTOTYPE_LAYOUTS.find((item) => item.key === value)?.key ?? null;
}

function isComplete(status: ScreenContractCoverageStatus) {
  return status === "verified" || status === "tested" || status === "excluded";
}

function formatArea(area: (typeof SCREEN_CONTRACT_COVERAGE_AREAS)[number]) {
  return area.replace(/([a-z])([A-Z])/g, "$1 $2");
}
