import { ArrowRight, CircleDashed, ExternalLink, Network } from "lucide-react";
import Link from "next/link";

import {
  ARCHITECTURE_COMPONENTS,
  ARCHITECTURE_EVIDENCE_SCOPE,
  ARCHITECTURE_INFRASTRUCTURE_SURFACES,
  ARCHITECTURE_PRIMARY_PATH,
  ARCHITECTURE_TRUST_FLOWS,
  type ArchitectureEvidenceState,
} from "./design-lab-architecture-inventory";

const ARCHITECTURE_REPORT_HREF =
  "/greyhoundiq-production-architecture.html";
const ARCHITECTURE_REPORT_SRC = `${ARCHITECTURE_REPORT_HREF}?sha=57dde59d7e08e322d32eb5a0a097d046b3ea88eb91061a014dc3f0bdccba1258`;

export function DesignLabArchitectureLab() {
  return (
    <section
      className="giq-panel min-w-0 max-w-full overflow-hidden"
      aria-labelledby="design-lab-architecture-heading"
      data-design-lab-architecture
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] p-4 sm:p-5">
        <div className="min-w-0 max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
            <CircleDashed className="size-4" aria-hidden="true" />
            Current candidate · evidence unverified
          </p>
          <h3
            id="design-lab-architecture-heading"
            className="mt-2 flex min-w-0 items-start gap-2 break-words text-xl font-semibold tracking-[-0.02em]"
          >
            <Network
              className="mt-0.5 size-5 shrink-0 text-[hsl(var(--secondary-light))]"
              aria-hidden="true"
            />
            GreyhoundIQ production architecture
          </h3>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            This is the current 30-section capacity, security and resilience
            plan. Runtime, failover, restore and load-test gates remain
            unverified until their evidence passes the release gate.
          </p>
        </div>
        <Link
          href={ARCHITECTURE_REPORT_SRC}
          target="_blank"
          rel="noreferrer"
          className="giq-outline-action min-h-11 px-4 text-sm"
        >
          Open full report
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>
      </header>

      <div
        className="border-b border-white/[0.08] bg-black/20 p-4 sm:p-5"
        data-architecture-evidence-scope="source-static"
      >
        <div className="rounded-xl border border-amber-200/20 bg-amber-200/[0.045] p-3 text-xs leading-5 text-amber-50">
          <b className="block text-[10px] uppercase tracking-[0.12em]">
            Evidence boundary
          </b>
          {ARCHITECTURE_EVIDENCE_SCOPE}
        </div>

        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          <EvidenceCount
            label="Infrastructure surfaces"
            value={ARCHITECTURE_INFRASTRUCTURE_SURFACES.length}
          />
          <EvidenceCount
            label="Component records"
            value={ARCHITECTURE_COMPONENTS.length}
          />
          <EvidenceCount
            label="Trust flows"
            value={ARCHITECTURE_TRUST_FLOWS.length}
          />
        </dl>

        <ol
          className="mt-3 grid min-w-0 max-w-full gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center"
          aria-label="Selected Australia production request path"
          data-architecture-primary-path
        >
          {ARCHITECTURE_PRIMARY_PATH.map((node, index) => (
            <li key={node} className="contents">
              <span
                className="flex min-h-14 min-w-0 max-w-full items-center break-words rounded-xl border border-[hsl(var(--primary-light)/0.24)] bg-[hsl(var(--primary)/0.09)] px-3 text-xs font-semibold leading-5 [overflow-wrap:anywhere]"
                data-architecture-bounded-node
              >
                {node}
              </span>
              {index < ARCHITECTURE_PRIMARY_PATH.length - 1 ? (
                <ArrowRight
                  className="mx-auto size-4 rotate-90 text-[hsl(var(--secondary-light)/0.8)] lg:rotate-0"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          ))}
        </ol>

        <details className="mt-3 min-w-0 max-w-full rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <summary className="flex min-h-12 cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
            Infrastructure surface map
            <span className="max-w-full break-words text-right text-xs text-emerald-200">
              {ARCHITECTURE_INFRASTRUCTURE_SURFACES.length}/32 source-mapped
            </span>
          </summary>
          <div className="grid gap-2 border-t border-white/[0.08] p-3 sm:grid-cols-2 xl:grid-cols-3">
            {ARCHITECTURE_INFRASTRUCTURE_SURFACES.map((surface) => (
              <article
                key={surface.id}
                className="min-w-0 max-w-full rounded-lg border border-white/[0.07] bg-black/20 p-3"
                data-architecture-surface={surface.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold">{surface.label}</h4>
                  <EvidenceState value={surface.disposition} />
                </div>
                <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {surface.note}
                </p>
                <p className="mt-2 max-w-full break-words font-mono text-[9px] leading-4 text-[hsl(var(--primary-light)/0.76)] [overflow-wrap:anywhere]">
                  {surface.componentIds.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </details>

        <details className="mt-3 min-w-0 max-w-full rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <summary className="flex min-h-12 cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
            Architecture component register
            <span className="max-w-full break-words text-right text-xs text-[hsl(var(--secondary-light))]">
              {ARCHITECTURE_COMPONENTS.length} complete source records
            </span>
          </summary>
          <div className="grid gap-2 border-t border-white/[0.08] p-3 lg:grid-cols-2">
            {ARCHITECTURE_COMPONENTS.map((component) => (
              <article
                key={component.id}
                className="min-w-0 max-w-full rounded-lg border border-white/[0.07] bg-black/20 p-3"
                data-architecture-component={component.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--primary-light)/0.72)]">
                      {component.layer}
                    </p>
                    <h4 className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">
                      {component.name}
                    </h4>
                  </div>
                  <EvidenceState value={component.evidenceState} />
                </div>
                <dl className="mt-3 grid gap-2 text-[11px] leading-5 sm:grid-cols-2">
                  <ComponentDatum label="Exposure" value={component.publicOrPrivateExposure} />
                  <ComponentDatum label="Authentication" value={component.authenticationMethod} />
                  <ComponentDatum label="Network" value={component.networkRestrictions} />
                  <ComponentDatum label="Data" value={component.dataProcessed.join(", ")} />
                  <ComponentDatum label="Failure" value={component.failureImpact} />
                  <ComponentDatum label="Recovery" value={component.recoveryMethod} />
                </dl>
                <p className="mt-3 max-w-full break-words font-mono text-[9px] leading-4 text-[hsl(var(--subtle-foreground))] [overflow-wrap:anywhere]">
                  Evidence · {component.evidence.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </details>

        <details
          className="mt-3 min-w-0 max-w-full rounded-xl border border-white/[0.08] bg-white/[0.02]"
          open
        >
          <summary className="flex min-h-12 cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
            Trust-boundary and data-flow map
            <span className="max-w-full break-words text-right text-xs text-[hsl(var(--secondary-light))]">
              {ARCHITECTURE_TRUST_FLOWS.length}/16 required flows
            </span>
          </summary>
          <div className="grid gap-2 border-t border-white/[0.08] p-3 xl:grid-cols-2">
            {ARCHITECTURE_TRUST_FLOWS.map((flow) => (
              <article
                key={flow.id}
                className="min-w-0 max-w-full rounded-lg border border-violet-200/10 bg-violet-200/[0.025] p-3"
                data-architecture-trust-flow={flow.id}
              >
                <h4 className="text-sm font-semibold">{flow.title}</h4>
                <ol
                  className="mt-2 grid min-w-0 max-w-full gap-1 sm:flex sm:flex-wrap sm:items-center"
                  aria-label={`${flow.title} data path`}
                  data-architecture-bounded-flow
                >
                  {flow.path.map((node, index) => (
                    <li
                      key={`${flow.id}-${node}`}
                      className="grid min-w-0 max-w-full justify-items-start gap-1 sm:flex sm:items-center"
                    >
                      <span
                        className="min-w-0 max-w-full break-words rounded-md border border-white/[0.08] bg-black/25 px-2 py-1 text-[10px] leading-4 [overflow-wrap:anywhere]"
                        data-architecture-bounded-node
                      >
                        {node}
                      </span>
                      {index < flow.path.length - 1 ? (
                        <ArrowRight
                          className="ml-2 size-3 rotate-90 text-violet-200/65 sm:ml-0 sm:rotate-0"
                          aria-hidden="true"
                        />
                      ) : null}
                    </li>
                  ))}
                </ol>
                <dl className="mt-3 grid gap-2 text-[10px] leading-4 sm:grid-cols-2">
                  <ComponentDatum label="Trust boundaries" value={flow.trustBoundaries.join(" · ")} />
                  <ComponentDatum label="Authn boundary" value={flow.authenticationBoundaries.join(" · ")} />
                  <ComponentDatum label="Authz boundary" value={flow.authorizationBoundaries.join(" · ")} />
                  <ComponentDatum label="Sensitive flow" value={flow.sensitiveDataFlows.join(" · ")} />
                </dl>
              </article>
            ))}
          </div>
        </details>
      </div>

      <div
        className="border-t border-white/[0.08] bg-black/30 p-4 lg:hidden"
        data-architecture-mobile-report
      >
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
          Open the report full-screen on this device
        </p>
        <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
          Mobile tables use compact disclosure cards and diagrams switch to
          readable vertical flow steps derived from the same architecture
          source. Opening the standalone view avoids a nested scroll area
          inside Design Lab.
        </p>
        <Link
          href={ARCHITECTURE_REPORT_SRC}
          target="_blank"
          rel="noreferrer"
          className="giq-outline-action mt-3 min-h-11 w-full px-4 text-sm"
        >
          Open responsive architecture report
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <iframe
        src={ARCHITECTURE_REPORT_SRC}
        title="GreyhoundIQ production architecture report"
        data-architecture-report-frame
        className="hidden h-[78vh] min-h-[680px] w-full border-0 bg-black lg:block"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </section>
  );
}

function EvidenceCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-emerald-200">{value}</dd>
    </div>
  );
}

function EvidenceState({ value }: { value: ArchitectureEvidenceState }) {
  const tone =
    value === "current-source"
      ? "border-emerald-200/20 text-emerald-200"
      : value === "selected-target"
        ? "border-[hsl(var(--primary-light)/0.28)] text-[hsl(var(--primary-light))]"
        : "border-amber-200/20 text-amber-100";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] ${tone}`}
    >
      {value.replaceAll("-", " ")}
    </span>
  );
}

function ComponentDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 max-w-full">
      <dt className="font-black uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-0.5 max-w-full break-words text-[hsl(var(--muted-foreground))] [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}
