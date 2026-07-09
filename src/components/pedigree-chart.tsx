import Link from "next/link";

import type { PedigreeNode } from "@/lib/pedigree";

interface PedigreeChartProps {
  root: PedigreeNode;
  generations?: number;
}

/**
 * Professional horizontal pedigree chart. The subject sits at the left; each ancestor
 * branches rightward, sire (purple) above dam (gold), with connector lines. Renders a
 * balanced bracket to `generations` deep, filling absent ancestors with muted placeholders
 * so the lineage stays readable. Pure server component — links only, no client JS.
 */
export function PedigreeChart({ root, generations = 5 }: PedigreeChartProps) {
  return (
    <section className="giq-panel mb-6 p-6" aria-label={`Pedigree of ${root.name}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
          Pedigree
        </h3>
        <div className="flex items-center gap-3 text-[11px] tracking-[-0.01em] text-[hsl(var(--subtle-foreground))]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary-bright))]" /> Sire line
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))]" /> Dam line
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px]">
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
    <div className="flex items-stretch">
      <div className="flex min-w-[150px] flex-1 items-center">
        <NodeCard node={node} lineage={lineage} />
      </div>

      {hasChildren && (
        <div className="relative flex flex-1 flex-col justify-center gap-2 pl-5">
          {/* vertical spine linking the two ancestor branches */}
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
    lineage === "dam"
      ? "before:bg-[hsl(var(--secondary))]"
      : "before:bg-[hsl(var(--primary-bright))]";

  const meta = [node.colour, node.whelpYear ? String(node.whelpYear) : null]
    .filter(Boolean)
    .join(" · ");

  const inner = (
    <div
      className={[
        "relative w-full rounded-[10px] border px-3 py-2 pl-4 transition-colors",
        "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:content-['']",
        isUnknown
          ? "border-dashed border-[hsl(var(--border-subtle))] before:bg-[hsl(var(--border))]"
          : `border-[hsl(var(--border))] bg-[hsl(var(--foreground)/0.02)] hover:bg-[hsl(var(--foreground)/0.05)] ${accent}`,
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
      <Link href={`/dogs/${node.id}`} className="block w-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
