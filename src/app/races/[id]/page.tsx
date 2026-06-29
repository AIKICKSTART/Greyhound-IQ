import { notFound } from "next/navigation";
import { getRaceById } from "@/lib/queries";
import { RunnerRow } from "@/components/runner-row";
import { Clock, MapPin, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const race = await getRaceById(id);
  if (!race) return {
    title: "Race not found — GreyhoundIQ",
    description: "Race not found in the GreyhoundIQ database.",
  };
  return {
    title: `R${race.raceNumber} ${race.meeting.track.name} — ${race.distance}m | GreyhoundIQ`,
    description: `Race ${race.raceNumber} at ${race.meeting.track.name}, ${race.distance}m${race.grade ? ` (${race.grade})` : ""}. Full runner list, form, and trainer info.`,
  };
}

export default async function RacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const race = await getRaceById(id);
  if (!race) notFound();

  const track = race.meeting.track;
  const hasResults = race.runners.some((r) => r.result);

  return (
    <div className="fade-in mx-auto max-w-5xl px-6 py-10">
      {/* Race header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[hsl(220_7%_42%)] mb-3 tracking-[-0.013em]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {track.name}, {track.state}
          </span>
          <span className="text-white/[0.1]">·</span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {race.raceTime.toLocaleTimeString("en-AU", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
          {race.prizeMoney && (
            <>
              <span className="text-white/[0.1]">·</span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />$
                {race.prizeMoney.toLocaleString()}
              </span>
            </>
          )}
        </div>
        <h1
          className="text-3xl font-semibold text-[hsl(210_13%_97%)] tracking-[-0.03em]"
        >
          Race {race.raceNumber}
          <span className="text-[hsl(215_14%_65%)]">
            {" "}— {race.distance}m
            {race.grade && ` (${race.grade})`}
          </span>
        </h1>
      </div>

      {/* Runners table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-[hsl(220_7%_42%)]">
                <th className="p-3 text-center w-14 tracking-[0.04em]">Box</th>
                <th className="p-3 text-left tracking-[0.04em]">Runner</th>
                <th className="p-3 text-left tracking-[0.04em]">Trainer</th>
                <th className="p-3 text-center tracking-[0.04em]">Wgt</th>
                <th className="p-3 text-left tracking-[0.04em]">Form</th>
                {hasResults && <th className="p-3 text-center tracking-[0.04em]">Result</th>}
              </tr>
            </thead>
            <tbody>
              {race.runners.map((runner) => (
                <RunnerRow key={runner.id} runner={runner} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {race.runners.length === 0 && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-[14px] text-[hsl(215_14%_65%)] tracking-[-0.013em]">
            No runners loaded for this race yet.
          </p>
        </div>
      )}
    </div>
  );
}
