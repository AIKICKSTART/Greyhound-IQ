"use client";

import { ExternalLink, FileWarning, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  buildDesignLabContractInspectorSections,
  buildDesignLabInspectorRouteUrl,
  resolveDesignLabInspectorContract,
} from "./design-lab-contract-inspector-model";

export function DesignLabContractInspector({
  initialRoute,
}: {
  initialRoute?: string;
}) {
  const [selectedRoute, setSelectedRoute] = useState(
    () => resolveDesignLabInspectorContract(initialRoute).route,
  );
  const contract = resolveDesignLabInspectorContract(selectedRoute);
  const sections = useMemo(
    () => buildDesignLabContractInspectorSections(contract),
    [contract],
  );

  useEffect(() => {
    function restoreRouteFromUrl() {
      setSelectedRoute(
        resolveDesignLabInspectorContract(
          new URL(window.location.href).searchParams.get("route"),
        ).route,
      );
    }

    window.addEventListener("popstate", restoreRouteFromUrl);
    return () => window.removeEventListener("popstate", restoreRouteFromUrl);
  }, []);

  function selectRoute(route: string) {
    const nextRoute = resolveDesignLabInspectorContract(route).route;
    setSelectedRoute(nextRoute);
    window.history.pushState(
      null,
      "",
      buildDesignLabInspectorRouteUrl(window.location.href, nextRoute),
    );
  }

  return (
    <section
      className="giq-panel mt-5 overflow-hidden p-4 sm:p-6"
      aria-labelledby="screen-contract-inspector-heading"
      data-design-lab-contract-inspector
      data-selected-contract={contract.route}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
            <ScanSearch className="size-4" aria-hidden="true" />
            Canonical contract inspector
          </p>
          <h2
            id="screen-contract-inspector-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
          >
            Inspect every registered contract dimension
          </h2>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            Recorded values and unresolved gaps are shown separately. A visible
            gap is not counted as implementation evidence for the underlying
            screen behavior.
          </p>
        </div>
        <a
          href={contract.concreteRoute}
          className="giq-outline-action min-h-11 px-4 text-sm font-semibold"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open actual screen
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
          Registered route
        </span>
        <select
          aria-label="Contract inspector route"
          className="giq-form-control min-h-11 w-full px-3 font-mono text-sm"
          value={contract.route}
          onChange={(event) => selectRoute(event.target.value)}
        >
          {SCREEN_CONTRACTS.map((candidate) => (
            <option key={candidate.route} value={candidate.route}>
              {candidate.route} · {candidate.productArea}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <article
            key={section.id}
            className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5"
            data-inspector-requirement={section.id}
            data-inspector-state={section.state}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-white">
                {section.label}
              </h3>
              <span
                className={
                  section.state === "gap"
                    ? "rounded-full bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.09em] text-amber-100"
                    : "rounded-full bg-emerald-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.09em] text-emerald-200"
                }
              >
                {section.state}
              </span>
            </div>
            <ul className="mt-3 grid gap-1.5">
              {section.values.map((value) => (
                <li
                  key={value}
                  className="flex min-w-0 gap-2 break-words text-[10px] leading-5 text-[hsl(var(--muted-foreground))]"
                >
                  {section.state === "gap" ? (
                    <FileWarning
                      className="mt-1 size-3 shrink-0 text-amber-200"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-300"
                      aria-hidden="true"
                    />
                  )}
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
