import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, PlayCircle } from "lucide-react";
import {
  formatRaceDateInput,
  formatRaceTime,
  formatShortRaceDayLabel,
} from "@/lib/race-time";
import { siteAssetUrl } from "@/lib/storage-paths";
import { trackMediaPathForName } from "@/lib/track-media";

type MeetingData = {
  id: string;
  meetingDate: Date;
  track: { id: string; name: string; state: string; hasIsolynx: boolean };
  races: {
    id: string;
    raceNumber: number;
    raceTime: Date;
    distance: number;
    grade: string | null;
    runners?: { id: string }[];
    _count?: { runners: number };
    videos?: {
      id: string;
      streamUrl: string | null;
      sourceStatus: number | null;
    }[];
  }[];
};

export function MeetingCard({ meeting }: { meeting: MeetingData }) {
  const track = meeting.track;
  const trackMediaPath = trackMediaPathForName(track.name);
  const now = new Date();
  const nextRace = meeting.races.find((r) => r.raceTime > now);
  const featuredRace = nextRace ?? meeting.races[0];
  const dateLabel = formatShortRaceDayLabel(
    formatRaceDateInput(featuredRace?.raceTime ?? meeting.meetingDate)
  );
  const replayCount = meeting.races.filter((race) =>
    race.videos?.some((video) => video.streamUrl)
  ).length;
  const emptySlots = Math.max(0, 8 - meeting.races.length);

  return (
    <div className="giq-carbon-surface giq-meeting-card group">
      <Link
        href={`/tracks/${track.id}`}
        aria-label={`Open ${track.name} track guide`}
        className="relative mb-4 block aspect-[5/2] overflow-hidden rounded-[10px] border border-white/[0.08] bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.18),transparent_58%),hsl(var(--surface-2))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[hsl(var(--primary-light))]"
      >
        {trackMediaPath ? (
          <Image
            src={siteAssetUrl(trackMediaPath)}
            alt=""
            fill
            className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(min-width: 1280px) 390px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, calc(100vw - 48px)"
          />
        ) : (
          <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">
            <MapPin className="h-5 w-5 text-[hsl(var(--primary-light))]" aria-hidden="true" />
            Track image unavailable
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,hsl(var(--background)/0.72)_100%)]"
        />
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/tracks/${track.id}`}
            className="inline-flex rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[hsl(var(--primary-light))]"
          >
            <h3
              className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-bright))]"
            >
              {track.name}
            </h3>
          </Link>
          <p
            className="flex items-center gap-1 mt-0.5 text-[12px] text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]"
          >
            <MapPin className="h-3 w-3" />
            {track.state}
            <span aria-hidden="true">/</span>
            {dateLabel}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {track.hasIsolynx && (
            <span className="giq-pill giq-pill-purple">
              GPS
            </span>
          )}
          <span className="giq-pill giq-pill-muted">
            {meeting.races.length} races
          </span>
          {replayCount > 0 && (
            <span className="giq-pill giq-pill-gold">
              <PlayCircle className="h-2.5 w-2.5" />
              {replayCount}
            </span>
          )}
        </div>
      </div>

      <div className="giq-race-grid">
        {meeting.races.map((race) => {
          const isLive =
            race.raceTime <= now &&
            now.getTime() - race.raceTime.getTime() < 20 * 60 * 1000;
          const isNext = nextRace?.id === race.id;
          const timeLabel = formatRaceTime(race.raceTime);
          const hasReplay = race.videos?.some((video) => video.streamUrl);
          return (
            <Link
              key={race.id}
              href={`/races/${race.id}`}
              className={`giq-chip giq-race-slot ${isLive ? "giq-chip-live" : isNext ? "giq-chip-active" : ""}`}
              aria-label={`Open ${track.name}, ${track.state} race ${race.raceNumber} at ${timeLabel}`}
            >
              <span className="giq-race-slot-main">R{race.raceNumber}</span>
              <span className="giq-race-slot-time">{timeLabel}</span>
              <span className="giq-race-slot-footer">
                <span>{race.distance}m</span>
                {hasReplay && <PlayCircle className="h-3 w-3" aria-hidden="true" />}
              </span>
              {isLive && <span className="giq-race-slot-status">Live</span>}
            </Link>
          );
        })}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <span key={index} className="giq-race-empty" aria-hidden="true" />
        ))}
      </div>

      {featuredRace && (
        <Link
          href={`/races/${featuredRace.id}`}
          className="giq-outline-action mt-4 min-h-11 w-full justify-center px-4 text-[12px] font-semibold"
          aria-label={`Open ${track.name}, ${track.state} race ${featuredRace.raceNumber} at ${formatRaceTime(featuredRace.raceTime)}`}
        >
          {nextRace ? "Open next race" : "Open latest race"}
          <span>R{featuredRace.raceNumber}</span>
          <span>{formatRaceTime(featuredRace.raceTime)}</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
