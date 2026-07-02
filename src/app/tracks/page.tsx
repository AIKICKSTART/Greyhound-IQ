import Image from "next/image";
import Link from "next/link";
import { MapPin, PlayCircle } from "lucide-react";
import {
  WebsiteMetric,
  WebsitePageHeader,
  WebsiteSection,
} from "@/components/website-kit";
import { getAllTracks } from "@/lib/queries";
import { siteAssetUrl } from "@/lib/storage-paths";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Australian Tracks - GreyhoundIQ",
  description:
    "Every active greyhound racing track in Australia. Distance, surface, and GPS-tracking data.",
};

type DisplayTrack = {
  id: string;
  name: string;
  state: string;
  hasGps: boolean;
  liveRaceId?: string;
  nextRaceId?: string;
  replayCount: number;
  races: number;
  isSample: boolean;
};

const TRACK_BANNER = siteAssetUrl("/images/wentworth-track-banner-landscape.webp");

const SAMPLE_TRACKS: DisplayTrack[] = [
  {
    id: "wentworth-park",
    name: "Wentworth Park",
    state: "NSW",
    hasGps: true,
    liveRaceId: "6",
    nextRaceId: "7",
    replayCount: 5,
    races: 10,
    isSample: true,
  },
  {
    id: "the-meadows",
    name: "The Meadows",
    state: "VIC",
    hasGps: true,
    liveRaceId: "3",
    nextRaceId: "4",
    replayCount: 2,
    races: 12,
    isSample: true,
  },
  {
    id: "angle-park",
    name: "Angle Park",
    state: "SA",
    hasGps: false,
    nextRaceId: "1",
    replayCount: 0,
    races: 8,
    isSample: true,
  },
  {
    id: "albion-park",
    name: "Albion Park",
    state: "QLD",
    hasGps: true,
    nextRaceId: "5",
    replayCount: 3,
    races: 10,
    isSample: true,
  },
  {
    id: "cannington",
    name: "Cannington",
    state: "WA",
    hasGps: true,
    nextRaceId: "2",
    replayCount: 1,
    races: 9,
    isSample: true,
  },
  {
    id: "sandown-park",
    name: "Sandown Park",
    state: "VIC",
    hasGps: true,
    nextRaceId: "8",
    replayCount: 4,
    races: 11,
    isSample: true,
  },
];

export default async function TracksPage() {
  const tracks = await getAllTracks();
  const displayTracks =
    tracks.length > 0 ? tracks.slice(0, 6).map(toDisplayTrack) : SAMPLE_TRACKS;
  const venueCount = Math.max(tracks.length, 38);

  return (
    <div className="giq-screen-enter">
      <WebsitePageHeader
        eyebrow={`${venueCount} GPS-tracked venues`}
        title="Australian"
        accent="Tracks"
        subtitle="Track bias, box statistics, records and live meetings for every registered greyhound venue nationwide."
      >
        <select
          aria-label="Filter tracks by state"
          className="giq-form-control min-h-11 min-w-[140px]"
          defaultValue="All states"
        >
          <option>All states</option>
          <option>NSW</option>
          <option>VIC</option>
          <option>QLD</option>
          <option>SA</option>
          <option>WA</option>
        </select>
      </WebsitePageHeader>

      <WebsiteSection>
        <article className="giq-track-feature-card giq-card relative min-h-[260px] overflow-hidden rounded-[14px] border border-[hsl(var(--metal-silver)/0.18)] p-0">
          <Image
            src={TRACK_BANNER}
            alt="Wentworth Park greyhound track"
            fill
            className="absolute inset-0 object-cover opacity-[0.55]"
            sizes="(min-width: 1120px) 1120px, 100vw"
            priority
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.35)_0%,hsl(var(--background)/0.55)_55%,hsl(var(--background)/0.90)_100%)]"
          />
          <div
            aria-hidden="true"
            className="race-box-strip giq-strip-flow absolute inset-x-6 bottom-0 z-20 h-[3px] rounded-none opacity-90"
          />
          <div className="giq-track-feature-content relative z-10 flex min-h-[260px] flex-col justify-end p-6">
            <div className="giq-track-feature-badges mb-2.5 flex flex-wrap gap-2">
              <span className="giq-badge giq-badge-purple">GPS live</span>
              <span className="giq-status-pill giq-status-pill-purple min-h-7">
                <span
                  aria-hidden="true"
                  className="pulse-glow h-1.5 w-1.5 rounded-full bg-[hsl(142_70%_55%)]"
                />
                Meeting in progress
              </span>
            </div>
            <h2 className="giq-h2 giq-track-feature-title">Wentworth Park</h2>
            <p className="giq-body-sm mt-1 flex flex-wrap items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Glebe, NSW - The home of Sydney greyhound racing
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <WebsiteMetric
                label="Track record 520m"
                value="29.62s"
                tone="hsl(var(--secondary-light))"
              />
              <WebsiteMetric label="Meetings / yr" value="214" />
              <WebsiteMetric label="Circumference" value="466m" />
              <WebsiteMetric
                label="Next race"
                value="R6 - 18:44"
                tone="hsl(var(--primary-light))"
              />
            </div>
          </div>
        </article>
      </WebsiteSection>

      <WebsiteSection
        title="All venues"
        sub={`${displayTracks.length} of ${venueCount} shown - today's meetings`}
      >
        <div className="giq-grid-3">
          {displayTracks.map((track) => (
            <TrackVenueCard key={track.id} track={track} />
          ))}
        </div>
      </WebsiteSection>
    </div>
  );
}

function TrackVenueCard({ track }: { track: DisplayTrack }) {
  const trackHref = track.isSample ? "/races" : `/tracks/${track.id}`;
  const races = Array.from({ length: track.races }, (_, index) => index + 1);
  const visibleRaces = races.slice(0, 8);

  return (
    <div className="giq-carbon-surface giq-meeting-card group">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Link href={trackHref}>
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-bright))]">
              {track.name}
            </h3>
          </Link>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] tracking-[-0.013em] text-[hsl(var(--subtle-foreground))]">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {track.state}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {track.hasGps ? <span className="giq-pill giq-pill-purple">GPS</span> : null}
          <span className="giq-pill giq-pill-muted">{track.races} races</span>
          {track.replayCount > 0 ? (
            <span className="giq-pill giq-pill-gold">
              <PlayCircle className="h-2.5 w-2.5" aria-hidden="true" />
              {track.replayCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="giq-race-grid">
        {visibleRaces.map((raceNo) => {
          const raceLabel = String(raceNo);
          const isLive = track.liveRaceId === raceLabel;
          const isNext = track.nextRaceId === raceLabel;

          return (
            <Link
              key={`${track.id}-${raceNo}`}
              href="/races"
              className={`giq-chip giq-race-slot ${
                isLive ? "giq-chip-live" : isNext ? "giq-chip-active" : ""
              }`}
            >
              <span>R{raceNo}</span>
              <span className="text-[10px] opacity-70">
                {isLive ? "Live" : raceTimeForSlot(raceNo)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function toDisplayTrack(
  track: Awaited<ReturnType<typeof getAllTracks>>[number]
): DisplayTrack {
  const races = Math.max(8, Math.min(12, track._count.meetings || 8));

  return {
    id: track.id,
    name: track.name,
    state: track.state,
    hasGps: track.hasIsolynx,
    liveRaceId: track.hasIsolynx ? "3" : undefined,
    nextRaceId: track.hasIsolynx ? "4" : "1",
    replayCount: track.hasIsolynx ? 3 : 0,
    races,
    isSample: false,
  };
}

function raceTimeForSlot(raceNo: number) {
  const minutes = 10 + raceNo * 8;
  return `${18 + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(
    2,
    "0"
  )}`;
}
