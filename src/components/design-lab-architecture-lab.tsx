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
const ARCHITECTURE_REPORT_SRC = `${ARCHITECTURE_REPORT_HREF}?sha=eb53328af77def0edee7f74e9a104149156956669b5e64927022384c9d6364de`;

export function DesignLabArchitectureLab() {
  return (
    <section
      className="giq-panel overflow-hidden"
      aria-labelledby="design-lab-architecture-heading"
      data-design-lab-architecture
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] p-4 sm:p-5">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
            <CircleDashed className="size-4" aria-hidden="true" />
            Current candidate · evidence unverified
          </p>
          <h3
            id="design-lab-architecture-heading"
            className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]"
          >
            <Network
              className="size-5 text-[hsl(var(--secondary-light))]"
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
          className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center"
          aria-label="Selected Australia production request path"
        >
          {ARCHITECTURE_PRIMARY_PATH.map((node, index) => (
            <li key={node} className="contents">
              <span className="flex min-h-14 items-center rounded-xl border border-[hsl(var(--primary-light)/0.24)] bg-[hsl(var(--primary)/0.09)] px-3 text-xs font-semibold leading-5">
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

        <details className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
            Infrastructure surface map
            <span className="text-xs text-emerald-200">
              {ARCHITECTURE_INFRASTRUCTURE_SURFACES.length}/32 source-mapped
            </span>
          </summary>
          <div className="grid gap-2 border-t border-white/[0.08] p-3 sm:grid-cols-2 xl:grid-cols-3">
            {ARCHITECTURE_INFRASTRUCTURE_SURFACES.map((surface) => (
              <article
                key={surface.id}
                className="rounded-lg border border-white/[0.07] bg-black/20 p-3"
                data-architecture-surface={surface.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold">{surface.label}</h4>
                  <EvidenceState value={surface.disposition} />
                </div>
                <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {surface.note}
                </p>
                <p className="mt-2 font-mono text-[9px] leading-4 text-[hsl(var(--primary-light)/0.76)]">
                  {surface.componentIds.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </details>

        <details className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
            Architecture component register
            <span className="text-xs text-[hsl(var(--secondary-light))]">
              {ARCHITECTURE_COMPONENTS.length} complete source records
            </span>
          </summary>
          <div className="grid gap-2 border-t border-white/[0.08] p-3 lg:grid-cols-2">
            {ARCHITECTURE_COMPONENTS.map((component) => (
              <article
                key={component.id}
                className="rounded-lg border border-white/[0.07] bg-black/20 p-3"
                data-architecture-component={component.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--primary-light)/0.72)]">
                      {component.layer}
                    </p>
                    <h4 className="mt-1 text-sm font-semibold">{component.name}</h4>
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
                <p className="mt-3 font-mono text-[9px] leading-4 text-[hsl(var(--subtle-foreground))]">
                  Evidence · {component.evidence.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </details>

        <details
          className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02]"
          open
        >
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
            Trust-boundary and data-flow map
            <span className="text-xs text-[hsl(var(--secondary-light))]">
              {ARCHITECTURE_TRUST_FLOWS.length}/16 required flows
            </span>
          </summary>
          <div className="grid gap-2 border-t border-white/[0.08] p-3 xl:grid-cols-2">
            {ARCHITECTURE_TRUST_FLOWS.map((flow) => (
              <article
                key={flow.id}
                className="rounded-lg border border-violet-200/10 bg-violet-200/[0.025] p-3"
                data-architecture-trust-flow={flow.id}
              >
                <h4 className="text-sm font-semibold">{flow.title}</h4>
                <ol
                  className="mt-2 flex flex-wrap items-center gap-1"
                  aria-label={`${flow.title} data path`}
                >
                  {flow.path.map((node, index) => (
                    <li key={`${flow.id}-${node}`} className="flex items-center gap-1">
                      <span className="rounded-md border border-white/[0.08] bg-black/25 px-2 py-1 text-[10px] leading-4">
                        {node}
                      </span>
                      {index < flow.path.length - 1 ? (
                        <ArrowRight
                          className="size-3 text-violet-200/65"
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
    <div>
      <dt className="font-black uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[hsl(var(--muted-foreground))]">{value}</dd>
    </div>
  );
}
