import Link from "next/link";
import { Filter, MapPin, Trophy } from "lucide-react";
import { RunnerRow } from "@/components/runner-row";
import {
  WebsitePageHeader,
  WebsiteSection,
} from "@/components/website-kit";
import { getRecentResults, getResultFilterOptions } from "@/lib/queries";
import { formatRaceDateTime, formatShortRaceDayLabel } from "@/lib/race-time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Recent Results - GreyhoundIQ",
  description:
    "Latest race results across Australian tracks. Tap a winner for full form and sectionals.",
};

type ResultEntry = {
  finishingPosition: number | null;
  runningTime: number | null;
  margin: number | null;
  prizeMoneyWon: number | null;
  splitTime: number | null;
};

type DisplayRunner = {
  id: string;
  boxNumber: number;
  weight: number | null;
  scratched: boolean;
  trainer: { name: string } | null;
  startingPrice: number | null;
  result: ResultEntry | null;
  dog: {
    id: string;
    name: string;
    colour: string | null;
    sex: string | null;
    trainer: { name: string } | null;
    formEntries: {
      finish: number | null;
      date: Date;
      trackId: string | null;
    }[];
  };
};

type DisplayRace = {
  id: string;
  raceNumber: number;
  title: string;
  grade: string | null;
  distance: number;
  raceTime: Date;
  meeting: {
    track: {
      name: string;
      state: string;
    };
  };
  runners: DisplayRunner[];
};

type ResultsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = await searchParams;
  const dateParam = firstParam(params.date);
  const trackParam = firstParam(params.trackId);
  const filterOptions = await getResultFilterOptions();
  const selectedDate = filterOptions.dates.some(
    (row) => row.date === dateParam
  )
    ? dateParam ?? ""
    : "";
  const selectedTrackId = filterOptions.tracks.some(
    (track) => track.id === trackParam
  )
    ? trackParam ?? ""
    : "";
  const results = await getRecentResults({
    date: selectedDate,
    trackId: selectedTrackId,
  });
  const displayResults = results.map(toDisplayRace);
  const settledCount = results.length;

  return (
    <div>
      <WebsitePageHeader
        eyebrow="Settled & official"
        title="Race"
        accent="Results"
        subtitle="Latest settled races from the GreyhoundIQ database, newest first."
      >
        <span className="giq-status-pill giq-status-pill-purple min-h-9">
          <span
            aria-hidden="true"
            className="pulse-glow h-1.5 w-1.5 rounded-full bg-[hsl(142_70%_55%)]"
          />
          {settledCount} races settled
        </span>
      </WebsitePageHeader>

      <WebsiteSection
        title="Latest results"
        sub={`${displayResults.length} races - newest first${selectedDate ? ` / ${formatShortRaceDayLabel(selectedDate)}` : ""}`}
        right={
          <ResultsFilters
            dates={filterOptions.dates}
            tracks={filterOptions.tracks}
            selectedDate={selectedDate}
            selectedTrackId={selectedTrackId}
          />
        }
      >
        {displayResults.length > 0 ? (
          <div className="giq-stagger flex flex-col gap-4">
            {displayResults.map((race) => (
              <ResultRaceCard key={race.id} race={race} />
            ))}
          </div>
        ) : (
          <div className="giq-empty-state p-10 text-center">
            <p className="text-[15px] text-[hsl(var(--muted-foreground))]">
              No settled race results are available yet. Run the live result sync
              or import archive results, then refresh this page.
            </p>
          </div>
        )}
      </WebsiteSection>
    </div>
  );
}

function ResultsFilters({
  dates,
  tracks,
  selectedDate,
  selectedTrackId,
}: {
  dates: { date: string; races: number }[];
  tracks: { id: string; name: string; state: string }[];
  selectedDate: string;
  selectedTrackId: string;
}) {
  return (
    <form action="/results" className="flex flex-wrap items-center gap-2.5">
      <select
        aria-label="Results date"
        className="giq-form-control min-h-11 min-w-[178px]"
        name="date"
        defaultValue={selectedDate}
      >
        <option value="">Latest results</option>
        {dates.map((row) => (
          <option key={row.date} value={row.date}>
            {formatShortRaceDayLabel(row.date)} / {row.races}
          </option>
        ))}
      </select>
      <select
        aria-label="Results track"
        className="giq-form-control min-h-11 min-w-[168px]"
        name="trackId"
        defaultValue={selectedTrackId}
      >
        <option value="">All tracks</option>
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.name}, {track.state}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="giq-button giq-button-carbon min-h-11 px-4 text-[13px] font-bold"
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
        Filter
      </button>
      {(selectedDate || selectedTrackId) && (
        <Link
          href="/results"
          className="giq-button giq-button-glass min-h-11 px-4 text-[13px] font-semibold"
        >
          Clear
        </Link>
      )}
    </form>
  );
}

function ResultRaceCard({ race }: { race: DisplayRace }) {
  const winner =
    race.runners.find((runner) => runner.result?.finishingPosition === 1) ??
    race.runners[0];
  const raceHref = `/races/${race.id}`;

  return (
    <article className="giq-result-race-card">
      <div className="giq-result-race-head">
        <div className="flex items-center gap-3">
          <Link href={raceHref} className="giq-result-race-number">
            R{race.raceNumber}
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="giq-h5 text-[15px]">{race.title}</h3>
              <span
                className={`giq-badge ${
                  race.grade === "Group 1" ? "giq-badge-gold" : "giq-badge-neutral"
                }`}
              >
                {race.grade ?? "Result"}
              </span>
            </div>
            <p className="giq-caption mt-1 flex flex-wrap items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {race.meeting.track.name}, {race.meeting.track.state}
              <span aria-hidden="true">-</span>
              {race.distance}m
              <span aria-hidden="true">-</span>
              {formatRaceDateTime(race.raceTime)}
            </p>
          </div>
        </div>

        {winner ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--secondary-light)/0.30)] bg-[hsl(var(--secondary)/0.14)] px-3 py-1.5 text-[12px] font-bold text-[hsl(var(--secondary-light))]">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            {winner.dog.name}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[660px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="giq-micro p-3 text-center">Box</th>
              <th className="giq-micro p-3 text-left">Dog</th>
              <th className="giq-micro p-3 text-left">Trainer</th>
              <th className="giq-micro p-3 text-center">Wgt</th>
              <th className="giq-micro p-3 text-left">Form</th>
              <th className="giq-micro p-3 text-center">Result</th>
            </tr>
          </thead>
          <tbody>
            {race.runners.map((runner) => (
              <RunnerRow key={runner.id} runner={runner} showResults />
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toDisplayRace(
  race: Awaited<ReturnType<typeof getRecentResults>>[number]
): DisplayRace {
  return {
    id: race.id,
    raceNumber: race.raceNumber,
    title: race.grade ?? `Race ${race.raceNumber}`,
    grade: race.grade,
    distance: race.distance,
    raceTime: race.raceTime,
    meeting: {
      track: {
        name: race.meeting.track.name,
        state: race.meeting.track.state,
      },
    },
    runners: race.runners.map((runner) => ({
      id: runner.id,
      boxNumber: runner.boxNumber,
      weight: runner.weight,
      scratched: runner.scratched,
      trainer: runner.trainer,
      startingPrice: runner.startingPrice,
      result: runner.result,
      dog: {
        id: runner.dog.id,
        name: runner.dog.name,
        colour: runner.dog.colour,
        sex: runner.dog.sex,
        trainer: runner.dog.trainer,
        formEntries: runner.dog.formEntries
          .filter((entry) => entry.raceId !== race.id)
          .slice(0, 6)
          .map((entry) => ({
            finish: entry.finish,
            date: entry.date,
            trackId: entry.trackId,
          })),
      },
    })),
  };
}
