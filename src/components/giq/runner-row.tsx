import Link from "next/link";
import { Trophy } from "lucide-react";

import { BoxNumber } from "./box-number";
import { cn } from "./utils";

export type GiqRunner = {
  id: string;
  boxNumber: number;
  name: string;
  dogHref?: string;
  sex?: "M" | "F" | string | null;
  trainer?: string | null;
  weight?: number | null;
  form?: string | null;
  scratched?: boolean;
  result?: {
    finishingPosition?: number | null;
    runningTime?: number | null;
  } | null;
};

export function RunnerRow({
  runner,
  showResults = Boolean(runner.result),
  className,
}: {
  runner: GiqRunner;
  showResults?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]",
        runner.scratched && "opacity-30 line-through",
        className
      )}
    >
      <td className="p-3 text-center">
        <BoxNumber box={runner.boxNumber} />
      </td>
      <td className="p-3">
        {runner.dogHref ? (
          <Link
            href={runner.dogHref}
            className="text-[14px] font-medium tracking-[-0.013em] text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-bright))]"
          >
            {runner.name}
          </Link>
        ) : (
          <span className="text-[14px] font-medium tracking-[-0.013em] text-[hsl(var(--foreground))]">
            {runner.name}
          </span>
        )}
        {runner.sex ? (
          <span className="ml-2 text-[11px] text-[hsl(var(--subtle-foreground))]">
            {runner.sex === "M" ? "D" : "B"}
          </span>
        ) : null}
      </td>
      <td className="p-3 text-[13px] tracking-[-0.013em] text-[hsl(var(--muted-foreground))]">
        {runner.trainer ?? "-"}
      </td>
      <td className="p-3 text-center text-[13px] tracking-[-0.013em] text-[hsl(var(--muted-foreground))]">
        {runner.weight ? `${runner.weight}kg` : "-"}
      </td>
      <td className="p-3">
        <code className="font-mono text-[13px] tracking-wider text-[hsl(var(--primary-bright))]">
          {runner.form ?? "-"}
        </code>
      </td>
      {showResults ? (
        <td className="p-3 text-center">
          {runner.result ? (
            <div className="flex flex-col items-center gap-1">
              <ResultBadge position={runner.result.finishingPosition ?? null} />
              {runner.result.runningTime ? (
                <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                  {runner.result.runningTime.toFixed(2)}s
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-[13px] text-[hsl(var(--subtle-foreground))]">-</span>
          )}
        </td>
      ) : null}
    </tr>
  );
}

function ResultBadge({ position }: { position: number | null }) {
  if (position === 1) {
    return (
      <span className="giq-result-badge giq-result-badge-gold">
        <Trophy className="h-3 w-3" aria-hidden="true" />
        1st
      </span>
    );
  }
  if (position === 2) {
    return <span className="giq-result-badge giq-result-badge-purple">2nd</span>;
  }
  if (position === 3) {
    return <span className="giq-result-badge giq-result-badge-chrome">3rd</span>;
  }
  if (position) {
    return (
      <span className="text-[13px] text-[hsl(var(--subtle-foreground))]">
        {position}th
      </span>
    );
  }
  return <span className="text-[13px] text-[hsl(var(--subtle-foreground))]">-</span>;
}
