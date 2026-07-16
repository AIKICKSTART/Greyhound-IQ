"use client";

import { Check, ClipboardCheck, Search, ShieldAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  MASTER_AUDIT_REQUIREMENTS,
  MASTER_AUDIT_SUMMARY,
  isMasterRequirementComplete,
  type MasterAuditPrompt,
  type MasterAuditRequirement,
} from "./master-audit-requirements";

type PromptFilter = "all" | MasterAuditPrompt;

export function MasterAuditChecklist() {
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState<PromptFilter>(() =>
    parsePromptFilter(searchParams.get("auditPrompt")),
  );
  const [section, setSection] = useState(
    () => searchParams.get("auditSection") || "all",
  );
  const [status, setStatus] = useState(
    () => searchParams.get("auditStatus") || "all",
  );
  const [query, setQuery] = useState("");

  const statuses = useMemo(
    () =>
      [...new Set(MASTER_AUDIT_REQUIREMENTS.map((item) => item.status))].sort(),
    [],
  );
  const sections = useMemo(
    () =>
      [
        ...new Set(
          MASTER_AUDIT_REQUIREMENTS.filter(
            (item) => prompt === "all" || item.prompt === prompt,
          ).map((item) => item.section),
        ),
      ].sort(),
    [prompt],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    setOrDelete(url.searchParams, "auditPrompt", prompt, "all");
    setOrDelete(url.searchParams, "auditSection", section, "all");
    setOrDelete(url.searchParams, "auditStatus", status, "all");
    url.searchParams.delete("auditQuery");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [prompt, section, status]);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      MASTER_AUDIT_REQUIREMENTS.filter((item) => {
        if (prompt !== "all" && item.prompt !== prompt) return false;
        if (section !== "all" && item.section !== section) return false;
        if (status !== "all" && item.status !== status) return false;
        if (!normalizedQuery) return true;
        return `${item.id} ${item.section} ${item.requirement} ${item.owner}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, prompt, section, status],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof visible>();
    for (const item of visible) {
      const key = `${item.prompt}:${item.section}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [visible]);
  const completed = MASTER_AUDIT_REQUIREMENTS.filter(
    isMasterRequirementComplete,
  ).length;

  return (
    <section
      className="giq-panel mt-5 p-4 sm:p-6"
      aria-labelledby="master-audit-checklist-heading"
      data-master-audit-checklist
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
            <ClipboardCheck className="size-4" aria-hidden="true" />
            Both master prompts · atomic source of truth
          </p>
          <h2
            id="master-audit-checklist-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
          >
            Product and security completion checklist
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
            Every explicit prompt requirement has a stable ID, owner, status and
            evidence field. Completed items are ticked automatically only after
            their evidence satisfies the completion contract. Empty evidence
            never counts as complete. Categorical filters persist in the URL
            so the review view can be shared; free-text search stays only in
            this browser tab.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <AuditMetric label="All items" value={MASTER_AUDIT_SUMMARY.total} />
          <AuditMetric
            label="Product"
            value={MASTER_AUDIT_SUMMARY.prompts.product}
          />
          <AuditMetric
            label="Security"
            value={MASTER_AUDIT_SUMMARY.prompts.security}
          />
          <AuditMetric label="Complete" value={completed} />
        </dl>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[0.7fr_1fr_0.8fr_1.5fr]">
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            Prompt
          </span>
          <select
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value as PromptFilter);
              setSection("all");
            }}
            className="giq-form-control min-h-11 w-full px-3"
          >
            <option value="all">Both prompts</option>
            <option value="product">Product and Design Lab</option>
            <option value="security">Security and traceability</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            Section
          </span>
          <select
            value={sections.includes(section) ? section : "all"}
            onChange={(event) => setSection(event.target.value)}
            className="giq-form-control min-h-11 w-full px-3"
          >
            <option value="all">All sections</option>
            {sections.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            Status
          </span>
          <select
            value={statuses.includes(status) ? status : "all"}
            onChange={(event) => setStatus(event.target.value)}
            className="giq-form-control min-h-11 w-full px-3"
          >
            <option value="all">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            Search requirements
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
              placeholder="ID, control, route, field or owner"
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
          Showing {visible.length} of {MASTER_AUDIT_SUMMARY.total} atomic
          requirements.
        </p>
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-100">
          <ShieldAlert className="size-4" aria-hidden="true" />
          {MASTER_AUDIT_SUMMARY.releaseBlocking -
            MASTER_AUDIT_SUMMARY.releaseCompleted}{" "}
          release-blocking checks remain open
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {grouped.map(([key, items]) => (
          <MasterAuditGroup key={key} items={items} />
        ))}
        {grouped.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] p-6 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
            No checklist items match these filters.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function MasterAuditGroup({
  items,
}: {
  items: readonly MasterAuditRequirement[];
}) {
  const [open, setOpen] = useState(false);
  const first = items[0];
  if (!first) return null;

  const groupComplete = items.filter(isMasterRequirementComplete).length;
  const outputExistenceOnly = items.every(
    (item) => item.verificationScope === "output-existence-only",
  );
  const finalReportStructureOnly = items.every(
    (item) => item.verificationScope === "final-report-structure-only",
  );

  return (
    <details
      className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03]"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-12 cursor-pointer list-none flex-col items-start justify-between gap-1 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light))] sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 break-words">
          <b className="text-[10px] uppercase tracking-[0.13em] text-[hsl(var(--secondary-light))]">
            {first.prompt}
          </b>
          <span className="ml-2 text-[12px] font-semibold text-[hsl(var(--foreground))]">
            {first.section}
          </span>
        </span>
        <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] sm:text-right">
          {groupComplete}/{items.length} complete
          {outputExistenceOnly ? " · output existence only" : ""}
          {finalReportStructureOnly ? " · final report structure only" : ""}
        </span>
      </summary>
      {open ? (
        <ol className="border-t border-white/[0.07]">
          {items.map((item) => {
            const complete = isMasterRequirementComplete(item);
            return (
              <li
                key={item.id}
                className="grid gap-2 border-b border-white/[0.05] px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(170px,0.34fr)_minmax(0,1fr)_minmax(150px,0.28fr)]"
                data-requirement-id={item.id}
                data-requirement-status={item.status}
                data-requirement-complete={complete ? "true" : "false"}
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
                  <p className="text-[12px] leading-5 text-[hsl(var(--foreground))]">
                    {item.requirement}
                  </p>
                  {item.notApplicableJustification ? (
                    <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
                      Not applicable: {item.notApplicableJustification}
                    </p>
                  ) : null}
                  {item.riskAcceptance ? (
                    <p className="mt-2 text-[10px] leading-5 text-amber-100">
                      Accepted {item.riskAcceptance.severity} risk · owner{" "}
                      {item.riskAcceptance.owner} · expires{" "}
                      {item.riskAcceptance.expiresOn} ·{" "}
                      {item.riskAcceptance.reason}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-start justify-between gap-2 lg:justify-end">
                  <span
                    role="checkbox"
                    aria-checked={complete}
                    aria-readonly="true"
                    aria-label={`${complete ? "Completed" : "Open"} checklist item ${item.id}`}
                    className={`grid size-7 shrink-0 place-items-center rounded-md border ${complete ? "border-emerald-300/30 bg-emerald-300/[0.12] text-emerald-200" : "border-white/[0.14] bg-white/[0.025] text-transparent"}`}
                  >
                    {complete ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span
                    className={`inline-flex min-h-7 items-center rounded-md border px-2 text-[9px] font-bold uppercase tracking-[0.07em] ${complete ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200" : "border-amber-300/20 bg-amber-300/[0.06] text-amber-100"}`}
                  >
                    {item.status}
                  </span>
                  <span className="text-[9px] text-[hsl(var(--subtle-foreground))]">
                    {item.evidence.length} evidence
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </details>
  );
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

function parsePromptFilter(value: string | null): PromptFilter {
  return value === "product" || value === "security" ? value : "all";
}

function AuditMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-center">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold text-[hsl(var(--foreground))]">
        {value}
      </dd>
    </div>
  );
}
