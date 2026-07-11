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
        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
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
        <div className="w-max min-w-[720px] pr-1 sm:min-w-[1008px]">
          <Branch node={root} depth={generations - 1} lineage="root" />
        </div>
      </div>
    </section>
  );
}

type Lineage = "root" | "sire" | "dam";

function Branch({
  node,
  depth,
  lineage,
}: {
  node: PedigreeNode;
  depth: number;
  lineage: Lineage;
}) {
  const hasChildren = depth > 0 && (node.sire || node.dam);

  return (
    <div
      className={`relative flex items-stretch ${
        lineage === "root"
          ? ""
          : "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-[hsl(var(--border))] before:content-[''] sm:before:-left-7 sm:before:w-7"
      }`}
    >
      <div
        className={`relative z-10 flex shrink-0 items-center ${
          lineage === "root"
            ? "w-[120px] sm:w-[180px]"
            : "w-[150px] sm:w-[220px]"
        }`}
      >
        <NodeCard node={node} lineage={lineage} />
      </div>

      {hasChildren && (
        <div className="relative ml-3 flex flex-col justify-center gap-2 pl-3 sm:ml-7 sm:pl-7">
          <span
            aria-hidden
            className="absolute -left-3 top-1/2 h-px w-3 bg-[hsl(var(--border))] sm:-left-7 sm:w-7"
          />
          <span
            aria-hidden
            className="absolute left-0 top-1/4 bottom-1/4 w-px bg-[hsl(var(--border))]"
          />
          <Branch
            node={node.sire ?? UNKNOWN}
            depth={depth - 1}
            lineage="sire"
          />
          <Branch
            node={node.dam ?? UNKNOWN}
            depth={depth - 1}
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

function NodeCard({ node, lineage }: { node: PedigreeNode; lineage: Lineage }) {
  const isUnknown = node.name === "Unknown" && !node.id;
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
        "relative flex min-h-[56px] w-full flex-col justify-center rounded-[8px] border px-3 py-2 pl-4 transition-colors sm:min-h-[64px] sm:px-4 sm:pl-5",
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
