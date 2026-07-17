import { ArrowRight, CirclePlay, Clock3, Trophy, Users } from "lucide-react";
import Link from "next/link";

import type { MeetingRacePresentation } from "@/lib/meeting-presentation";
import { formatRaceTime } from "@/lib/race-time";

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export function MeetingDetailRaceCard({
  race,
  presentation,
}: {
  race: {
    id: string;
    raceNumber: number;
    name: string | null;
    raceTime: Date;
    distance: number;
    grade: string | null;
    prizeMoney: number | null;
  };
  presentation: MeetingRacePresentation;
}) {
  return (
    <article
      className="giq-panel giq-panel-hover p-5"
      data-race-status={presentation.status.key}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="giq-badge giq-badge-neutral">
              Race {race.raceNumber}
            </span>
            <span className="giq-badge giq-badge-purple">
              {presentation.status.label}
            </span>
          </div>
          <h2 className="mt-3 text-[18px] font-semibold tracking-[-0.025em] text-[hsl(var(--foreground))]">
            {race.name ?? `Race ${race.raceNumber}`}
          </h2>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {formatRaceTime(race.raceTime)}
            </span>
            <span>{race.distance}m</span>
            <span>{race.grade ?? "Grade not available"}</span>
            {race.prizeMoney !== null && (
              <span>{currencyFormatter.format(race.prizeMoney)}</span>
            )}
          </p>
        </div>

        <Link
          href={`/races/${race.id}`}
          className="giq-outline-action min-h-10 px-4 py-2 text-[12px] font-semibold"
          aria-label={`Open race ${race.raceNumber}`}
        >
          Open race
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <RaceFact icon={<Users className="h-4 w-4" />} label="Runners">
          {presentation.runnerCount}
        </RaceFact>
        <RaceFact icon={<Trophy className="h-4 w-4" />} label="Results">
          {presentation.resultCount}
        </RaceFact>
        <RaceFact icon={<CirclePlay className="h-4 w-4" />} label="Replay">
          {presentation.hasReplay ? "Available" : "Not available"}
        </RaceFact>
      </div>

      {presentation.winner && (
        <p className="mt-4 text-[13px] text-[hsl(var(--muted-foreground))]">
          Winner: {" "}
          <Link
            href={`/dogs/${presentation.winner.dog.id}`}
            className="font-semibold text-[hsl(var(--secondary-light))] hover:underline"
          >
            {presentation.winner.dog.name}
          </Link>
          {presentation.winner.result?.runningTime != null && (
            <span> · {presentation.winner.result.runningTime.toFixed(2)}s</span>
          )}
        </p>
      )}
    </article>
  );
}

function RaceFact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="giq-subpanel flex items-center gap-3 p-3">
      <span className="text-[hsl(var(--primary-bright))]" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
          {label}
        </span>
        <span className="mt-1 block text-[13px] font-semibold text-[hsl(var(--foreground))]">
          {children}
        </span>
      </span>
    </div>
  );
}
