import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, PlayCircle } from "lucide-react";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import {
  WebsiteMetric,
  WebsitePageHeader,
  WebsiteSection,
} from "@/components/website-kit";
import { getActiveTracks } from "@/lib/queries";
import {
  formatRaceDateInput,
  formatRaceDayLabel,
  formatRaceTime,
} from "@/lib/race-time";
import { siteAssetUrl } from "@/lib/storage-paths";
import { trackMediaPathForName } from "@/lib/track-media";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Australian Tracks - GreyhoundIQ",
  description:
    "Every active greyhound racing track in Australia. Distance, surface, and GPS-tracking data.",
};

type TracksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type DisplayRace = {
  id: string;
  raceNumber: number;
  raceTime: Date;
  distance: number;
  hasReplay: boolean;
  isLive: boolean;
  isNext: boolean;
};

type DisplayTrack = {
  id: string;
  name: string;
  state: string;
  surface: string | null;
  boxCount: number;
  hasGps: boolean;
  meetingCount: number;
  latestMeetingDate: Date | null;
  replayCount: number;
  races: DisplayRace[];
  liveRace: DisplayRace | null;
  nextRace: DisplayRace | null;
  mediaPath: string | null;
};

const TRACK_BANNER = siteAssetUrl("/images/wentworth-track-banner-landscape.webp");
const TRACK_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;

export default async function TracksPage({ searchParams }: TracksPageProps) {
  const params = await searchParams;
  const selectedState = normaliseTrackState(firstParam(params.state));
  const tracks = await getActiveTracks();
  const displayTracks = tracks
    .filter((track) => !selectedState || track.state === selectedState)
    .map((track) => toDisplayTrack(track, new Date()));
  const featuredTrack =
    displayTracks.find((track) => track.mediaPath && track.races.length > 0) ??
    displayTracks.find((track) => track.mediaPath) ??
    displayTracks.find((track) => track.races.length > 0) ??
    displayTracks[0] ??
    null;

  return (
    <div>
      <WebsitePageHeader
        eyebrow={`${tracks.length} active venues`}
        title="Australian"
        accent="Tracks"
        subtitle="Track bias, box statistics, records and current meetings from the GreyhoundIQ database."
      >
        <form action="/tracks" className="flex flex-wrap gap-2">
          <AutoSubmitSelect
            aria-label="Filter tracks by state"
            className="giq-form-control min-h-11 min-w-[140px]"
            name="state"
            defaultValue={selectedState ?? ""}
          >
            <option value="">All states</option>
            {TRACK_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </AutoSubmitSelect>
          <button className="giq-button giq-button-carbon min-h-11 px-4 text-[13px] font-semibold">
            Filter
          </button>
        </form>
      </WebsitePageHeader>

      {featuredTrack && (
        <WebsiteSection>
          <article className="giq-track-feature-card giq-card relative min-h-[260px] overflow-hidden rounded-[14px] border border-[hsl(var(--metal-silver)/0.18)] p-0">
            <Image
              src={
                featuredTrack.mediaPath
                  ? siteAssetUrl(featuredTrack.mediaPath)
                  : TRACK_BANNER
              }
              alt=""
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
                {featuredTrack.hasGps && (
                  <span className="giq-badge giq-badge-purple">GPS tracked</span>
                )}
                {featuredTrack.liveRace ? (
                  <span className="giq-status-pill giq-status-pill-purple min-h-7">
                    <span
                      aria-hidden="true"
                      className="pulse-glow h-1.5 w-1.5 rounded-full bg-[hsl(142_70%_55%)]"
                    />
                    Race live
                  </span>
                ) : featuredTrack.nextRace ? (
                  <span className="giq-status-pill giq-status-pill-purple min-h-7">
                    Next race {formatRaceTime(featuredTrack.nextRace.raceTime)}
                  </span>
                ) : null}
              </div>
              <h2 className="giq-h2 giq-track-feature-title">
                {featuredTrack.name}
              </h2>
              <p className="giq-body-sm mt-1 flex flex-wrap items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {featuredTrack.state}
                {featuredTrack.surface ? ` / ${featuredTrack.surface}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <WebsiteMetric
                  label="Latest meeting"
                  value={
                    featuredTrack.latestMeetingDate
                      ? formatRaceDayLabel(formatRaceDateInput(featuredTrack.latestMeetingDate))
                      : "No meeting"
                  }
                  tone="hsl(var(--secondary-light))"
                />
                <WebsiteMetric
                  label="Races"
                  value={featuredTrack.races.length.toString()}
                />
                <WebsiteMetric
                  label="Replays"
                  value={featuredTrack.replayCount.toString()}
                />
                <WebsiteMetric
                  label="Next race"
                  value={
                    featuredTrack.nextRace
                      ? `R${featuredTrack.nextRace.raceNumber} / ${formatRaceTime(
                          featuredTrack.nextRace.raceTime
                        )}`
                      : "Complete"
                  }
                  tone="hsl(var(--primary-light))"
                />
              </div>
            </div>
          </article>
        </WebsiteSection>
      )}

      <WebsiteSection
        title="All venues"
        sub={`${displayTracks.length} of ${tracks.length} active venues shown`}
      >
        {displayTracks.length > 0 ? (
          <div className="giq-stagger giq-grid-3">
            {displayTracks.map((track) => (
              <TrackVenueCard key={track.id} track={track} />
            ))}
          </div>
        ) : (
          <div className="giq-empty-state p-12 text-center">
            <MapPin className="mx-auto h-8 w-8 text-[hsl(var(--primary-bright))]" />
            <p className="mt-4 text-[15px] text-[hsl(var(--muted-foreground))]">
              No tracks match this state filter.
            </p>
          </div>
        )}
      </WebsiteSection>
    </div>
  );
}

function TrackVenueCard({ track }: { track: DisplayTrack }) {
  const visibleRaces = track.races.slice(0, 8);

  return (
    <div className="giq-carbon-surface giq-meeting-card group">
      {track.mediaPath ? (
        <Link
          href={`/tracks/${track.id}`}
          aria-label={`Open ${track.name} track guide`}
          className="relative mb-4 block aspect-[5/3] overflow-hidden rounded-[10px] border border-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[hsl(var(--primary-light))]"
        >
          <Image
            src={siteAssetUrl(track.mediaPath)}
            alt=""
            fill
            className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(min-width: 1120px) 350px, (min-width: 720px) 45vw, calc(100vw - 48px)"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,hsl(var(--background)/0.64)_100%)]"
          />
        </Link>
      ) : null}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Link href={`/tracks/${track.id}`}>
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
          <span className="giq-pill giq-pill-muted">
            {track.meetingCount} meetings
          </span>
          {track.replayCount > 0 ? (
            <span className="giq-pill giq-pill-gold">
              <PlayCircle className="h-2.5 w-2.5" aria-hidden="true" />
              {track.replayCount}
            </span>
          ) : null}
        </div>
      </div>

      {visibleRaces.length > 0 ? (
        <div className="giq-race-grid">
          {visibleRaces.map((race) => (
            <Link
              key={race.id}
              href={`/races/${race.id}`}
              className={`giq-chip giq-race-slot ${
                race.isLive ? "giq-chip-live" : race.isNext ? "giq-chip-active" : ""
              }`}
              aria-label={`Open ${track.name} race ${race.raceNumber} at ${formatRaceTime(race.raceTime)}`}
            >
              <span>R{race.raceNumber}</span>
              <span className="text-[10px] opacity-70">
                {race.isLive ? "Live" : formatRaceTime(race.raceTime)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="giq-empty-state px-4 py-6 text-center">
          <CalendarDays className="mx-auto h-5 w-5 text-[hsl(var(--subtle-foreground))]" />
          <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            No recent racecard in the database yet.
          </p>
        </div>
      )}

      {track.races.length > visibleRaces.length && (
        <Link
          href={`/tracks/${track.id}`}
          className="giq-outline-action mt-3 min-h-9 w-full justify-center px-3 text-[12px] font-semibold"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {track.races.length - visibleRaces.length} more races
        </Link>
      )}
    </div>
  );
}

function toDisplayTrack(
  track: Awaited<ReturnType<typeof getActiveTracks>>[number],
  now: Date
): DisplayTrack {
  const latestMeeting = track.meetings[0] ?? null;
  const races = (latestMeeting?.races ?? []).map((race) => {
    const raceTime = race.raceTime;
    const isLive =
      raceTime <= now && now.getTime() - raceTime.getTime() < 20 * 60 * 1000;

    return {
      id: race.id,
      raceNumber: race.raceNumber,
      raceTime,
      distance: race.distance,
      hasReplay: Boolean(
        race.replayUrl || race.videos.some((video) => video.streamUrl)
      ),
      isLive,
      isNext: false,
    };
  });
  const nextRace = races.find((race) => race.raceTime > now) ?? null;
  const liveRace = races.find((race) => race.isLive) ?? null;

  return {
    id: track.id,
    name: track.name,
    state: track.state,
    surface: track.surface,
    boxCount: track.boxCount,
    hasGps: track.hasIsolynx,
    meetingCount: track._count.meetings,
    latestMeetingDate: latestMeeting?.meetingDate ?? null,
    replayCount: races.filter((race) => race.hasReplay).length,
    races: races.map((race) => ({
      ...race,
      isNext: race.id === nextRace?.id,
    })),
    liveRace,
    nextRace,
    mediaPath: trackMediaPathForName(track.name),
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normaliseTrackState(value: string | undefined) {
  const state = value?.toUpperCase();
  return TRACK_STATES.find((option) => option === state) ?? null;
}
