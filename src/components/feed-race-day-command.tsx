import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Clock3,
  Sparkles,
} from "lucide-react";

import type {
  FeedRaceDayData,
  FeedRaceDayRace,
  RacingDayTrackOption,
} from "@/lib/feed-race-day";
import { FeedRacingDayConfig } from "@/components/feed-racing-day-config";
import { formatRaceTime } from "@/lib/race-time";

export function FeedRaceDayCommand({
  firstName,
  data,
  trackOptions,
  selectedTrackIds,
}: {
  firstName: string;
  data: FeedRaceDayData;
  trackOptions: RacingDayTrackOption[];
  selectedTrackIds: string[];
}) {
  const hasClaimedRaces = data.myRaces.length > 0;
  const displayedRaces = hasClaimedRaces ? data.myRaces : data.nextRaces;
  const nextRace = displayedRaces[0] ?? null;
  const isFiltered = selectedTrackIds.length > 0;

  return (
    <section
      data-feed-race-day-command
      className="relative isolate overflow-hidden rounded-[24px] border border-white/15 bg-[hsl(var(--surface-2))] shadow-[0_24px_70px_hsl(0_0%_0%/0.35)]"
    >
      <div className="relative min-h-[260px] overflow-hidden sm:min-h-[300px]">
        <Image
          src="/images/wentworth-gate-hero.webp"
          alt="Greyhounds racing under lights"
          fill
          priority
          className="object-cover object-center"
          sizes="(min-width: 1024px) 96vw, 100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.95)_0%,hsl(var(--surface-1)/0.66)_42%,hsl(var(--surface-1)/0.12)_78%),linear-gradient(0deg,hsl(var(--surface-1)/0.92)_0%,transparent_52%)]" />
        <div className="relative z-10 flex min-h-[260px] max-w-3xl flex-col justify-center px-5 py-8 sm:min-h-[300px] sm:px-10 lg:px-14">
          <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[hsl(var(--secondary-light))]">
            <Sparkles className="size-4" aria-hidden="true" />
            Race day command
          </p>
          <h1 className="font-display max-w-2xl text-[clamp(2rem,5vw,4.4rem)] leading-[0.96] tracking-[-0.045em] text-white">
            Your racing day,
            <br />
            <span className="giq-text-gold-glass">at a glance.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-6 text-white/72 sm:text-[16px]">
            Welcome back, {firstName}. Today&apos;s available race cards and
            results are ready from the live racing dataset.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/races"
              className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
            >
              Open race cards
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/results"
              className="giq-button giq-button-carbon px-5 text-[13px] font-semibold"
            >
              Latest results
            </Link>
            <FeedRacingDayConfig
              trackOptions={trackOptions}
              selectedTrackIds={selectedTrackIds}
            />
          </div>
        </div>
      </div>

      <div className="relative z-20 grid border-t border-white/10 bg-black/45 backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={hasClaimedRaces ? "Next dog race" : "Next race"}
          value={
            nextRace
              ? `${nextRace.track} · R${nextRace.raceNumber}`
              : "No more today"
          }
          detail={
            nextRace
              ? `${nextRace.statusLabel} · ${nextRace.distance}m`
              : "Open recent race cards"
          }
        />
        <Metric
          label={isFiltered ? "My racing day" : "Meetings today"}
          value={String(data.meetingCount)}
          detail={
            isFiltered ? `${data.stateLabel} · filtered` : data.stateLabel
          }
        />
        <Metric
          label="My racing links"
          value={`${data.claimedDogCount} dog${data.claimedDogCount === 1 ? "" : "s"}`}
          detail={
            hasClaimedRaces
              ? `${data.claimedTrainerCount} trainer${data.claimedTrainerCount === 1 ? "" : "s"} · ${data.myRaces.length} race${data.myRaces.length === 1 ? "" : "s"}`
              : "Approved dog and trainer claims appear here"
          }
        />
        <Metric
          label="Races today"
          value={String(data.raceCount)}
          detail="From stored live race cards"
        />
      </div>

      <div className="grid gap-4 border-t border-white/10 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--secondary-light))]">
                {hasClaimedRaces ? "My Race Day" : "Today&apos;s card"}
              </p>
              <h2 className="mt-1 text-[16px] font-semibold text-white">
                {hasClaimedRaces ? "Your dogs next on track" : "Next on track"}
              </h2>
            </div>
            <Link
              href="/races"
              className="text-[12px] font-semibold text-[hsl(var(--primary-light))]"
            >
              Full race card
            </Link>
          </div>
          {displayedRaces.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-3">
              {displayedRaces.map((race) => (
                <NextRace key={race.id} race={race} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 p-5 text-[12px] text-white/48">
              No live or upcoming races are available for today. Recent cards
              remain available in the race explorer.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--secondary-light))]">
            <Bookmark className="size-4" aria-hidden="true" />
            Saved race plan
          </p>
          <h2 className="mt-2 text-[15px] font-semibold text-white">
            No saved plan
          </h2>
          <p className="mt-2 text-[11px] leading-5 text-white/45">
            Race-plan persistence is not available yet. Open the live race cards
            to review today&apos;s schedule.
          </p>
          <Link
            href="/races"
            className="giq-button giq-button-carbon mt-4 min-h-10 w-fit px-4 text-[12px] font-semibold"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Review race cards
          </Link>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 border-b border-white/8 p-4 sm:border-r xl:border-b-0 last:border-r-0">
      <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">
        {label}
      </span>
      <strong className="mt-1 block truncate text-[17px] text-white">
        {value}
      </strong>
      <small className="block truncate text-[10px] text-white/40">
        {detail}
      </small>
    </div>
  );
}

function NextRace({ race }: { race: FeedRaceDayRace }) {
  const dogLabel = race.claimedDogs.map(({ name }) => name).join(", ");
  const trainerLabel = [
    ...new Set(
      race.claimedDogs
        .map(({ trainerName }) => trainerName)
        .filter((name): name is string => Boolean(name)),
    ),
  ].join(", ");

  return (
    <Link
      href={`/races/${race.id}`}
      aria-label={`Open ${dogLabel ? `${dogLabel} in ` : ""}${race.track} race ${race.raceNumber}`}
      className="flex min-h-16 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 transition hover:border-white/16 hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[hsl(var(--primary)/0.20)] text-[12px] font-bold text-[hsl(var(--primary-light))]">
        R{race.raceNumber}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] text-white">
          {dogLabel || race.track}
        </strong>
        {dogLabel ? (
          <small className="block truncate text-[10px] text-[hsl(var(--secondary-light))]">
            {race.track}
            {trainerLabel ? ` · Trainer ${trainerLabel}` : ""}
          </small>
        ) : null}
        <small className="mt-0.5 flex items-center gap-1 text-[10px] text-white/42">
          <Clock3 className="size-3" aria-hidden="true" />
          {formatRaceTime(race.raceTime)} · {race.distance}m ·{" "}
          {race.statusLabel}
        </small>
      </span>
    </Link>
  );
}
