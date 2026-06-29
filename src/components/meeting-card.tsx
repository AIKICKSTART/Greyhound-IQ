import Link from "next/link";
import { Clock, MapPin } from "lucide-react";

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
  }[];
};

export function MeetingCard({ meeting }: { meeting: MeetingData }) {
  const track = meeting.track;
  const nextRace = meeting.races.find((r) => r.raceTime > new Date());

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <Link
            href={`/tracks/${track.id}`}
          >
            <h3
              className="text-[16px] font-semibold text-[hsl(210_13%_97%)] hover:text-[hsl(142_60%_48%)] transition-colors tracking-[-0.02em]"
            >
              {track.name}
            </h3>
          </Link>
          <p
            className="flex items-center gap-1 mt-0.5 text-[12px] text-[hsl(220_7%_42%)] tracking-[-0.013em]"
          >
            <MapPin className="h-3 w-3" />
            {track.state}
          </p>
        </div>
        <div className="flex gap-1.5">
          {track.hasIsolynx && (
            <span className="rounded-full bg-[hsl(142_76%_36%/0.12)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(142_60%_48%)] tracking-[0.02em]">
              GPS
            </span>
          )}
          <span className="rounded-full border border-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[hsl(215_14%_65%)] tracking-[0.02em]">
            {meeting.races.length} races
          </span>
        </div>
      </div>

      {/* Race pills */}
      <div className="flex flex-wrap gap-1.5">
        {meeting.races.slice(0, 10).map((race) => {
          const isNext = nextRace?.id === race.id;
          return (
            <Link
              key={race.id}
              href={`/races/${race.id}`}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium tracking-[-0.013em] transition-all ${
                isNext
                  ? "bg-[hsl(142_76%_36%)] text-white shadow-lg shadow-[hsl(142_76%_36%/0.3)]"
                  : "bg-white/[0.04] text-[hsl(215_14%_65%)] hover:bg-white/[0.08] hover:text-[hsl(210_13%_97%)]"
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>R{race.raceNumber}</span>
              <span className="text-[10px] opacity-70">
                {race.raceTime.toLocaleTimeString("en-AU", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
