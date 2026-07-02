import Link from "next/link";
import { Download, MapPin, Trophy } from "lucide-react";
import { RunnerRow } from "@/components/runner-row";
import {
  WebsitePageHeader,
  WebsiteSection,
} from "@/components/website-kit";
import { getRecentResults } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Recent Results - GreyhoundIQ",
  description:
    "Race results from the past 48 hours across every Australian track. Tap a winner for full form and sectionals.",
};

type ResultEntry = {
  finishingPosition: number | null;
  runningTime: number | null;
  margin: number | null;
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

const SAMPLE_RESULTS = [
  {
    id: "sample-wentworth-cup",
    track: "Wentworth Park",
    state: "NSW",
    raceNo: 5,
    race: "The Wentworth Cup",
    dist: 520,
    grade: "Group 1",
    time: "2026-07-12T19:42:00+10:00",
    runners: [
      {
        boxNumber: 1,
        name: "Zipping Garth",
        trainer: "R. Britton",
        weight: 33.5,
        form: "11231",
        result: { finishingPosition: 1, runningTime: 29.84 },
      },
      {
        boxNumber: 4,
        name: "Aston Rupee",
        trainer: "J. Thompson",
        weight: 34.1,
        form: "21123",
        result: { finishingPosition: 2, runningTime: 29.98 },
      },
      {
        boxNumber: 6,
        name: "Paua To Burn",
        trainer: "R. Camilleri",
        weight: 26.4,
        form: "13221",
        result: { finishingPosition: 3, runningTime: 30.05 },
      },
      {
        boxNumber: 3,
        name: "Wow Shes Fast",
        trainer: "K. Gorman",
        weight: 27.9,
        form: "31514",
        result: { finishingPosition: 4, runningTime: 30.19 },
      },
    ],
  },
  {
    id: "sample-free-for-all",
    track: "The Meadows",
    state: "VIC",
    raceNo: 8,
    race: "Free For All",
    dist: 525,
    grade: "Grade 5",
    time: "2026-07-12T20:07:00+10:00",
    runners: [
      {
        boxNumber: 2,
        name: "Sennachie",
        trainer: "J. Formosa",
        weight: 34.8,
        form: "24312",
        result: { finishingPosition: 1, runningTime: 30.11 },
      },
      {
        boxNumber: 5,
        name: "Tommy Shelby",
        trainer: "A. Dailly",
        weight: 35.2,
        form: "51342",
        result: { finishingPosition: 2, runningTime: 30.22 },
      },
      {
        boxNumber: 7,
        name: "Simon Told Me",
        trainer: "G. Selkrig",
        weight: 33.9,
        form: "44536",
        result: { finishingPosition: 3, runningTime: 30.4 },
      },
    ],
  },
  {
    id: "sample-maiden-stake",
    track: "Angle Park",
    state: "SA",
    raceNo: 3,
    race: "Maiden Stake",
    dist: 395,
    grade: "Maiden",
    time: "2026-07-12T20:31:00+10:00",
    runners: [
      {
        boxNumber: 6,
        name: "Midnight Zoom",
        trainer: "T. Rasmussen",
        weight: 28.7,
        form: "42311",
        result: { finishingPosition: 1, runningTime: 22.41 },
      },
      {
        boxNumber: 1,
        name: "Bandit's Boy",
        trainer: "M. Delbridge",
        weight: 33,
        form: "23145",
        result: { finishingPosition: 2, runningTime: 22.55 },
      },
      {
        boxNumber: 8,
        name: "Late Mail Judy",
        trainer: "L. Cole",
        weight: 26.4,
        form: "55321",
        result: { finishingPosition: 3, runningTime: 22.68 },
      },
    ],
  },
] as const;

export default async function ResultsPage() {
  const results = await getRecentResults(2);
  const displayResults =
    results.length > 0 ? results.map(toDisplayRace) : SAMPLE_RESULTS.map(toSampleRace);
  const settledCount = results.length > 0 ? results.length : 24;

  return (
    <div className="giq-screen-enter">
      <WebsitePageHeader
        eyebrow="Settled & official"
        title="Race"
        accent="Results"
        subtitle="Every finish, split and sectional from today's national meetings - official within minutes of the last dog crossing the line."
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
        sub={`${displayResults.length} meetings - newest first`}
        right={<ResultsFilters />}
      >
        <div className="flex flex-col gap-4">
          {displayResults.map((race) => (
            <ResultRaceCard key={race.id} race={race} />
          ))}
        </div>
      </WebsiteSection>
    </div>
  );
}

function ResultsFilters() {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <select
        aria-label="Results date"
        className="giq-form-control min-h-11 min-w-[178px]"
        defaultValue="Today"
      >
        <option>Today</option>
        <option>Yesterday</option>
        <option>Past 48 hours</option>
      </select>
      <select
        aria-label="Results track"
        className="giq-form-control min-h-11 min-w-[168px]"
        defaultValue="All tracks"
      >
        <option>All tracks</option>
        <option>Wentworth Park</option>
        <option>The Meadows</option>
        <option>Angle Park</option>
      </select>
      <button
        type="button"
        className="giq-button giq-button-carbon min-h-11 px-4 text-[13px] font-bold"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export
      </button>
    </div>
  );
}

function ResultRaceCard({ race }: { race: DisplayRace }) {
  const winner =
    race.runners.find((runner) => runner.result?.finishingPosition === 1) ??
    race.runners[0];
  const raceHref = race.id.startsWith("sample-") ? "/races" : `/races/${race.id}`;

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
              {formatRaceTime(race.raceTime)}
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
      trainer: null,
      startingPrice: null,
      result: runner.result,
      dog: {
        id: runner.dog.id,
        name: runner.dog.name,
        colour: runner.dog.colour,
        sex: runner.dog.sex,
        trainer: null,
        formEntries: [],
      },
    })),
  };
}

function toSampleRace(sample: (typeof SAMPLE_RESULTS)[number]): DisplayRace {
  return {
    id: sample.id,
    raceNumber: sample.raceNo,
    title: sample.race,
    grade: sample.grade,
    distance: sample.dist,
    raceTime: new Date(sample.time),
    meeting: { track: { name: sample.track, state: sample.state } },
    runners: sample.runners.map((runner, index) => ({
      id: `${sample.id}-${runner.boxNumber}`,
      boxNumber: runner.boxNumber,
      weight: runner.weight,
      scratched: false,
      trainer: { name: runner.trainer },
      startingPrice: null,
      result: {
        ...runner.result,
        margin: null,
        splitTime: null,
      },
      dog: {
        id: `${sample.id}-dog-${index}`,
        name: runner.name,
        colour: "Black",
        sex: null,
        trainer: null,
        formEntries: runner.form.split("").map((finish, formIndex) => ({
          finish: Number(finish),
          date: new Date(Date.UTC(2026, 6, 1 - formIndex)),
          trackId: null,
        })),
      },
    })),
  };
}

function formatRaceTime(date: Date) {
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}
