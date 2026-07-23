import Link from "next/link";

import type { PedigreeNode } from "@/lib/pedigree";
import {
  analyzePedigree,
  nodeKey,
  type CommonAncestor,
  type PedigreeAnalysis,
} from "@/lib/pedigree-analysis";

interface PedigreeChartProps {
  root: PedigreeNode;
  generations?: number;
}

const GENERATION_LABELS = [
  "Subject",
  "Parents",
  "Grandparents",
  "3rd generation",
  "4th generation",
  "5th generation",
];

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

      <div className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-3 [mask-image:linear-gradient(to_right,transparent,black_10px,black_calc(100%-10px),transparent)]">
        <div className="w-[448px] min-w-[448px] pr-1 lg:w-max lg:min-w-[1008px]">
          <GenerationRail generations={generations} />
          <Branch
            node={root}
            depth={generations - 1}
            generation={0}
            lineage="root"
            highlightKeys={highlightKeys}
          />
        </div>
      </div>

      {analysis.commonAncestors.length > 0 && (
        <LineBreedingDetail ancestors={analysis.commonAncestors} />
      )}
    </section>
  );
}

// Column captions above the tree (desktop only — mobile keeps every pixel for
// the cards). Widths mirror the Branch layout: 180px subject column, then
// 220px ancestor columns separated by the 56px connector gutter.
function GenerationRail({ generations }: { generations: number }) {
  const labels = GENERATION_LABELS.slice(
    0,
    Math.min(generations, GENERATION_LABELS.length - 1) + 1,
  );
  return (
    <div aria-hidden className="mb-3 hidden lg:flex">
      {labels.map((label, i) => (
        <p
          key={label}
          className={[
            "shrink-0 border-b border-[hsl(var(--border-subtle))] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--subtle-foreground))]",
            i === 0 ? "w-[180px]" : "ml-[56px] w-[220px]",
          ].join(" ")}
        >
          {label}
        </p>
      ))}
    </div>
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

type Lineage = "root" | "sire" | "dam";

// Connector tints: each branch stub fades from neutral silver at the parent
// spine into its lineage colour at the card, so the eye can trace a line
// without reading a single label.
const STUB_TINT: Record<Exclude<Lineage, "root">, string> = {
  sire: "before:bg-gradient-to-r before:from-[hsl(var(--metal-silver)/0.28)] before:to-[hsl(var(--secondary)/0.75)]",
  dam: "before:bg-gradient-to-r before:from-[hsl(var(--metal-silver)/0.28)] before:to-[hsl(var(--primary-bright)/0.75)]",
};

function Branch({
  node,
  depth,
  generation,
  lineage,
  highlightKeys,
}: {
  node: PedigreeNode;
  depth: number;
  generation: number;
  lineage: Lineage;
  highlightKeys: ReadonlySet<string>;
}) {
  const hasChildren = depth > 0 && (node.sire || node.dam);

  return (
    <div
      className={`relative flex items-stretch ${
        lineage === "root"
          ? ""
          : `before:absolute before:-left-2 before:top-1/2 before:h-[2px] before:w-2 before:rounded-full before:content-[''] lg:before:-left-7 lg:before:w-7 ${STUB_TINT[lineage]}`
      }`}
    >
      <div
        className={`relative z-10 flex shrink-0 items-center ${
          lineage === "root"
            ? "w-[84px] lg:w-[180px]"
            : "w-[96px] lg:w-[220px]"
        }`}
      >
        <NodeCard
          node={node}
          generation={generation}
          lineage={lineage}
          highlightKeys={highlightKeys}
        />
      </div>

      {hasChildren && (
        <div className="relative ml-2 flex flex-col justify-center gap-2 pl-2 lg:ml-7 lg:pl-7">
          <span
            aria-hidden
            className="absolute -left-2 top-1/2 h-[2px] w-2 rounded-full bg-[hsl(var(--metal-silver)/0.35)] lg:-left-7 lg:w-7"
          />
          <span
            aria-hidden
            className="absolute left-0 top-1/4 bottom-1/4 w-[2px] rounded-full bg-gradient-to-b from-[hsl(var(--secondary)/0.55)] via-[hsl(var(--metal-silver)/0.3)] to-[hsl(var(--primary-bright)/0.55)]"
          />
          <Branch
            node={node.sire ?? UNKNOWN}
            depth={depth - 1}
            generation={generation + 1}
            lineage="sire"
            highlightKeys={highlightKeys}
          />
          <Branch
            node={node.dam ?? UNKNOWN}
            depth={depth - 1}
            generation={generation + 1}
            lineage="dam"
            highlightKeys={highlightKeys}
          />
        </div>
      )}
    </div>
  );
}

const UNKNOWN: PedigreeNode = {
  id: null,
  name: "Unknown",
  sex: null,
  colour: null,
  whelpYear: null,
  careerStarts: null,
  careerWins: null,
  prizeMoney: null,
};

// Compact racing line for a node. Only surfaces real, positive figures — a
// missing or zero value is omitted rather than shown as "0", so the tree never
// implies a dog raced when we have no record of it.
function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function performanceLine(node: PedigreeNode): string | null {
  const parts: string[] = [];
  if (node.careerWins != null && node.careerWins > 0) {
    parts.push(`${node.careerWins} win${node.careerWins === 1 ? "" : "s"}`);
  }
  if (node.prizeMoney != null && node.prizeMoney > 0) {
    parts.push(compactMoney(node.prizeMoney));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function NodeCard({
  node,
  generation,
  lineage,
  highlightKeys,
}: {
  node: PedigreeNode;
  generation: number;
  lineage: Lineage;
  highlightKeys: ReadonlySet<string>;
}) {
  const isUnknown = node.name === "Unknown" && !node.id;
  const key = isUnknown ? null : nodeKey(node);
  const isLineBred = key != null && highlightKeys.has(key);
  const isRoot = lineage === "root";
  const mobileHeight =
    generation === 0
      ? "min-h-[64px]"
      : generation === 1
        ? "min-h-[56px]"
        : generation === 2
          ? "min-h-[52px]"
          : "min-h-[48px]";
  const accent =
    lineage === "sire"
      ? "before:bg-[hsl(var(--secondary))] before:shadow-[0_0_8px_hsl(var(--secondary)/0.55)] hover:border-[hsl(var(--secondary)/0.45)]"
      : "before:bg-[hsl(var(--primary-bright))] before:shadow-[0_0_8px_hsl(var(--primary-bright)/0.55)] hover:border-[hsl(var(--primary-bright)/0.45)]";

  const meta = [node.colour, node.whelpYear ? String(node.whelpYear) : null]
    .filter(Boolean)
    .join(" · ");
  const performance = isUnknown ? null : performanceLine(node);

  const inner = (
    <div
      style={{ animationDelay: `${Math.min(generation, 5) * 70}ms` }}
      className={[
        `relative flex ${mobileHeight} w-full flex-col justify-center rounded-[10px] border px-2 py-1.5 pl-3 lg:min-h-[64px] lg:px-4 lg:py-2 lg:pl-5`,
        "motion-safe:animate-[giq-page-in_0.45s_cubic-bezier(0.16,1,0.3,1)_both]",
        "transition-[transform,border-color,background-color,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5",
        isUnknown
          ? "border-dashed border-[hsl(var(--border-subtle))] bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,hsl(var(--foreground)/0.02)_6px,hsl(var(--foreground)/0.02)_7px)]"
          : isRoot
            ? "border-[hsl(var(--secondary)/0.45)] bg-[linear-gradient(135deg,hsl(var(--secondary)/0.1),hsl(var(--primary)/0.12)_55%,hsl(var(--foreground)/0.03))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08),0_10px_28px_-18px_hsl(var(--primary-bright)/0.6)]"
            : [
                "before:absolute before:bottom-2 before:left-2 before:top-2 before:w-[3px] before:rounded-full before:content-['']",
                "border-[hsl(var(--border))] bg-[linear-gradient(135deg,hsl(var(--foreground)/0.05),hsl(var(--foreground)/0.015)_65%)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)] hover:bg-[hsl(var(--foreground)/0.06)] hover:shadow-[0_8px_20px_-14px_hsl(0_0%_0%/0.8)]",
                accent,
              ].join(" "),
        isLineBred
          ? "ring-1 ring-[hsl(var(--secondary)/0.75)] shadow-[0_0_16px_-6px_hsl(var(--secondary)/0.7)]"
          : "",
      ].join(" ")}
    >
      <p
        className={[
          "truncate font-medium tracking-[-0.01em]",
          isRoot ? "text-[14px] font-semibold" : "text-[13px]",
          isUnknown
            ? "text-[hsl(var(--subtle-foreground))]"
            : "text-[hsl(var(--foreground))]",
        ].join(" ")}
        title={node.name}
      >
        {node.name}
      </p>
      {meta && (
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-[hsl(var(--subtle-foreground))]">
          {meta}
        </p>
      )}
      {performance && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-semibold tabular-nums text-[hsl(var(--secondary-light))]">
          <span aria-hidden className="inline-block h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--secondary))]" />
          {performance}
        </p>
      )}
      {isLineBred && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          <span className="rounded-sm bg-[hsl(var(--secondary)/0.16)] px-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-[hsl(var(--secondary-light))]">
            Line-bred
          </span>
        </div>
      )}
    </div>
  );

  if (node.id && !isUnknown) {
    return (
      <Link
        href={`/dogs/${node.id}`}
        className="block w-full rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
