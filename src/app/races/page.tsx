import { getUpcomingRaces } from "@/lib/queries";
import { MeetingCard } from "@/components/meeting-card";
import { PageHero } from "@/components/page-hero";
import { Flag } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Upcoming Races — GreyhoundIQ",
  description: "The next 7 days of greyhound racing across every Australian track. Full form and runners for every start.",
};

export default async function RacesPage() {
  const meetings = await getUpcomingRaces(7);
  const totalRaces = meetings.reduce((acc, m) => acc + m.races.length, 0);

  return (
    <div className="fade-in">
      <PageHero
        image="/images/hero-breaking-from-boxes.png"
        badge="UPCOMING RACES"
        badgeIcon={<Flag className="h-3 w-3 text-[hsl(142_60%_48%)]" />}
        badgeColor="green"
        title={
          <>
            Next 7 days.
            <br />
            <span className="gradient-text">All AU tracks.</span>
          </>
        }
        subtitle={`${meetings.length} meetings · ${totalRaces} races · full form and runners for every start.`}
      />
      <section className="mx-auto max-w-7xl px-6 py-10">
        {meetings.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
            <p
              className="text-[15px] text-[hsl(215_14%_65%)] tracking-[-0.013em]"
            >
              No upcoming meetings. Data pipeline connects in Phase 2.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
