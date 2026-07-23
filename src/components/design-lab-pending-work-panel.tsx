"use client";

import { AlertTriangle, CheckCircle2, ListTodo, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK,
  DESIGN_LAB_PENDING_WORK,
  DESIGN_LAB_PENDING_WORK_SOURCES,
  DESIGN_LAB_PENDING_WORK_SUMMARY,
  DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW,
  filterDesignLabPendingWork,
  isDesignLabWorkAwaitingVerification,
  type DesignLabPendingWorkItem,
  type DesignLabPendingWorkSource,
} from "./design-lab-pending-work";

type CompletionFilter =
  | "all"
  | "pending"
  | "complete"
  | "awaiting-verification"
  | "blocked";

const SOURCE_LABELS: Record<DesignLabPendingWorkSource, string> = {
  screen: "Screen contracts",
  master: "Product and security",
  preproduction: "Pre-production",
  database: "Database operations",
};

export function DesignLabPendingWorkPanel() {
  const searchParams = useSearchParams();
  const [completion, setCompletion] = useState<CompletionFilter>(() =>
    parseCompletion(searchParams.get("workCompletion")),
  );
  const [source, setSource] = useState<"all" | DesignLabPendingWorkSource>(() =>
    parseSource(searchParams.get("workSource")),
  );
  const [productArea, setProductArea] = useState(
    () => searchParams.get("workArea") ?? "all",
  );
  const [owner, setOwner] = useState(
    () => searchParams.get("workOwner") ?? "all",
  );
  const [role, setRole] = useState(
    () => searchParams.get("workRole") ?? "all",
  );
  const [screen, setScreen] = useState(
    () => searchParams.get("workScreen") ?? "all",
  );
  const [dependency, setDependency] = useState(
    () => searchParams.get("workDependency") ?? "all",
  );
  const [query, setQuery] = useState("");

  const options = useMemo(
    () => ({
      productAreas: uniqueOptions(
        DESIGN_LAB_PENDING_WORK.map((item) => item.productArea),
      ),
      owners: uniqueOptions(DESIGN_LAB_PENDING_WORK.map((item) => item.owner)),
      roles: uniqueOptions(
        DESIGN_LAB_PENDING_WORK.flatMap((item) => item.roles),
      ),
      screens: uniqueOptions(
        DESIGN_LAB_PENDING_WORK.flatMap((item) =>
          item.screen ? [item.screen] : [],
        ),
      ),
      dependencies: uniqueOptions(
        DESIGN_LAB_PENDING_WORK.flatMap((item) => item.dependencies),
      ),
    }),
    [],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    setOrDelete(url.searchParams, "workCompletion", completion, "pending");
    setOrDelete(url.searchParams, "workSource", source, "all");
    setOrDelete(url.searchParams, "workArea", productArea, "all");
    setOrDelete(url.searchParams, "workOwner", owner, "all");
    setOrDelete(url.searchParams, "workRole", role, "all");
    setOrDelete(url.searchParams, "workScreen", screen, "all");
    setOrDelete(url.searchParams, "workDependency", dependency, "all");
    url.searchParams.delete("workQuery");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [completion, dependency, owner, productArea, role, screen, source]);

  const visible = useMemo(
    () =>
      filterDesignLabPendingWork({
        completion,
        source,
        productArea: selectedValue(productArea),
        owner: selectedValue(owner),
        role: selectedValue(role),
        screen: selectedValue(screen),
        dependency: selectedValue(dependency),
        query,
      }),
    [completion, dependency, owner, productArea, query, role, screen, source],
  );

  const groups = useMemo(() => groupWork(visible), [visible]);

  return (
    <section
      className="giq-panel mt-5 p-4 sm:p-6"
      aria-labelledby="design-lab-pending-work-heading"
      data-design-lab-pending-work
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
            <ListTodo className="size-4" aria-hidden="true" />
            Final production to-do · live registry sync
          </p>
          <h2
            id="design-lab-pending-work-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
          >
            Every remaining task before production approval
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
            This is the final list: every item is derived from the screen,
            product, security, pre-production and database registries. It
            updates when accepted evidence changes the owning gate; this view
            cannot hide, waive or manually mark work complete.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <WorkMetric label="All" value={DESIGN_LAB_PENDING_WORK_SUMMARY.total} />
          <WorkMetric
            label="Verified"
            value={DESIGN_LAB_PENDING_WORK_SUMMARY.complete}
          />
          <WorkMetric
            label="Pending"
            value={DESIGN_LAB_PENDING_WORK_SUMMARY.pending}
          />
          <WorkMetric
            label="Awaiting verification"
            value={DESIGN_LAB_PENDING_WORK_SUMMARY.awaitingVerification}
          />
          <WorkMetric
            label="Blocked"
            value={DESIGN_LAB_PENDING_WORK_SUMMARY.blocked}
          />
        </dl>
      </div>

      <details
        className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-4"
        data-design-lab-verification-refresh-workflow
      >
        <summary className="min-h-11 cursor-pointer py-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
          Final code-freeze refresh ·{" "}
          {DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.length.toLocaleString()} complete,
          awaiting verification
        </summary>
        <p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
          Captured evidence stays visible, but none of these items can become fresh
          verified until this workflow is rerun against one immutable candidate.
        </p>
        <ol className="mt-3 grid gap-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
          {DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW.steps.map((step, index) => (
            <li key={step}>
              <b className="mr-2 text-amber-100">{index + 1}.</b>
              {step}
            </li>
          ))}
        </ol>
        <ul className="mt-3 grid gap-1">
          {DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW.commands.map((command) => (
            <li key={command}>
              <code className="block overflow-x-auto rounded-md border border-white/[0.07] bg-black/15 px-3 py-2 text-[9px] text-[hsl(var(--subtle-foreground))]">
                {command}
              </code>
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WorkSelect
          label="Completion"
          value={completion}
          onChange={(value) => setCompletion(value as CompletionFilter)}
          options={[
            ["pending", "Pending only"],
            ["awaiting-verification", "Complete, awaiting verification"],
            ["blocked", "Blocked only"],
            ["complete", "Verified only"],
            ["all", "All states"],
          ]}
        />
        <WorkSelect
          label="Registry"
          value={source}
          onChange={(value) => {
            setSource(value as "all" | DesignLabPendingWorkSource);
            setProductArea("all");
          }}
          options={[
            ["all", "All registries"],
            ...DESIGN_LAB_PENDING_WORK_SOURCES.map(
              (value) => [value, SOURCE_LABELS[value]] as const,
            ),
          ]}
        />
        <WorkSelect
          label="Product area"
          value={productArea}
          onChange={setProductArea}
          options={withAll(options.productAreas, "All product areas")}
        />
        <WorkSelect
          label="Owner"
          value={owner}
          onChange={setOwner}
          options={withAll(options.owners, "All owners")}
        />
        <WorkSelect
          label="Role"
          value={role}
          onChange={setRole}
          options={withAll(options.roles, "All roles and actors")}
        />
        <WorkSelect
          label="Screen"
          value={screen}
          onChange={setScreen}
          options={withAll(options.screens, "All screens")}
        />
        <WorkSelect
          label="Dependency"
          value={dependency}
          onChange={setDependency}
          options={withAll(options.dependencies, "All dependencies")}
        />
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            Search everything
          </span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID, screen, role, dependency or evidence"
              className="giq-form-control min-h-11 w-full pl-10 pr-3"
            />
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-white/[0.07] py-3">
        <p
          className="text-[11px] text-[hsl(var(--muted-foreground))]"
          aria-live="polite"
        >
          Showing {visible.length.toLocaleString()} of{" "}
          {DESIGN_LAB_PENDING_WORK_SUMMARY.total.toLocaleString()} atomic release
          checks in {groups.length.toLocaleString()} groups.
        </p>
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-100">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Pending means production remains locked
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {groups.map((group) => (
          <PendingWorkGroup key={group.key} group={group} />
        ))}
        {groups.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] p-6 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
            No release checks match these filters.
          </p>
        ) : null}
      </div>
    </section>
  );
}

type WorkGroup = ReturnType<typeof groupWork>[number];

function PendingWorkGroup({ group }: { group: WorkGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03]"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-12 cursor-pointer list-none flex-col items-start justify-between gap-1 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light))] sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 break-words">
          <b className="text-[10px] uppercase tracking-[0.13em] text-[hsl(var(--secondary-light))]">
            {SOURCE_LABELS[group.source]}
          </b>
          <span className="ml-2 text-[12px] font-semibold text-[hsl(var(--foreground))]">
            {group.productArea}
          </span>
        </span>
        <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] sm:text-right">
          {group.complete}/{group.total} verified · {group.pending} remaining
          {group.awaitingVerification
            ? ` · ${group.awaitingVerification} awaiting verification`
            : ""}
          {group.items.length !== group.pending
            ? ` · ${group.items.length} shown`
            : ""}
          {group.blocked ? ` · ${group.blocked} blocked` : ""}
        </span>
      </summary>
      {open ? (
        <ol className="border-t border-white/[0.07]">
          {group.items.map((item) => (
            <PendingWorkRow key={item.id} item={item} />
          ))}
        </ol>
      ) : null}
    </details>
  );
}

function PendingWorkRow({ item }: { item: DesignLabPendingWorkItem }) {
  const awaitingVerification = isDesignLabWorkAwaitingVerification(item);
  const tags = [
    item.screen,
    ...item.roles.slice(0, 2),
    ...item.dependencies.slice(0, 2),
  ].filter(Boolean) as string[];

  return (
    <li
      className="grid gap-3 border-b border-white/[0.05] px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(180px,0.32fr)_minmax(0,1fr)_minmax(150px,0.25fr)]"
      data-pending-work-id={item.id}
      data-pending-work-complete={item.complete ? "true" : "false"}
      data-pending-work-awaiting-verification={
        awaitingVerification ? "true" : "false"
      }
    >
      <div>
        <code className="break-all text-[10px] font-semibold text-[hsl(var(--primary-light))]">
          {item.id}
        </code>
        <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
          {item.owner}
        </p>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
          {item.title}
        </p>
        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.09em] text-[hsl(var(--secondary-light))]">
          Next action
        </p>
        <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
          {item.description}
        </p>
        {tags.length ? (
          <p className="mt-2 text-[9px] leading-4 text-[hsl(var(--subtle-foreground))]">
            {tags.join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2 lg:justify-end">
        <span
          className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-[9px] font-bold uppercase tracking-[0.07em] ${item.complete ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200" : item.blocked ? "border-rose-300/20 bg-rose-300/[0.06] text-rose-100" : "border-amber-300/20 bg-amber-300/[0.06] text-amber-100"}`}
        >
          {item.complete ? (
            <CheckCircle2 className="size-3" aria-hidden="true" />
          ) : null}
          {awaitingVerification ? "Complete, awaiting verification" : item.status}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-[hsl(var(--subtle-foreground))]">
          {item.releaseBlocking ? "MVP launch blocker" : "Post-MVP / scale follow-up"}
        </span>
        <span className="text-[9px] text-[hsl(var(--subtle-foreground))]">
          {item.evidence.length} evidence
        </span>
      </div>
    </li>
  );
}

function WorkSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  const available = options.some(([option]) => option === value) ? value : "all";
  return (
    <label>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <select
        value={available}
        onChange={(event) => onChange(event.target.value)}
        className="giq-form-control min-h-11 w-full px-3"
      >
        {options.map(([option, optionLabel]) => (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function WorkMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-center">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold text-[hsl(var(--foreground))]">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function groupWork(items: readonly DesignLabPendingWorkItem[]) {
  const canonicalStats = new Map<
    string,
    {
      total: number;
      complete: number;
      pending: number;
      awaitingVerification: number;
      blocked: number;
    }
  >();
  for (const item of DESIGN_LAB_PENDING_WORK) {
    const key = `${item.source}:${item.productArea}`;
    const stats = canonicalStats.get(key) ?? {
      total: 0,
      complete: 0,
      pending: 0,
      awaitingVerification: 0,
      blocked: 0,
    };
    stats.total += 1;
    stats.complete += item.complete ? 1 : 0;
    stats.pending += item.complete ? 0 : 1;
    stats.awaitingVerification += isDesignLabWorkAwaitingVerification(item)
      ? 1
      : 0;
    stats.blocked += item.blocked ? 1 : 0;
    canonicalStats.set(key, stats);
  }

  const groups = new Map<
    string,
    {
      key: string;
      source: DesignLabPendingWorkSource;
      productArea: string;
      items: DesignLabPendingWorkItem[];
      total: number;
      complete: number;
      pending: number;
      awaitingVerification: number;
      blocked: number;
    }
  >();
  for (const item of items) {
    const key = `${item.source}:${item.productArea}`;
    const stats = canonicalStats.get(key);
    if (!stats) continue;
    const group = groups.get(key) ?? {
      key,
      source: item.source,
      productArea: item.productArea,
      items: [],
      ...stats,
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].toSorted((a, b) => a.key.localeCompare(b.key));
}

function uniqueOptions(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].toSorted((a, b) =>
    a.localeCompare(b),
  );
}

function withAll(values: readonly string[], label: string) {
  return [
    ["all", label],
    ...values.map((value) => [value, value] as const),
  ] as const;
}

function selectedValue(value: string) {
  return value === "all" ? undefined : value;
}

function setOrDelete(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string,
) {
  if (value === defaultValue) params.delete(key);
  else params.set(key, value);
}

function parseCompletion(value: string | null): CompletionFilter {
  return value === "all" ||
    value === "complete" ||
    value === "awaiting-verification" ||
    value === "blocked" ||
    value === "pending"
    ? value
    : "pending";
}

function parseSource(value: string | null): "all" | DesignLabPendingWorkSource {
  return DESIGN_LAB_PENDING_WORK_SOURCES.includes(
    value as DesignLabPendingWorkSource,
  )
    ? (value as DesignLabPendingWorkSource)
    : "all";
}
