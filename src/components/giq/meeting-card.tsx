import Link from "next/link";
import { MapPin, PlayCircle } from "lucide-react";

import { cn } from "./utils";

export type GiqMeetingRace = {
  id: string;
  raceNumber: number;
  time?: string;
  href?: string;
  isLive?: boolean;
  isNext?: boolean;
};

export type GiqMeeting = {
  track: {
    id?: string;
    name: string;
    state: string;
    href?: string;
    hasGps?: boolean;
  };
  races: GiqMeetingRace[];
  replayCount?: number;
  moreHref?: string;
};

const maxVisibleRaces = 7;

export function MeetingCard({
  meeting,
  className,
}: {
  meeting: GiqMeeting;
  className?: string;
}) {
  const overflow = meeting.races.length > maxVisibleRaces;
  const visible = overflow ? meeting.races.slice(0, maxVisibleRaces) : meeting.races.slice(0, 8);
  const hiddenRaceCount = meeting.races.length - visible.length;
  const emptySlots = overflow ? 0 : Math.max(0, 8 - visible.length);
  const TrackTitle = (
    <h3 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] transition-colors group-hover:text-[hsl(var(--primary-bright))]">
      {meeting.track.name}
    </h3>
  );

  return (
    <div className={cn("giq-carbon-surface giq-meeting-card group", className)}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {meeting.track.href ? (
            <Link href={meeting.track.href}>{TrackTitle}</Link>
          ) : (
            TrackTitle
          )}
          <p className="mt-0.5 flex items-center gap-1 text-[12px] tracking-[-0.013em] text-[hsl(var(--subtle-foreground))]">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {meeting.track.state}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {meeting.track.hasGps ? <span className="giq-pill giq-pill-purple">GPS</span> : null}
          <span className="giq-pill giq-pill-muted">{meeting.races.length} races</span>
          {meeting.replayCount ? (
            <span className="giq-pill giq-pill-gold">
              <PlayCircle className="h-2.5 w-2.5" aria-hidden="true" />
              {meeting.replayCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="giq-race-grid">
        {visible.map((race) => (
          <Link
            key={race.id}
            href={race.href ?? "#"}
            className={cn(
              "giq-chip giq-race-slot",
              race.isLive ? "giq-chip-live" : race.isNext ? "giq-chip-active" : ""
            )}
          >
            <span>R{race.raceNumber}</span>
            <span className="text-[10px] opacity-70">{race.isLive ? "Live" : race.time}</span>
          </Link>
        ))}
        {overflow ? (
          <Link
            href={meeting.moreHref ?? meeting.track.href ?? "#"}
            className="giq-chip giq-race-slot font-bold"
          >
            +{hiddenRaceCount} more
          </Link>
        ) : null}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <span key={index} className="giq-race-empty" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
