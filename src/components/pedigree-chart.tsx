import Link from "next/link";

import type { PedigreeNode } from "@/lib/pedigree";

interface PedigreeChartProps {
  root: PedigreeNode;
  generations?: number;
}

/**
 * Horizontal pedigree chart. The subject stays compact at the left while each
 * fixed-width ancestor generation branches rightward inside a contained scroller.
 */
export function PedigreeChart({ root, generations = 4 }: PedigreeChartProps) {
  return (
    <section
      className="giq-panel mb-6 min-w-0 max-w-full p-4 sm:p-6"
      aria-label={`Pedigree of ${root.name}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="giq-pedigree-heading text-[13px] font-semibold tracking-[0.04em] text-[hsl(var(--foreground))]">
          Pedigree
        </h3>
        <div className="flex shrink-0 items-center gap-3 text-[11px] tracking-[-0.01em] text-[hsl(var(--subtle-foreground))]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))]" /> Sire line
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary-bright))]" /> Dam line
          </span>
        </div>
      </div>

      <div className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-3">
        <div className="w-[448px] min-w-[448px] pr-1 lg:w-max lg:min-w-[1008px]">
          <Branch node={root} depth={generations - 1} generation={0} lineage="root" />
        </div>
      </div>
    </section>
  );
}

type Lineage = "root" | "sire" | "dam";

function Branch({
  node,
  depth,
  generation,
  lineage,
}: {
  node: PedigreeNode;
  depth: number;
  generation: number;
  lineage: Lineage;
}) {
  const hasChildren = depth > 0 && (node.sire || node.dam);

  return (
    <div
      className={`relative flex items-stretch ${
        lineage === "root"
          ? ""
          : "before:absolute before:-left-2 before:top-1/2 before:h-[2px] before:w-2 before:bg-[hsl(var(--metal-silver)/0.42)] before:content-[''] lg:before:-left-7 lg:before:w-7"
      }`}
    >
      <div
        className={`relative z-10 flex shrink-0 items-center ${
          lineage === "root"
            ? "w-[84px] lg:w-[180px]"
            : "w-[96px] lg:w-[220px]"
        }`}
      >
        <NodeCard node={node} generation={generation} lineage={lineage} />
      </div>

      {hasChildren && (
        <div className="relative ml-2 flex flex-col justify-center gap-2 pl-2 lg:ml-7 lg:pl-7">
          <span
            aria-hidden
            className="absolute -left-2 top-1/2 h-[2px] w-2 bg-[hsl(var(--metal-silver)/0.42)] lg:-left-7 lg:w-7"
          />
          <span
            aria-hidden
            className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-[hsl(var(--metal-silver)/0.42)]"
          />
          <Branch
            node={node.sire ?? UNKNOWN}
            depth={depth - 1}
            generation={generation + 1}
            lineage="sire"
          />
          <Branch
            node={node.dam ?? UNKNOWN}
            depth={depth - 1}
            generation={generation + 1}
            lineage="dam"
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
};

function NodeCard({
  node,
  generation,
  lineage,
}: {
  node: PedigreeNode;
  generation: number;
  lineage: Lineage;
}) {
  const isUnknown = node.name === "Unknown" && !node.id;
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
      ? "before:bg-[hsl(var(--secondary))]"
      : "before:bg-[hsl(var(--primary-bright))]";

  const meta = [node.colour, node.whelpYear ? String(node.whelpYear) : null]
    .filter(Boolean)
    .join(" · ");

  const inner = (
    <div
      className={[
        `relative flex ${mobileHeight} w-full flex-col justify-center rounded-[8px] border px-2 py-1.5 pl-3 transition-colors lg:min-h-[64px] lg:px-4 lg:py-2 lg:pl-5`,
        "before:absolute before:bottom-2 before:left-2 before:top-2 before:w-[3px] before:rounded-full before:content-['']",
        isUnknown
          ? "border-dashed border-[hsl(var(--border-subtle))] before:bg-[hsl(var(--border))]"
          : `border-[hsl(var(--border))] bg-[hsl(var(--foreground)/0.025)] hover:bg-[hsl(var(--foreground)/0.05)] ${accent}`,
      ].join(" ")}
    >
      <p
        className={[
          "truncate text-[13px] font-medium tracking-[-0.01em]",
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
    </div>
  );

  if (node.id && !isUnknown) {
    return (
      <Link
        href={`/dogs/${node.id}`}
        className="block w-full rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
