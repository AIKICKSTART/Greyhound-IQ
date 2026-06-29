const BOX_COLOURS: Record<number, string> = {
  1: "bg-[#EF4444] text-white",
  2: "bg-[#3B82F6] text-white",
  3: "bg-white text-gray-900 border border-white/20",
  4: "bg-[#1B7A3D] text-white",
  5: "bg-[#FCD34D] text-gray-900",
  6: "bg-[#8B5CF6] text-white",
  7: "bg-[#111827] text-white border border-white/10",
  8: "bg-[#EC4899] text-white",
};

type RunnerData = {
  id: string;
  boxNumber: number;
  weight: number | null;
  scratched: boolean;
  dog: {
    id: string;
    name: string;
    colour: string | null;
    sex: string | null;
    trainer: { name: string } | null;
    formEntries: {
      finish: number | null;
      date: Date;
      trackId: string | null;
    }[];
  };
  startingPrice: number | null;
  result: {
    finishingPosition: number | null;
    runningTime: number | null;
    margin: number | null;
  } | null;
};

export function RunnerRow({ runner }: { runner: RunnerData }) {
  const dog = runner.dog;
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
          className={`inline-flex h-7 w-7 items-center justify-center rounded text-[12px] font-bold ${
            BOX_COLOURS[runner.boxNumber] ?? "bg-gray-600 text-white"
          }`}
        >
          {runner.boxNumber}
        </span>
      </td>
      <td className="p-3">
        <a
          href={`/dogs/${dog.id}`}
          className="text-[14px] font-medium text-[hsl(210_13%_97%)] hover:text-[hsl(142_60%_48%)] transition-colors font-medium tracking-[-0.013em]"
        >
          {dog.name}
        </a>
        {dog.sex && (
          <span className="ml-2 text-[11px] text-[hsl(220_7%_42%)]">
            {dog.sex === "M" ? "D" : "B"}
          </span>
        )}
      </td>
      <td
        className="p-3 text-[13px] text-[hsl(215_14%_65%)] tracking-[-0.013em]"
      >
        {dog.trainer?.name ?? "—"}
      </td>
      <td
        className="p-3 text-[13px] text-center text-[hsl(215_14%_65%)] tracking-[-0.013em]"
      >
        {runner.weight ? `${runner.weight}kg` : "—"}
      </td>
      <td className="p-3">
        <code
          className="text-[13px] font-mono text-[hsl(142_60%_48%)] tracking-wider"
        >
          {form || "—"}
        </code>
      </td>
      {runner.result && (
        <td className="p-3 text-center">
          {runner.result.finishingPosition === 1 && (
            <span className="rounded-md bg-[#FCD34D] px-2 py-0.5 text-[11px] font-bold text-gray-900">
              1st
            </span>
          )}
          {runner.result.finishingPosition === 2 && (
            <span className="rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-[hsl(210_13%_97%)]">
              2nd
            </span>
          )}
          {runner.result.finishingPosition === 3 && (
            <span className="rounded-md border border-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-[hsl(215_14%_65%)]">
              3rd
            </span>
          )}
          {runner.result.finishingPosition &&
            runner.result.finishingPosition > 3 && (
              <span className="text-[13px] text-[hsl(220_7%_42%)]">
                {runner.result.finishingPosition}th
              </span>
            )}
        </td>
      )}
    </tr>
  );
}
