import Link from "next/link";
import { MapPin, PlayCircle } from "lucide-react";

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
    runners: { id: string }[];
    videos?: {
      id: string;
      streamUrl: string | null;
      sourceStatus: number | null;
    }[];
  }[];
};

export function MeetingCard({ meeting }: { meeting: MeetingData }) {
  const track = meeting.track;
  const now = new Date();
  const nextRace = meeting.races.find((r) => r.raceTime > now);
  const replayCount = meeting.races.filter((race) =>
    race.videos?.some((video) => video.streamUrl)
  ).length;
  const maxVisibleRaces = 7;
  const overflow = meeting.races.length > maxVisibleRaces;
  const visibleRaces = overflow
    ? meeting.races.slice(0, maxVisibleRaces)
    : meeting.races.slice(0, 8);
  const hiddenRaceCount = meeting.races.length - visibleRaces.length;
  const emptySlots = overflow ? 0 : Math.max(0, 8 - visibleRaces.length);

  return (
    <div className="giq-carbon-surface giq-meeting-card group">
      <div className="flex items-start justify-between mb-4">
        <div>
          <Link
            href={`/tracks/${track.id}`}
          >
            <h3
              className="text-[16px] font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))] transition-colors tracking-[-0.02em]"
            >
              {track.name}
            </h3>
          </Link>
          <p
            className="flex items-center gap-1 mt-0.5 text-[12px] text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]"
          >
            <MapPin className="h-3 w-3" />
            {track.state}
          </p>
        </div>
        <div className="flex gap-1.5">
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
        {visibleRaces.map((race) => {
          const isLive =
            race.raceTime <= now &&
            now.getTime() - race.raceTime.getTime() < 20 * 60 * 1000;
          const isNext = nextRace?.id === race.id;
          return (
            <Link
              key={race.id}
              href={`/races/${race.id}`}
              className={`giq-chip giq-race-slot ${isLive ? "giq-chip-live" : isNext ? "giq-chip-active" : ""}`}
            >
              <span>R{race.raceNumber}</span>
              <span className="text-[10px] opacity-70">
                {isLive ? "Live" : formatRaceTime(race.raceTime)}
              </span>
            </Link>
          );
        })}
        {overflow && (
          <Link
            href={`/races?track=${track.id}`}
            className="giq-chip giq-race-slot font-bold"
          >
            +{hiddenRaceCount} more
          </Link>
        )}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <span key={index} className="giq-race-empty" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

function formatRaceTime(date: Date) {
  return date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
