import Link from "next/link";

import { PedigreeTree } from "@/components/pedigree-tree";
import type { PedigreeNode } from "@/lib/pedigree";
import {
  analyzePedigree,
  type CommonAncestor,
  type PedigreeAnalysis,
} from "@/lib/pedigree-analysis";

interface PedigreeChartProps {
  root: PedigreeNode;
  generations?: number;
}

/**
 * Horizontal pedigree chart. The subject stays compact at the left while each
 * fixed-width ancestor generation branches rightward inside a contained scroller.
 * Duplicated ancestors (line-breeding) are highlighted, and an in-memory
 * analysis panel reports completeness, line-breeding, and the top ancestor.
 */
export function PedigreeChart({ root, generations = 5 }: PedigreeChartProps) {
  const analysis = analyzePedigree(root, generations);
  const highlightKeys = new Set(analysis.commonAncestors.map((a) => a.key));

  return (
    <section
      className="giq-panel mb-6 min-w-0 max-w-full p-4 sm:p-6"
      aria-label={`Pedigree of ${root.name}`}
    >
      <PedigreeSummaryBar analysis={analysis} />

      <div className="mb-4 mt-6 flex items-center justify-between gap-3">
        <h3 className="giq-pedigree-heading text-[13px] font-semibold tracking-[0.04em] text-[hsl(var(--foreground))]">
          Five-generation tree
        </h3>
        <div className="flex shrink-0 items-center gap-3 text-[11px] tracking-[-0.01em] text-[hsl(var(--subtle-foreground))]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))] shadow-[0_0_6px_hsl(var(--secondary)/0.8)]" />{" "}
            Sire line
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary-bright))] shadow-[0_0_6px_hsl(var(--primary-bright)/0.8)]" />{" "}
            Dam line
          </span>
        </div>
      </div>

      <div className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-3">
        <div className="w-max min-w-full pr-1">
          <PedigreeTree
            root={root}
            generations={generations}
            highlightKeys={[...highlightKeys]}
          />
        </div>
      </div>

      {analysis.commonAncestors.length > 0 && (
        <LineBreedingDetail ancestors={analysis.commonAncestors} />
      )}
    </section>
  );
}

function compactMoneyFull(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

// Leads the pedigree with its three headline reads, above the tree: generational
// completeness, the line-breeding / outcross verdict, and the top-earning
// ancestor. Every figure is read straight off the loaded ancestry — no queries,
// no prediction, and absence is stated plainly.
function PedigreeSummaryBar({ analysis }: { analysis: PedigreeAnalysis }) {
  const { completeness, commonAncestors, topEarner } = analysis;
  const strongest = commonAncestors[0] ?? null;
  const pedigreeComplete = completeness.pct === 100;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="giq-subpanel p-4">
        <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">Completeness</p>
        <p className="text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[hsl(var(--foreground))]">
          {completeness.pct}%
        </p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--foreground)/0.08)]"
          role="presentation"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--secondary))] via-[hsl(var(--secondary-light))] to-[hsl(var(--primary-bright))] shadow-[0_0_8px_hsl(var(--primary-bright)/0.5)]"
            style={{ width: `${Math.max(completeness.pct, 2)}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
          {completeness.filled} of {completeness.total} slots · {completeness.generations} gens
        </p>
      </div>

      <div className="giq-subpanel p-4">
        <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">Line-breeding</p>
        {strongest ? (
          <>
            <p className="flex items-center gap-2 text-[15px] font-semibold leading-tight tracking-[-0.015em] text-[hsl(var(--primary-bright))]">
              <span className="inline-flex h-2 w-2 rounded-full bg-[hsl(var(--primary-bright))] shadow-[0_0_8px_hsl(var(--primary-bright)/0.8)]" />
              {commonAncestors.length} shared{" "}
              {commonAncestors.length === 1 ? "ancestor" : "ancestors"}
            </p>
            <p className="mt-2 truncate text-[11px] text-[hsl(var(--muted-foreground))]">
              Closest: {strongest.name}{" "}
              <span className="tabular-nums">· {strongest.occurrences}×</span>
            </p>
          </>
        ) : pedigreeComplete ? (
          <>
            <p className="text-[15px] font-semibold leading-tight tracking-[-0.015em] text-[hsl(var(--foreground))]">
              Outcross
            </p>
            <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              No ancestor shared across the sire and dam sides.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-semibold leading-tight tracking-[-0.015em] text-[hsl(var(--foreground))]">
              Incomplete pedigree
            </p>
            <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              Missing ancestor slots prevent an outcross conclusion.
            </p>
          </>
        )}
      </div>

      <div className="giq-subpanel p-4">
        <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">Top earner in tree</p>
        {topEarner ? (
          <>
            {topEarner.id ? (
              <Link
                href={`/dogs/${topEarner.id}`}
                className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.015em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
              >
                {topEarner.name}
              </Link>
            ) : (
              <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em] text-[hsl(var(--foreground))]">
                {topEarner.name}
              </p>
            )}
            <p className="mt-2 text-[11px] font-semibold tabular-nums text-[hsl(var(--secondary-light))]">
              {compactMoneyFull(topEarner.prizeMoney)}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">Not recorded</p>
        )}
      </div>
    </div>
  );
}

// Full line-breeding breakdown, shown below the tree only when shared ancestors
// exist. The summary bar carries the headline; this lists every repeated line.
function LineBreedingDetail({ ancestors }: { ancestors: CommonAncestor[] }) {
  return (
    <div className="mt-5 border-t border-[hsl(var(--border-subtle))] pt-5">
      <p className="giq-eyebrow mb-3 text-[hsl(var(--subtle-foreground))]">
        Line-breeding detail — ancestors on both sides
      </p>
      <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {ancestors.slice(0, 6).map((ancestor) => (
          <LineBredRow key={ancestor.key} ancestor={ancestor} />
        ))}
      </ul>
    </div>
  );
}

function LineBredRow({ ancestor }: { ancestor: CommonAncestor }) {
  return (
    <li className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="min-w-0 truncate tracking-[-0.01em] text-[hsl(var(--foreground))]">
        Line-bred to {ancestor.name}
        {ancestor.whelpYear ? (
          <span className="tabular-nums text-[hsl(var(--subtle-foreground))]"> ({ancestor.whelpYear})</span>
        ) : null}
        {ancestor.confidence === "name" && (
          <span className="ml-1 text-[10px] uppercase tracking-[0.04em] text-[hsl(var(--subtle-foreground))]">
            name-matched
          </span>
        )}
      </span>
      <span className="shrink-0 tabular-nums text-[hsl(var(--muted-foreground))]">
        appears {ancestor.occurrences}×
      </span>
    </li>
  );
}
