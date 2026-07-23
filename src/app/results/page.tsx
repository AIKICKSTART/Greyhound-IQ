import Link from "next/link";
import { MapPin, Search, Trophy } from "lucide-react";
import { RunnerRow } from "@/components/runner-row";
import {
  WebsitePageHeader,
  WebsiteSection,
} from "@/components/website-kit";
import {
  getRecentResults,
  getResultFilterOptions,
  type ResultsSort,
} from "@/lib/queries";
import {
  formatRaceDateTime,
  formatShortRaceDayLabel,
  normaliseRaceDateInput,
} from "@/lib/race-time";
import { orderRunners } from "@/lib/runner-order";
import {
  resolveRunnerTrainerName,
  resolveRunnerWeight,
} from "@/lib/live/runner-display";

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
  const selectedQuery = normaliseResultsQuery(firstParam(params.q));
  const selectedSort = resultsSort(firstParam(params.sort));
  const filterOptions = await getResultFilterOptions();
  const selectedDate = normaliseRaceDateInput(dateParam) ?? "";
  const selectedTrackId = filterOptions.tracks.some(
    (track) => track.id === trackParam
  )
    ? trackParam ?? ""
    : "";
  const results = await getRecentResults({
    date: selectedDate,
    trackId: selectedTrackId,
    query: selectedQuery,
    sort: selectedSort,
  });
  const displayResults = results.map(toDisplayRace);
  const settledCount = results.length;

  return (
    <div>
      <WebsitePageHeader
        eyebrow="Settled & official"
        title="Race"
        accent="Results"
        subtitle="Settled races from the GreyhoundIQ database with official results."
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
        title="Results"
        sub={`${displayResults.length} races - ${sortLabel(selectedSort)}${selectedDate ? ` / ${formatShortRaceDayLabel(selectedDate)}` : ""}${selectedQuery ? ` / "${selectedQuery}"` : ""}`}
        right={
          <ResultsFilters
            tracks={filterOptions.tracks}
            selectedDate={selectedDate}
            selectedTrackId={selectedTrackId}
            selectedQuery={selectedQuery}
            selectedSort={selectedSort}
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
  tracks,
  selectedDate,
  selectedTrackId,
  selectedQuery,
  selectedSort,
}: {
  tracks: { id: string; name: string; state: string }[];
  selectedDate: string;
  selectedTrackId: string;
  selectedQuery: string;
  selectedSort: ResultsSort;
}) {
  return (
    <form
      action="/results"
      className="grid w-full gap-2.5 sm:grid-cols-2 xl:w-auto xl:grid-cols-[minmax(240px,320px)_150px_170px_150px_auto]"
    >
      <label className="sr-only" htmlFor="results-query">
        Search results
      </label>
      <input
        id="results-query"
        className="giq-form-control min-h-11 px-3.5"
        name="q"
        type="search"
        maxLength={80}
        defaultValue={selectedQuery}
        placeholder="Track, race, dog or grade"
      />
      <label className="sr-only" htmlFor="results-date">
        Results date
      </label>
      <input
        id="results-date"
        aria-label="Results date"
        className="giq-form-control min-h-11 px-3.5"
        name="date"
        type="date"
        defaultValue={selectedDate}
      />
      <label className="sr-only" htmlFor="results-track">
        Results track
      </label>
      <select
        id="results-track"
        aria-label="Results track"
        className="giq-form-control min-h-11 pl-3.5"
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
      <label className="sr-only" htmlFor="results-sort">
        Results order
      </label>
      <select
        id="results-sort"
        aria-label="Results order"
        className="giq-form-control min-h-11 pl-3.5"
        name="sort"
        defaultValue={selectedSort}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="track">Track A-Z</option>
      </select>
      <button
        type="submit"
        className="giq-button giq-button-carbon min-h-11 px-4 text-[13px] font-bold sm:w-fit"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        Search
      </button>
      {(selectedQuery ||
        selectedDate ||
        selectedTrackId ||
        selectedSort !== "newest") && (
        <Link
          href="/results"
          className="giq-button giq-button-glass min-h-11 px-4 text-[13px] font-semibold sm:w-fit xl:col-start-5"
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

function normaliseResultsQuery(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
}

function resultsSort(value: string | undefined): ResultsSort {
  return value === "oldest" || value === "track" ? value : "newest";
}

function sortLabel(sort: ResultsSort) {
  if (sort === "oldest") return "oldest first";
  if (sort === "track") return "track A-Z";
  return "newest first";
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
    runners: orderRunners(race.runners, "finish").map((runner) => {
      const trainerName = resolveRunnerTrainerName({
        runnerTrainerName: runner.trainer?.name,
        dogTrainerName: runner.dog.trainer?.name,
        sourceRawJson: runner.sourceRawJson,
      });
      const weight = resolveRunnerWeight({
        runnerWeight: runner.weight,
        formWeight: runner.dog.formEntries.find(
          (entry) => entry.raceId === race.id,
        )?.weight,
        sourceRawJson: runner.sourceRawJson,
      });
      return {
        id: runner.id,
        boxNumber: runner.boxNumber,
        weight,
        scratched: runner.scratched,
        trainer: trainerName ? { name: trainerName } : null,
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
      };
    }),
  };
}
