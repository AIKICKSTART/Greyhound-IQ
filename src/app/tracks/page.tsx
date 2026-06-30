import { getAllTracks } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { MapPin } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Australian Tracks — GreyhoundIQ",
  description: "Every active greyhound racing track in Australia. Distance, surface, and GPS-tracking data.",
};

export default async function TracksPage() {
  const tracks = await getAllTracks();

  return (
    <div className="fade-in">
      <PageHero
        image="/images/hero-greyhoundiq-brand.webp"
        badge="AUSTRALIAN TRACKS"
        badgeIcon={<MapPin className="h-3 w-3 text-[hsl(142_60%_48%)]" />}
        badgeColor="green"
        title={
          <>
            {tracks.length} tracks.
            <br />
            <span className="gradient-text">One platform.</span>
          </>
        }
        subtitle="Every active greyhound track across Australia. Tap a track to see recent meetings, distances, and surface data."
      />
      <section className="mx-auto max-w-5xl px-6 py-10">
        {tracks.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <p className="text-[14px] text-[hsl(215_14%_65%)]">
              No tracks loaded yet. The data pipeline connects in Phase 2.
            </p>
            <Link
              href="/races"
              className="inline-block mt-4 text-[13px] font-semibold text-[hsl(142_60%_48%)] hover:underline tracking-[-0.013em]"
            >
              Browse upcoming races →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => (
              <Link
                key={track.id}
                href={`/tracks/${track.id}`}
                id={track.name.toLowerCase().replace(/\s+/g, "-")}
                className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all scroll-mt-20"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[hsl(210_13%_97%)] tracking-[-0.02em]">{track.name}</h3>
                    <p className="flex items-center gap-1 mt-0.5 text-[12px] text-[hsl(220_7%_42%)]"><MapPin className="h-3 w-3" />{track.state}</p>
                  </div>
                  {track.hasIsolynx && (
                    <span className="rounded-full bg-[hsl(142_76%_36%/0.12)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(142_60%_48%)]">GPS</span>
                  )}
                </div>
                <div className="mt-4 flex gap-4 text-[12px] text-[hsl(220_7%_42%)] tracking-[-0.013em]">
                  {track.circumference && <span>{track.circumference}m circ.</span>}
                  {track.straightLength && <span>{track.straightLength}m straight</span>}
                  <span>{track.boxCount} boxes</span>
                </div>
                <p className="mt-2 text-[11px] text-[hsl(220_7%_42%)]">{track._count.meetings} meetings</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
