import { getBoxColourStyle } from "@/lib/box-colours";
import { Trophy } from "lucide-react";

type RunnerData = {
  id: string;
  boxNumber: number;
  weight: number | null;
  previousOfficialWeight: number | null;
  previousWeightDate: Date | null;
  weightStatus: "published" | "pending" | "not_published";
  scratched: boolean;
  dog: {
    id: string;
    name: string;
    colour: string | null;
    sex: string | null;
    trainer: { id?: string; name: string } | null;
    formEntries: {
      finish: number | null;
      date: Date;
      trackId: string | null;
    }[];
  };
  trainer: { id?: string; name: string } | null;
  result: {
    finishingPosition: number | null;
    runningTime: number | null;
    margin: number | null;
    prizeMoneyWon: number | null;
    splitTime: number | null;
  } | null;
};

export function RunnerRow({
  runner,
  showResults = Boolean(runner.result),
}: {
  runner: RunnerData;
  showResults?: boolean;
}) {
  const dog = runner.dog;
  const boxStyle = getBoxColourStyle(runner.boxNumber);
  const trainer = runner.trainer ?? dog.trainer;
  const trainerName = trainer?.name ?? "Not supplied";
  const form = dog.formEntries
    .map((e) => (e.finish === null ? "-" : e.finish === 0 ? "✕" : e.finish))
    .join("");

  return (
    <tr
      className={`border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.02] ${
        runner.scratched ? "opacity-30 line-through" : ""
      }`}
    >
      <td className="p-3 text-center">
        <span
          className="giq-box-plate"
          style={boxStyle}
        >
          {runner.boxNumber}
        </span>
      </td>
      <td className="p-3">
        <a
          href={`/dogs/${dog.id}`}
          className="text-[14px] font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))] transition-colors font-medium tracking-[-0.013em]"
        >
          {dog.name}
        </a>
        {dog.sex && (
          <span className="ml-2 text-[11px] text-[hsl(var(--subtle-foreground))]">
            {dog.sex === "M" ? "D" : "B"}
          </span>
        )}
      </td>
      <td
        className="p-3 text-[13px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]"
      >
        {trainer?.id ? (
          <a
            href={`/trainers/${trainer.id}`}
            className="hover:text-[hsl(var(--primary-bright))]"
          >
            {trainerName}
          </a>
        ) : (
          trainerName
        )}
      </td>
      <td
        className="p-3 text-center tracking-[-0.013em]"
      >
        <span className="block text-[12px] font-medium text-[hsl(var(--foreground))]">
          {runner.weight
            ? `Official ${runner.weight}kg`
            : runner.weightStatus === "pending"
              ? "Pending official update"
              : "Official weight not published"}
        </span>
        {runner.previousOfficialWeight && runner.previousWeightDate ? (
          <span className="mt-0.5 block text-[10px] text-[hsl(var(--muted-foreground))]">
            Previous {runner.previousOfficialWeight}kg ·{" "}
            {formatWeightDate(runner.previousWeightDate)}
          </span>
        ) : null}
      </td>
      <td className="p-3">
        <code
          className="text-[13px] font-mono text-[hsl(var(--primary-bright))] tracking-wider"
        >
          {form || "—"}
        </code>
      </td>
      {showResults && (
        <td className="p-3 text-center">
          {runner.result ? (
            <div className="flex flex-col items-center gap-1">
              <ResultBadge position={runner.result.finishingPosition} />
              {runner.result.runningTime && (
                <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                  {runner.result.runningTime.toFixed(2)}s
                </span>
              )}
              {runner.result.prizeMoneyWon !== null && (
                <span className="font-mono text-[11px] font-semibold text-[hsl(var(--secondary-light))]">
                  {formatPrizeMoney(runner.result.prizeMoneyWon)} won
                </span>
              )}
            </div>
          ) : (
            <span className="text-[13px] text-[hsl(var(--subtle-foreground))]">—</span>
          )}
        </td>
      )}
    </tr>
  );
}

function formatWeightDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Sydney",
  }).format(value);
}

function formatPrizeMoney(value: number) {
  return `$${value.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
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
    return (
      <span className="giq-result-badge giq-result-badge-silver">
        <Trophy className="h-3 w-3" aria-hidden="true" />
        2nd
      </span>
    );
  }
  if (position === 3) {
    return (
      <span className="giq-result-badge giq-result-badge-bronze">
        <Trophy className="h-3 w-3" aria-hidden="true" />
        3rd
      </span>
    );
  }
  if (position) {
    return (
      <span className="text-[13px] text-[hsl(var(--subtle-foreground))]">
        {position}th
      </span>
    );
  }
  return <span className="text-[13px] text-[hsl(var(--subtle-foreground))]">—</span>;
}
