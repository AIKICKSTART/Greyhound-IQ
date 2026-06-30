import { getBoxColourStyle } from "@/lib/box-colours";

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
  const boxStyle = getBoxColourStyle(runner.boxNumber);
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
          className="inline-flex h-9 w-11 items-center justify-center rounded-[3px] border-2 text-[18px] font-black leading-none tracking-[-0.03em] shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.58),inset_0_-7px_10px_hsl(0_0%_0%/0.14),0_8px_18px_hsl(0_0%_0%/0.24)]"
          style={boxStyle}
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
