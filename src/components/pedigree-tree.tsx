"use client";

import { ChevronLeft, GitBranch } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { PedigreeNode } from "@/lib/pedigree";
import { nodeKey } from "@/lib/pedigree-analysis";

interface PedigreeTreeProps {
  root: PedigreeNode;
  /** Ancestor generations available in the data (absolute, from the subject). */
  generations?: number;
  /** nodeKey values for line-bred ancestors, computed server-side. */
  highlightKeys: string[];
  /** Live ancestor search: cards whose name matches glow, the rest dim. */
  highlightQuery?: string;
  /** Concept subtitle for a synthetic root (e.g. "Sire × Dam"). When set, the
   *  root renders as a dashed-gold concept card rather than a dog. */
  rootSubtitle?: string;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lineage: "sire" | "dam";
}

interface Crumb {
  node: PedigreeNode;
  path: string;
}

const DESKTOP_DEPTH = 4;
const MOBILE_DEPTH = 2;

const GENERATION_LABELS = [
  "Subject",
  "Parents",
  "Grandparents",
  "3rd generation",
  "4th generation",
];

/**
 * Interactive bloodline tree. Branches are measured SVG béziers drawn between
 * the real card positions, so the tree reads as connected limbs rather than
 * boxes on a grid. On small screens only the subject plus two generations are
 * shown at full width — tapping an ancestor with deeper recorded lineage
 * re-roots the view into that line, with a breadcrumb trail back. The same
 * focus drill works on desktop above the full five-column spread.
 */
export function PedigreeTree({
  root,
  highlightKeys,
  highlightQuery,
  rootSubtitle,
}: PedigreeTreeProps) {
  const highlights = useMemo(() => new Set(highlightKeys), [highlightKeys]);
  const query = (highlightQuery ?? "").trim().toLowerCase();
  const [trail, setTrail] = useState<Crumb[]>([{ node: root, path: "r" }]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [edges, setEdges] = useState<Edge[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Re-rooting clears stale card refs so measurement never uses removed nodes.
  const focusNode = useCallback((node: PedigreeNode, path: string) => {
    cardRefs.current.clear();
    setTrail((prev) => [...prev, { node, path }]);
  }, []);
  const popTo = useCallback((index: number) => {
    cardRefs.current.clear();
    setTrail((prev) => prev.slice(0, index + 1));
  }, []);

  const focus = trail[trail.length - 1];
  const depth = isDesktop ? DESKTOP_DEPTH : MOBILE_DEPTH;

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const next: Edge[] = [];
    for (const [path, el] of cardRefs.current) {
      if (path === "r") continue;
      const parentPath = path.slice(0, -2);
      const parentEl = cardRefs.current.get(parentPath);
      if (!parentEl) continue;
      const child = el.getBoundingClientRect();
      const parent = parentEl.getBoundingClientRect();
      next.push({
        x1: parent.right - origin.left,
        y1: parent.top + parent.height / 2 - origin.top,
        x2: child.left - origin.left,
        y2: child.top + child.height / 2 - origin.top,
        lineage: path.endsWith("s") ? "sire" : "dam",
      });
    }
    setEdges(next);
  }, []);

  useLayoutEffect(() => {
    measure();
    // Entrance transforms shift bounding boxes; settle the branches once the
    // card animation window has passed.
    const settle = window.setTimeout(measure, 700);
    const container = containerRef.current;
    if (!container) return () => window.clearTimeout(settle);
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => {
      window.clearTimeout(settle);
      observer.disconnect();
    };
  }, [measure, focus.path, depth]);

  return (
    <div>
      {trail.length > 1 && (
        <nav aria-label="Lineage trail" className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => popTo(trail.length - 2)}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--foreground)/0.04)] px-2.5 text-[11px] font-medium text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--primary-bright)/0.5)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          {trail.map((crumb, i) =>
            i === trail.length - 1 ? (
              <span
                key={crumb.path}
                className="inline-flex min-h-8 items-center rounded-full bg-[hsl(var(--primary)/0.18)] px-2.5 text-[11px] font-semibold text-[hsl(var(--primary-bright))]"
                aria-current="true"
              >
                {crumb.node.name}
              </span>
            ) : (
              <button
                key={crumb.path}
                type="button"
                onClick={() => popTo(i)}
                className="inline-flex min-h-8 items-center rounded-full px-2 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
              >
                {crumb.node.name}
                <span aria-hidden className="ml-1.5 text-[hsl(var(--subtle-foreground))]">
                  ›
                </span>
              </button>
            ),
          )}
        </nav>
      )}

      {trail.length === 1 && (
        <div aria-hidden className="mb-3 hidden lg:flex">
          {GENERATION_LABELS.map((label, i) => (
            <p
              key={label}
              className={[
                "shrink-0 border-b border-[hsl(var(--border-subtle))] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--subtle-foreground))]",
                i === 0 ? "w-[190px]" : "ml-[32px] w-[220px]",
              ].join(" ")}
            >
              {label}
            </p>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {edges.map((edge, i) => {
            const midX = (edge.x1 + edge.x2) / 2;
            const d = `M ${edge.x1} ${edge.y1} C ${midX} ${edge.y1}, ${midX} ${edge.y2}, ${edge.x2} ${edge.y2}`;
            const colour =
              edge.lineage === "sire"
                ? "hsl(var(--secondary) / 0.8)"
                : "hsl(var(--primary-bright) / 0.8)";
            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={colour}
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.14}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={colour}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  pathLength={1}
                  className="giq-branch-draw"
                />
              </g>
            );
          })}
        </svg>
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .giq-branch-draw {
              stroke-dasharray: 1;
              stroke-dashoffset: 1;
              animation: giq-branch-grow 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
            }
          }
          @keyframes giq-branch-grow {
            to { stroke-dashoffset: 0; }
          }
        `}</style>

        <TreeBranch
          node={focus.node}
          path={focus.path}
          depth={depth}
          generation={0}
          lineage="root"
          highlights={highlights}
          query={query}
          rootSubtitle={trail.length === 1 ? rootSubtitle : undefined}
          cardRefs={cardRefs}
          onFocus={focusNode}
        />
      </div>
    </div>
  );
}

type Lineage = "root" | "sire" | "dam";

function subtreeDepth(node: PedigreeNode | undefined): number {
  if (!node) return 0;
  return 1 + Math.max(subtreeDepth(node.sire), subtreeDepth(node.dam));
}

function TreeBranch({
  node,
  path,
  depth,
  generation,
  lineage,
  highlights,
  query,
  rootSubtitle,
  cardRefs,
  onFocus,
}: {
  node: PedigreeNode;
  path: string;
  depth: number;
  generation: number;
  lineage: Lineage;
  highlights: ReadonlySet<string>;
  query: string;
  rootSubtitle?: string;
  cardRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onFocus: (node: PedigreeNode, path: string) => void;
}) {
  const hasChildren = depth > 0 && (node.sire || node.dam);

  return (
    <div className="flex min-w-0 items-stretch gap-3 lg:gap-8">
      <div
        className={`flex shrink-0 items-center ${
          lineage === "root" ? "w-[104px] lg:w-[190px]" : "w-[104px] lg:w-[220px]"
        }`}
      >
        <TreeCard
          node={node}
          path={path}
          generation={generation}
          lineage={lineage}
          hiddenDepth={depth === 0 ? Math.max(subtreeDepth(node) - 1, 0) : 0}
          highlights={highlights}
          query={query}
          rootSubtitle={rootSubtitle}
          cardRefs={cardRefs}
          onFocus={onFocus}
        />
      </div>

      {hasChildren && (
        <div className="flex min-w-0 flex-col justify-center gap-2 lg:gap-3">
          <TreeBranch
            node={node.sire ?? UNKNOWN_NODE}
            path={`${path}.s`}
            depth={depth - 1}
            generation={generation + 1}
            lineage="sire"
            highlights={highlights}
            query={query}
            cardRefs={cardRefs}
            onFocus={onFocus}
          />
          <TreeBranch
            node={node.dam ?? UNKNOWN_NODE}
            path={`${path}.d`}
            depth={depth - 1}
            generation={generation + 1}
            lineage="dam"
            highlights={highlights}
            query={query}
            cardRefs={cardRefs}
            onFocus={onFocus}
          />
        </div>
      )}
    </div>
  );
}

const UNKNOWN_NODE: PedigreeNode = {
  id: null,
  name: "Unknown",
  sex: null,
  colour: null,
  whelpYear: null,
  careerStarts: null,
  careerWins: null,
  prizeMoney: null,
};

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

function TreeCard({
  node,
  path,
  generation,
  lineage,
  hiddenDepth,
  highlights,
  query,
  rootSubtitle,
  cardRefs,
  onFocus,
}: {
  node: PedigreeNode;
  path: string;
  generation: number;
  lineage: Lineage;
  /** Generations recorded beneath this node but outside the visible window. */
  hiddenDepth: number;
  highlights: ReadonlySet<string>;
  query: string;
  rootSubtitle?: string;
  cardRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onFocus: (node: PedigreeNode, path: string) => void;
}) {
  const isUnknown = node.name === "Unknown" && !node.id;
  const key = isUnknown ? null : nodeKey(node);
  const isLineBred = key != null && highlights.has(key);
  const isRoot = lineage === "root";
  const isConceptRoot = isRoot && rootSubtitle != null;
  const isSearchMatch =
    query.length > 0 &&
    !isUnknown &&
    !isConceptRoot &&
    node.name.toLowerCase().includes(query);
  const isDimmed = query.length > 0 && !isSearchMatch && !isConceptRoot;
  const canDrill = hiddenDepth > 0 && !isUnknown;

  const accent =
    lineage === "sire"
      ? "before:bg-[hsl(var(--secondary))] before:shadow-[0_0_8px_hsl(var(--secondary)/0.55)]"
      : "before:bg-[hsl(var(--primary-bright))] before:shadow-[0_0_8px_hsl(var(--primary-bright)/0.55)]";
  const meta = [node.colour, node.whelpYear ? String(node.whelpYear) : null]
    .filter(Boolean)
    .join(" · ");
  const performance = isUnknown ? null : performanceLine(node);

  const setRef = (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(path, el);
    else cardRefs.current.delete(path);
  };

  const body = (
    <>
      <span
        className={[
          "block truncate font-medium tracking-[-0.01em]",
          isRoot ? "text-[14px] font-semibold" : "text-[12px] lg:text-[13px]",
          isUnknown
            ? "text-[hsl(var(--subtle-foreground))]"
            : isConceptRoot
              ? "text-[hsl(var(--secondary-light))]"
              : "text-[hsl(var(--foreground))]",
        ].join(" ")}
        title={node.name}
      >
        {node.name}
      </span>
      {isConceptRoot && (
        <span className="mt-0.5 block truncate text-[11px] tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
          {rootSubtitle}
        </span>
      )}
      {meta && (
        <span className="mt-0.5 block truncate text-[10px] tabular-nums text-[hsl(var(--subtle-foreground))] lg:text-[11px]">
          {meta}
        </span>
      )}
      {performance && (
        <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-semibold tabular-nums text-[hsl(var(--secondary-light))]">
          <span aria-hidden className="inline-block h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--secondary))]" />
          {performance}
        </span>
      )}
      <span className="mt-0.5 flex flex-wrap items-center gap-1">
        {isLineBred && (
          <span className="rounded-sm bg-[hsl(var(--secondary)/0.16)] px-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-[hsl(var(--secondary-light))]">
            Line-bred
          </span>
        )}
        {canDrill && (
          <button
            type="button"
            aria-label={`Explore ${node.name}'s lineage, ${hiddenDepth} more generation${hiddenDepth === 1 ? "" : "s"} recorded`}
            onClick={() => onFocus(node, path)}
            className="relative z-[2] inline-flex min-h-6 cursor-pointer items-center gap-0.5 rounded-sm bg-[hsl(var(--primary)/0.16)] px-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[hsl(var(--primary-bright))] transition-colors hover:bg-[hsl(var(--primary)/0.3)] focus-visible:outline-2 focus-visible:outline-[hsl(var(--primary-bright))]"
          >
            <GitBranch className="h-2.5 w-2.5" /> +{hiddenDepth} gen{hiddenDepth === 1 ? "" : "s"}
          </button>
        )}
      </span>
    </>
  );

  const surface = [
    "relative flex w-full min-h-[64px] flex-col justify-center rounded-[10px] border px-2.5 py-1.5 text-left lg:px-4 lg:py-2",
    "motion-safe:animate-[giq-page-in_0.45s_cubic-bezier(0.16,1,0.3,1)_both]",
    "transition-[transform,border-color,background-color,box-shadow,opacity] duration-200",
    isUnknown
      ? "border-dashed border-[hsl(var(--border-subtle))] bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,hsl(var(--foreground)/0.02)_6px,hsl(var(--foreground)/0.02)_7px)]"
      : isConceptRoot
        ? "border-dashed border-[hsl(var(--secondary)/0.6)] bg-[linear-gradient(135deg,hsl(var(--secondary)/0.12),hsl(var(--secondary)/0.03))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_10px_28px_-18px_hsl(var(--secondary)/0.55)] pl-3 lg:pl-5"
        : isRoot
          ? "border-[hsl(var(--secondary)/0.45)] bg-[linear-gradient(135deg,hsl(var(--secondary)/0.1),hsl(var(--primary)/0.12)_55%,hsl(var(--foreground)/0.03))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08),0_10px_28px_-18px_hsl(var(--primary-bright)/0.6)] pl-3 lg:pl-5"
          : [
              "before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-[3px] before:rounded-full before:content-[''] pl-3.5 lg:pl-5",
              "border-[hsl(var(--border))] bg-[linear-gradient(135deg,hsl(var(--foreground)/0.05),hsl(var(--foreground)/0.015)_65%)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)]",
              accent,
            ].join(" "),
    isSearchMatch
      ? "ring-2 ring-[hsl(var(--primary-bright))] shadow-[0_0_18px_-4px_hsl(var(--primary-bright)/0.85)]"
      : isLineBred
        ? "ring-1 ring-[hsl(var(--secondary)/0.75)] shadow-[0_0_16px_-6px_hsl(var(--secondary)/0.7)]"
        : "",
    isDimmed ? "opacity-40" : "",
    node.id && !isUnknown
      ? "motion-safe:hover:-translate-y-0.5 hover:border-[hsl(var(--primary-bright)/0.5)] hover:bg-[hsl(var(--foreground)/0.06)]"
      : "",
  ].join(" ");

  // The whole card opens the dog's stats page via a stretched overlay link
  // (keeps the drill chip a REAL button rather than nesting controls), so a
  // raced ancestor is always one tap from its record.
  if (node.id && !isUnknown) {
    return (
      <div
        ref={setRef}
        style={{ animationDelay: `${Math.min(generation, 5) * 70}ms` }}
        className={surface}
      >
        {body}
        <Link
          href={`/dogs/${node.id}`}
          aria-label={`Open ${node.name}'s stats page`}
          className="absolute inset-0 z-[1] rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]"
        />
      </div>
    );
  }

  return (
    <div
      ref={setRef}
      style={{ animationDelay: `${Math.min(generation, 5) * 70}ms` }}
      className={surface}
    >
      {body}
    </div>
  );
}
