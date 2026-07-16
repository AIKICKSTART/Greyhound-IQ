import {
  Check,
  Database,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";

import { DATABASE_OPERATIONS } from "../../security/database-operations";
import {
  DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY,
} from "../../security/local-data-policy";
import {
  DESIGN_LAB_DATABASE_CONTRACT_SUMMARY,
  isDesignLabDatabaseOperationComplete,
} from "./design-lab-database-contracts";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  DESIGN_LAB_PREPRODUCTION_SUMMARY,
  isDesignLabPreproductionRequirementComplete,
} from "./design-lab-preproduction-requirements";

export function DesignLabPreproductionChecklist() {
  return (
    <section
      className="giq-panel mt-5 p-4 sm:p-6"
      aria-labelledby="design-lab-preproduction-heading"
      data-design-lab-preproduction-checklist
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
            <FlaskConical className="size-4" aria-hidden="true" />
            Local contract-parity proving environment
          </p>
          <h2
            id="design-lab-preproduction-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
          >
            Database and provider readiness checklist
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
            Design Lab runs production code contracts against isolated systems:
            real public racing ingestion, synthetic private data, and test or
            staging providers. A row ticks only after its exact evidence and tests
            are verified. Production database rows and credentials are never a
            shortcut to parity.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Systems" value={DESIGN_LAB_PREPRODUCTION_SUMMARY.systems.length} />
          <Metric label="MVP gates" value={DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseTotal} />
          <Metric label="MVP verified" value={DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseComplete} />
          <Metric label="MVP blocked" value={DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseBlocked} />
          <Metric label="Post-MVP" value={DESIGN_LAB_PREPRODUCTION_SUMMARY.postMvpTotal} />
          <Metric label="All items" value={DESIGN_LAB_PREPRODUCTION_SUMMARY.total} />
        </dl>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.map((item) => {
          const complete = isDesignLabPreproductionRequirementComplete(item);
          return (
            <article
              key={item.id}
              className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
              data-preproduction-id={item.id}
              data-preproduction-complete={complete ? "true" : "false"}
            >
              <div className="flex items-start gap-3">
                <EvidenceTick complete={complete} label={item.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="break-all text-[10px] font-semibold text-[hsl(var(--primary-light))]">
                      {item.id}
                    </code>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">
                        {item.releaseBlocking ? "MVP launch blocker" : "Post-MVP"}
                      </span>
                      <span className={statusClass(item.status)}>{item.status}</span>
                    </div>
                  </div>
                  <h3 className="mt-2 text-[12px] font-semibold leading-5 text-[hsl(var(--foreground))]">
                    {item.requirement}
                  </h3>
                  <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
                    {item.simulationContract}
                  </p>
                  <p className="mt-2 text-[9px] leading-4 text-amber-100">
                    Open evidence: {item.remainingEvidence}
                  </p>
                  <p className="mt-2 text-[9px] text-[hsl(var(--subtle-foreground))]">
                    {item.owner} · {item.evidence.length} evidence · {item.tests.length} tests
                  </p>
                  {item.operatorCommands.length > 0 ? (
                    <details className="mt-2 rounded-lg border border-white/[0.07] bg-black/10 p-2">
                      <summary className="flex min-h-11 cursor-pointer items-center text-[9px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--secondary-light))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))]">
                        Verification commands
                      </summary>
                      <ul className="mt-2 grid min-w-0 max-w-full gap-1">
                        {item.operatorCommands.map((command) => (
                          <li key={command} className="min-w-0 max-w-full">
                            <code className="break-all text-[9px] text-[hsl(var(--muted-foreground))]">
                              {command}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <aside className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
            <ShieldCheck className="size-4 text-emerald-200" aria-hidden="true" />
            Local data boundary
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="Prisma models" value={DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.totalModels} />
            <Metric label="Production copies" value={DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.productionDatabaseCopyAllowed} />
            <Metric label="Public provider" value={DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.providerPublic} />
            <Metric label="Synthetic only" value={DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.syntheticOnly} />
          </dl>
          <p className="mt-3 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
            Provider-normalized racing rows are allowed for ten public racing
            models. Two raw archive models remain empty or metadata-only. Every
            account and private-domain model is generated locally.
          </p>
        </aside>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                <Database className="size-4 text-[hsl(var(--primary-light))]" aria-hidden="true" />
                Frontend-to-database query contracts
              </h3>
              <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
                Each query remains open until its actual normalized SQL or
                procedure, runtime role, bound parameters, result shape, failure
                path and automated evidence are verified.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.09em] text-[hsl(var(--muted-foreground))]">
              {DESIGN_LAB_DATABASE_CONTRACT_SUMMARY.complete}/{DESIGN_LAB_DATABASE_CONTRACT_SUMMARY.total} verified
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {DATABASE_OPERATIONS.map((operation) => {
              const complete = isDesignLabDatabaseOperationComplete(operation);
              return (
                <details
                  key={operation.queryId}
                  className="rounded-lg border border-white/[0.07] bg-black/10"
                  data-query-contract-id={operation.queryId}
                  data-query-contract-complete={complete ? "true" : "false"}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light))]">
                    <EvidenceTick complete={complete} label={operation.queryId} />
                    <code className="min-w-0 flex-1 break-all text-[9px] font-semibold text-[hsl(var(--primary-light))]">
                      {operation.queryId}
                    </code>
                    <span className="text-[9px] text-[hsl(var(--subtle-foreground))]">
                      {operation.verificationStatus}
                    </span>
                  </summary>
                  <dl className="grid gap-2 border-t border-white/[0.06] px-3 py-3 text-[9px] leading-4 sm:grid-cols-2">
                    <QueryFact label="Trace" value={operation.traceId} />
                    <QueryFact label="Source" value={`${operation.sourceFile}#${operation.sourceSymbol}`} />
                    <QueryFact label="Operation" value={`${operation.ormOrDriver} · ${operation.ormOperation}`} />
                    <QueryFact label="Tables" value={operation.tables.join(", ") || "Procedure-defined"} />
                    <QueryFact label="Bound parameters" value={operation.boundParameters.join(", ") || "None captured"} />
                    <QueryFact label="Runtime role" value={operation.databaseRole} />
                    <QueryFact label="Executable shape" value={operation.normalizedSql || operation.storedProcedure || operation.databaseFunction || "Not captured"} />
                    <QueryFact label="Tests" value={operation.tests.join(", ") || "Missing"} />
                    <QueryFact label="Expected rows" value={operation.expectedRowCount} />
                    <QueryFact label="Failure" value={operation.failureBehaviour} />
                  </dl>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceTick({ complete, label }: { complete: boolean; label: string }) {
  return (
    <span
      role="checkbox"
      aria-checked={complete}
      aria-readonly="true"
      aria-label={`${complete ? "Verified" : "Open"} evidence item ${label}`}
      className={`grid size-7 shrink-0 place-items-center rounded-md border ${complete ? "border-emerald-300/30 bg-emerald-300/[0.12] text-emerald-200" : "border-white/[0.14] bg-white/[0.025] text-transparent"}`}
    >
      {complete ? <Check className="size-4" aria-hidden="true" /> : null}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-center">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function QueryFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[hsl(var(--muted-foreground))]">
        {value}
      </dd>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "verified") {
    return "inline-flex min-h-7 items-center rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] px-2 text-[9px] font-bold uppercase tracking-[0.07em] text-emerald-200";
  }
  if (status === "blocked") {
    return "inline-flex min-h-7 items-center rounded-md border border-rose-300/20 bg-rose-300/[0.06] px-2 text-[9px] font-bold uppercase tracking-[0.07em] text-rose-100";
  }
  return "inline-flex min-h-7 items-center rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 text-[9px] font-bold uppercase tracking-[0.07em] text-amber-100";
}
