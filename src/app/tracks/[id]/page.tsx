import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Route, Trophy } from "lucide-react";
import { getBoxColourStyle } from "@/lib/box-colours";
import { getTrackById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const track = await getTrackById(id);
  if (!track) {
    return {
      title: "Track not found - GreyhoundIQ",
      description: "Track not found in the GreyhoundIQ database.",
    };
  }
  return {
    title: `${track.name} Track Guide - GreyhoundIQ`,
    description: `Track guide, recent meetings, distances, and records for ${track.name}, ${track.state}.`,
  };
}

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const track = await getTrackById(id);
  if (!track) notFound();

  const races = track.meetings.flatMap((meeting) => meeting.races);
  const runners = races.flatMap((race) =>
    race.runners.map((runner) => ({ ...runner, race }))
  );
  const completed = runners.filter((runner) => runner.result);
  const winners = completed.filter(
    (runner) => runner.result?.finishingPosition === 1
  );
  const bestRun = completed
    .filter((runner) => runner.result?.runningTime)
    .sort((a, b) => (a.result!.runningTime ?? 99) - (b.result!.runningTime ?? 99))[0];

  const boxWins = Array.from({ length: track.boxCount }, (_, index) => {
    const box = index + 1;
    const wins = winners.filter((runner) => runner.boxNumber === box).length;
    return { box, wins };
  });
  const maxWins = Math.max(...boxWins.map((row) => row.wins), 1);

  return (
    <div className="fade-in">
      <section className="relative overflow-hidden border-b border-white/[0.06] bg-[hsl(150_30%_3%)]">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,hsl(142_76%_36%/0.18),transparent_36%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <div className="mb-5 flex flex-wrap items-center gap-3 text-[13px] text-[hsl(215_14%_65%)]">
            <Link href="/tracks" className="hover:text-[hsl(210_13%_97%)]">
              Tracks
            </Link>
            <span>/</span>
            <span>{track.name}</span>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold leading-tight text-[hsl(210_13%_97%)] md:text-6xl">
                {track.name}
              </h1>
              <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[hsl(215_14%_65%)]">
                {track.state} track guide with recent meetings, race distances,
                box-bias signals, and current seeded records.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Meetings" value={track.meetings.length} />
                <Metric label="Races" value={races.length} />
                <Metric label="Boxes" value={track.boxCount} />
                <Metric
                  label="GPS"
                  value={track.hasIsolynx ? "Isolynx" : "No"}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-[hsl(142_60%_48%)]" />
            <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
              Recent meetings
            </h2>
          </div>

          <div className="space-y-3">
            {track.meetings.map((meeting) => (
              <article
                key={meeting.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[hsl(210_13%_97%)]">
                      {meeting.meetingDate.toLocaleDateString("en-AU", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </h3>
                    <p className="mt-1 text-[12px] text-[hsl(220_7%_42%)]">
                      {meeting.meetingType ?? "Race meeting"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[hsl(215_14%_65%)]">
                    {meeting.races.length} races
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {meeting.races.slice(0, 10).map((race) => (
                    <Link
                      key={race.id}
                      href={`/races/${race.id}`}
                      className="inline-flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-[hsl(215_14%_65%)] transition-all hover:bg-white/[0.08] hover:text-[hsl(210_13%_97%)]"
                    >
                      <Clock className="h-3 w-3" />
                      R{race.raceNumber}
                      <span>{race.distance}m</span>
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-5 flex items-center gap-3">
              <Route className="h-5 w-5 text-[hsl(25_95%_53%)]" />
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                Track profile
              </h2>
            </div>
            <div className="space-y-3 text-[13px] text-[hsl(215_14%_65%)]">
              <Info label="State" value={track.state} />
              <Info label="Surface" value={track.surface ?? "Unknown"} />
              <Info
                label="Circumference"
                value={track.circumference ? `${track.circumference}m` : "-"}
              />
              <Info
                label="Straight"
                value={track.straightLength ? `${track.straightLength}m` : "-"}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-5 flex items-center gap-3">
              <Trophy className="h-5 w-5 text-[hsl(25_95%_53%)]" />
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                Seeded record
              </h2>
            </div>
            {bestRun ? (
              <div>
                <p className="font-mono text-3xl font-semibold text-[hsl(25_95%_53%)]">
                  {bestRun.result?.runningTime?.toFixed(2)}s
                </p>
                <p className="mt-2 text-[13px] text-[hsl(215_14%_65%)]">
                  {bestRun.dog.name}, R{bestRun.race.raceNumber},{" "}
                  {bestRun.race.distance}m
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-[hsl(215_14%_65%)]">
                No completed races in the current seed window.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-5 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-[hsl(142_60%_48%)]" />
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                Box wins
              </h2>
            </div>
            <div className="space-y-3">
              {boxWins.map((row) => {
                const boxStyle = getBoxColourStyle(row.box);

                return (
                  <div key={row.box} className="grid grid-cols-[32px_1fr_32px] items-center gap-3">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded border text-[12px] font-bold"
                      style={boxStyle}
                    >
                      {row.box}
                    </span>
                    <div className="h-2 rounded-full bg-white/[0.06]">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max((row.wins / maxWins) * 100, 4)}%`,
                          background: boxStyle.background,
                        }}
                      />
                    </div>
                    <span className="text-right font-mono text-[12px] text-[hsl(215_14%_65%)]">
                      {row.wins}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-[hsl(220_7%_42%)]">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-semibold text-[hsl(210_13%_97%)]">
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <span className="text-[hsl(220_7%_42%)]">{label}</span>
      <span className="text-[hsl(210_13%_97%)]">{value}</span>
    </div>
  );
}
