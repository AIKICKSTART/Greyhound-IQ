import { getRecentResults } from "@/lib/queries";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Recent Results — GreyhoundIQ",
  description: "Race results from the past 48 hours across every Australian track. Tap a winner for full form and sectionals.",
};

export default async function ResultsPage() {
  const results = await getRecentResults(2);

  const byTrack = results.reduce(
    (acc, race) => {
      const trackName = race.meeting.track.name;
      if (!acc[trackName]) acc[trackName] = [];
      acc[trackName].push(race);
      return acc;
    },
    {} as Record<string, typeof results>
  );

  return (
    <div className="fade-in">
      <PageHero
        image="/images/feature-ai-predictions.png"
        badge="RECENT RESULTS"
        badgeIcon={<Trophy className="h-3 w-3 text-[hsl(25_95%_53%)]" />}
        badgeColor="orange"
        title={
          <>
            Past 48 hours.
            <br />
            <span className="gradient-text">Every winner.</span>
          </>
        }
        subtitle="Race results from across the country. Tap a winner for the full form chart and sectional data."
      />
      <section className="mx-auto max-w-5xl px-6 py-10">
        {results.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <p
              className="text-[14px] text-[hsl(215_14%_65%)] tracking-[-0.013em]"
            >
              No results available yet. The data pipeline connects in Phase 2.
            </p>
          </div>
        ) : (
          Object.entries(byTrack).map(([trackName, races]) => (
            <div key={trackName} className="mb-8">
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)] mb-3 tracking-[-0.02em]">
                {trackName}
              </h2>
              <div className="space-y-1.5">
                {races.map((race) => (
                  <div key={race.id} className="flex items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5 hover:bg-white/[0.04] transition-all">
                    <Link href={`/races/${race.id}`} className="text-[13px] font-medium text-[hsl(142_60%_48%)] w-14">
                      R{race.raceNumber}
                    </Link>
                    <span className="text-[12px] text-[hsl(220_7%_42%)] w-16 tracking-[-0.013em]">{race.distance}m</span>
                    <div className="flex-1 flex flex-wrap gap-3">
                      {race.runners.map((r, i) => (
                        <div key={r.id} className="flex items-center gap-1.5">
                          <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                            i === 0 ? "bg-[#FCD34D] text-gray-900" : "border border-white/[0.08] text-[hsl(215_14%_65%)]"
                          }`}>
                            {r.result?.finishingPosition}
                          </span>
                          <span className={`text-[13px] text-[hsl(210_13%_97%)] ${i === 0 ? "font-semibold" : "font-normal"}`}>
                            {r.dog.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <span className="text-[12px] text-[hsl(220_7%_42%)] tracking-[-0.013em]">
                      {race.raceTime.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
