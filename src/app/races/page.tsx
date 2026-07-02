import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Database,
  Flag,
  PlayCircle,
  Radio,
  Search,
  ShieldCheck,
} from "lucide-react";
import { getRaceExplorerData } from "@/lib/queries";
import { getLiveFeedStatus } from "@/lib/live/status";
import { MeetingCard } from "@/components/meeting-card";
import { PageHero } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Racecards & Replays - GreyhoundIQ",
  description:
    "Live Australian greyhound racecards, historical meetings, runners, results, and embedded replay streams.",
};

type RacesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const countFormatter = new Intl.NumberFormat("en-AU");
const raceDateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Sydney",
});
const raceTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Australia/Sydney",
});

export default async function RacesPage({ searchParams }: RacesPageProps) {
  const params = await searchParams;
  const [data, liveStatus] = await Promise.all([
    getRaceExplorerData({
      date: firstParam(params.date),
      state: firstParam(params.state),
    }),
    getLiveFeedStatus(),
  ]);
  const summary = data.dateSummary;
  const selectedState = data.selectedState;
  const hasMeetings = data.meetings.length > 0;

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        badge="RACE CONTROL"
        badgeIcon={<Flag className="h-3 w-3 text-[hsl(var(--primary-bright))]" />}
        badgeColor="primary"
        title={
          <>
            Live racecards.
            <br />
            <span className="gradient-text">Replay ready.</span>
          </>
        }
        subtitle={`${formatCount(data.datasetStats.races)} races, ${formatCount(
          data.datasetStats.runners
        )} runners, and ${formatCount(
          data.datasetStats.videosWithStream
        )} embedded replay streams from the GreyhoundIQ database.`}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={dateLink(data.selectedDate, selectedState)}
            className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
          >
            <Radio className="h-4 w-4" />
            Current race day
          </Link>
          {data.replayRaces[0] && (
            <Link
              href={`/races/${data.replayRaces[0].id}`}
              className="giq-button giq-button-gold px-5 text-[13px] font-semibold"
            >
              <PlayCircle className="h-4 w-4" />
              Watch latest replay
            </Link>
          )}
        </div>
      </PageHero>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="giq-panel p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <p className="program-label">Race day explorer</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
                  {formatDate(data.selectedDate)}
                  {selectedState ? (
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {" "}
                      / {selectedState}
                    </span>
                  ) : null}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  Browse real harvested racecards by date and state. Replay
                  badges mark races with playable streams.
                </p>
              </div>

              <form
                action="/races"
                className="grid w-full gap-3 sm:grid-cols-[minmax(160px,1fr)_minmax(150px,1fr)_132px] xl:w-[560px] xl:flex-none"
              >
                <label className="grid gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
                    Date
                  </span>
                  <input
                    type="date"
                    name="date"
                    defaultValue={data.selectedDate}
                    className="giq-form-control min-h-11 px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
                    State
                  </span>
                  <select
                    name="state"
                    defaultValue={selectedState ?? ""}
                    className="giq-form-control min-h-11 px-3 text-sm"
                  >
                    <option value="">All states</option>
                    {data.states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="giq-button giq-button-primary min-h-11 w-full px-5 text-[13px] font-semibold whitespace-nowrap sm:mt-5 sm:w-auto"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </form>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {data.recentRaceDates.map((item) => {
                const active = item.date === data.selectedDate;
                return (
                  <Link
                    key={item.date}
                    href={dateLink(item.date, selectedState)}
                    className={`giq-outline-action min-h-10 px-3 text-[12px] ${
                      active
                        ? "border-[hsl(var(--primary-light)/0.46)] bg-[hsl(var(--primary)/0.26)] text-white"
                        : ""
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {shortDate(item.date)}
                    <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                      {item.races}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <LiveStatusPanel liveStatus={liveStatus} />
        </section>

        <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard
            label="Meetings"
            value={summary.meetings}
            icon={<Flag className="h-4 w-4" />}
          />
          <MetricCard
            label="Races"
            value={summary.races}
            icon={<CalendarDays className="h-4 w-4" />}
          />
          <MetricCard
            label="Runners"
            value={summary.runners}
            icon={<Activity className="h-4 w-4" />}
          />
          <MetricCard
            label="Results"
            value={summary.results}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <MetricCard
            label="Videos"
            value={summary.videos}
            icon={<PlayCircle className="h-4 w-4" />}
          />
          <MetricCard
            label="Playable"
            value={summary.videosWithStream}
            icon={<Radio className="h-4 w-4" />}
            tone="gold"
          />
        </section>

        {data.replayRaces.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="program-label">Replay library</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
                  Playable replays on this date
                </h2>
              </div>
              <span className="giq-badge giq-badge-neutral hidden sm:inline-flex">
                {formatCount(data.replayRaces.length)} shown
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.replayRaces.map((race) => (
                <Link
                  key={race.id}
                  href={`/races/${race.id}`}
                  className="giq-panel giq-panel-hover group p-4 hover:border-[hsl(var(--secondary)/0.34)]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--secondary))]">
                        Replay ready
                      </p>
                      <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
                        R{race.raceNumber} / {race.distance}m
                      </h3>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--secondary)/0.35)] bg-[hsl(var(--secondary)/0.16)] text-[hsl(var(--secondary-light))] transition-transform group-hover:scale-105">
                      <PlayCircle className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                    {race.meeting.track.name}, {race.meeting.track.state}
                  </p>
                  <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                    {formatTime(race.raceTime)}
                    {race.grade ? ` / ${race.grade}` : ""}
                  </p>
                  <div className="race-box-strip mt-5 opacity-80" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="program-label">Meetings</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
                {hasMeetings ? "Racecards by track" : "No racecards found"}
              </h2>
            </div>
            <p className="max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
              The card data below comes from the local Postgres/Supabase data
              model, including runners and replay availability.
            </p>
          </div>

          {hasMeetings ? (
            <div className="giq-stagger grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <div className="giq-empty-state p-12 text-center">
              <Database className="mx-auto h-8 w-8 text-[hsl(var(--primary-bright))]" />
              <p className="mt-4 text-[15px] text-[hsl(var(--muted-foreground))]">
                No meetings match this date and state. Try one of the recent
                dates above or clear the state filter.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LiveStatusPanel({
  liveStatus,
}: {
  liveStatus: Awaited<ReturnType<typeof getLiveFeedStatus>>;
}) {
  const configured = liveStatus.status === "configured";

  return (
    <aside className="giq-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="program-label">Live feed</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            {configured ? "Configured" : "Waiting for credentials"}
          </h2>
        </div>
        <span
          className={`grid h-11 w-11 place-items-center rounded-full border ${
            configured
              ? "border-[hsl(var(--primary-light)/0.34)] bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--primary-light))]"
              : "border-[hsl(var(--secondary)/0.34)] bg-[hsl(var(--secondary)/0.12)] text-[hsl(var(--secondary))]"
          }`}
        >
          <Radio className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 grid gap-2">
        <StatusRow label="Provider" value={liveStatus.activeProvider ?? "none"} />
        <StatusRow
          label="Sync cadence"
          value={liveStatus.scheduler.primarySchedule}
        />
        <StatusRow
          label="Upcoming races"
          value={formatCount(liveStatus.data.upcomingRaces)}
        />
        <StatusRow
          label="Latest race"
          value={
            liveStatus.data.latestRaceTime
              ? formatDateTime(new Date(liveStatus.data.latestRaceTime))
              : "None"
          }
        />
      </div>

      {liveStatus.blockers.length > 0 && (
        <div className="mt-4 rounded-lg border border-[hsl(var(--secondary)/0.18)] bg-[hsl(var(--secondary)/0.08)] p-3 text-[12px] text-[hsl(var(--secondary-light))]">
          {liveStatus.blockers.join(", ")}
        </div>
      )}
    </aside>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: number | null;
  icon: ReactNode;
  tone?: "primary" | "gold";
}) {
  return (
    <div className="giq-metric-card">
      <div
        className={`mb-4 inline-grid h-9 w-9 place-items-center rounded-lg border ${
          tone === "gold"
            ? "border-[hsl(var(--secondary)/0.24)] bg-[hsl(var(--secondary)/0.10)] text-[hsl(var(--secondary))]"
            : "border-[hsl(var(--primary-bright)/0.22)] bg-[hsl(var(--primary)/0.10)] text-[hsl(var(--primary-light))]"
        }`}
      >
        {icon}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
        {formatCount(value)}
      </p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="giq-subpanel flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-[12px] text-[hsl(var(--subtle-foreground))]">{label}</span>
      <span className="text-right text-[12px] font-semibold text-[hsl(var(--foreground))]">
        {value}
      </span>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function dateLink(date: string, state: string | null) {
  const params = new URLSearchParams({ date });
  if (state) params.set("state", state);
  return `/races?${params.toString()}`;
}

function formatCount(value: number | null | undefined) {
  return countFormatter.format(value ?? 0);
}

function formatDate(date: string) {
  return raceDateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Sydney",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatTime(date: Date) {
  return raceTimeFormatter.format(date);
}

function formatDateTime(date: Date) {
  return `${raceDateFormatter.format(date)} ${raceTimeFormatter.format(date)}`;
}
