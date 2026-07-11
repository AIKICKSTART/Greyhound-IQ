import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Database,
  Flag,
  MapPin,
  PlayCircle,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { getRaceExplorerData } from "@/lib/queries";
import {
  formatRaceDateInput,
  formatRaceDayLabel,
  formatRaceTime,
  formatShortRaceDayLabel,
} from "@/lib/race-time";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Racecards & Replays - GreyhoundIQ",
  description:
    "Live Australian greyhound racecards, historical meetings, runners, results, and embedded replay streams.",
};

type RacesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RaceExplorerData = Awaited<ReturnType<typeof getRaceExplorerData>>;
type RaceExplorerMeeting = RaceExplorerData["meetings"][number];
type RaceExplorerRace = RaceExplorerMeeting["races"][number];
type NextRaceItem = {
  meeting: RaceExplorerMeeting;
  race: RaceExplorerRace;
};
type RaceDateRailItem = { date: string; races: number | null };

const countFormatter = new Intl.NumberFormat("en-AU");
const statusOptions = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "resulted", label: "Results" },
  { value: "replay", label: "Replays" },
] as const;

export default async function RacesPage({ searchParams }: RacesPageProps) {
  const params = await searchParams;
  const data = await getRaceExplorerData({
    date: firstParam(params.date),
    state: firstParam(params.state),
    q: firstParam(params.q),
    status: firstParam(params.status),
    sort: firstParam(params.sort),
  });
  const summary = data.dateSummary;
  const selectedState = data.selectedState;
  const hasMeetings = data.meetings.length > 0;
  const now = new Date();
  const nextToGo = getNextToGo(data.meetings, now);
  const dateRail = buildDateRail(data.recentRaceDates, data.selectedDate);
  const activeDateForFilterLinks = data.isGlobalSearch
    ? null
    : data.dateInputValue
      ? data.selectedDate
      : null;

  return (
    <div className="giq-races-page">
      <main className="giq-race-control-page mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="giq-race-control-panel">
          <div className="giq-race-commandbar">
            <div className="giq-race-command-copy">
              <p className="program-label">Race day explorer</p>
              <h1 className="giq-race-command-title">
                Race control
                <span>
                  {data.isGlobalSearch
                    ? " / all dates"
                    : ` / ${formatRaceDayLabel(data.selectedDate)}`}
                  {selectedState ? ` / ${selectedState}` : ""}
                </span>
              </h1>
              <p className="giq-race-command-subtitle">
                Find the next race, jump to a track, or search the full
                historical archive from one race schedule.
              </p>
            </div>

            <form action="/races" className="giq-race-search-form">
              <label className="giq-race-search-field">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Search races</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={data.searchQuery ?? ""}
                  placeholder="Search track, runner, R4, 520m"
                  autoComplete="off"
                />
              </label>
              {data.dateInputValue && (
                <input type="hidden" name="date" value={data.dateInputValue} />
              )}
              {selectedState && <input type="hidden" name="state" value={selectedState} />}
              {data.selectedStatus !== "all" && (
                <input type="hidden" name="status" value={data.selectedStatus} />
              )}
              {data.selectedSort !== "time" && (
                <input type="hidden" name="sort" value={data.selectedSort} />
              )}
              <button type="submit" className="giq-button giq-button-primary">
                Search
              </button>
            </form>
          </div>

          <div className="giq-date-rail-row">
            {data.searchQuery && (
              <Link
                href={dateLink(
                  null,
                  selectedState,
                  data.searchQuery,
                  data.selectedStatus,
                  data.selectedSort
                )}
                className={`giq-date-chip giq-date-chip-global ${
                  data.isGlobalSearch ? "giq-date-chip-active" : ""
                }`}
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                All dates
              </Link>
            )}

            <div className="giq-date-rail" aria-label="Race dates">
              {dateRail.map((item) => {
                const active = !data.isGlobalSearch && item.date === data.selectedDate;
                return (
                  <Link
                    key={item.date}
                    href={dateLink(
                      item.date,
                      selectedState,
                      data.searchQuery,
                      data.selectedStatus,
                      data.selectedSort
                    )}
                    className={`giq-date-chip ${active ? "giq-date-chip-active" : ""}`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {dateChipLabel(item.date, now)}
                      {dateChipSubLabel(item.date, now) && (
                        <small>{dateChipSubLabel(item.date, now)}</small>
                      )}
                    </span>
                    {item.races !== null && (
                      <span className="giq-date-chip-count">{item.races}</span>
                    )}
                  </Link>
                );
              })}
            </div>

            <form action="/races" className="giq-date-jump">
              {data.searchQuery && <input type="hidden" name="q" value={data.searchQuery} />}
              {selectedState && <input type="hidden" name="state" value={selectedState} />}
              {data.selectedStatus !== "all" && (
                <input type="hidden" name="status" value={data.selectedStatus} />
              )}
              {data.selectedSort !== "time" && (
                <input type="hidden" name="sort" value={data.selectedSort} />
              )}
              <label>
                <span>More dates</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={data.dateInputValue}
                  aria-label="Choose race date"
                />
              </label>
              <button type="submit">Go</button>
            </form>
          </div>

          <div className="giq-filter-band">
            <FilterGroup label="State">
              <FilterChip
                href={dateLink(
                  activeDateForFilterLinks,
                  null,
                  data.searchQuery,
                  data.selectedStatus,
                  data.selectedSort
                )}
                active={!selectedState}
              >
                All
              </FilterChip>
              {data.states.map((state) => (
                <FilterChip
                  key={state}
                  href={dateLink(
                    activeDateForFilterLinks,
                    state,
                    data.searchQuery,
                    data.selectedStatus,
                    data.selectedSort
                  )}
                  active={selectedState === state}
                >
                  {state}
                </FilterChip>
              ))}
            </FilterGroup>

            <FilterGroup label="Status">
              {statusOptions.map((option) => (
                <FilterChip
                  key={option.value}
                  href={dateLink(
                    activeDateForFilterLinks,
                    selectedState,
                    data.searchQuery,
                    option.value,
                    data.selectedSort
                  )}
                  active={data.selectedStatus === option.value}
                >
                  {option.label}
                </FilterChip>
              ))}
            </FilterGroup>

            <form action="/races" className="giq-sort-form">
              {data.dateInputValue && (
                <input type="hidden" name="date" value={data.dateInputValue} />
              )}
              {data.searchQuery && <input type="hidden" name="q" value={data.searchQuery} />}
              {selectedState && <input type="hidden" name="state" value={selectedState} />}
              {data.selectedStatus !== "all" && (
                <input type="hidden" name="status" value={data.selectedStatus} />
              )}
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <label>
                <span className="sr-only">Sort races</span>
                <select name="sort" defaultValue={data.selectedSort}>
                  <option value="time">Race time</option>
                  <option value="relevance">Relevance</option>
                </select>
              </label>
              <button type="submit">Apply</button>
            </form>
          </div>
        </section>

        <NextToGoStrip items={nextToGo} now={now} />

        <section className="giq-races-main-grid">
          <div className="giq-races-meeting-column">
            <div className="giq-races-section-heading">
              <div>
                <p className="program-label">Meetings</p>
                <h2>
                  {hasMeetings
                    ? data.searchQuery
                      ? "Search results by track"
                      : "Racecards by track"
                    : "No racecards found"}
                </h2>
              </div>
              <p>
                {data.searchQuery
                  ? `Showing ${data.selectedSort === "relevance" ? "ranked" : "time-sorted"} matches for "${data.searchQuery}" across ${data.isGlobalSearch ? "all harvested race dates" : formatRaceDayLabel(data.selectedDate)}.`
                  : `${summary.meetings} meetings / ${summary.races} races on this schedule.`}
              </p>
            </div>

            {hasMeetings ? (
              <div className="giq-race-meetings-list">
                {data.meetings.map((meeting) => (
                  <RaceMeetingPanel key={meeting.id} meeting={meeting} now={now} />
                ))}
              </div>
            ) : (
              <div className="giq-empty-state p-12 text-center">
                <Database className="mx-auto h-8 w-8 text-[hsl(var(--primary-bright))]" />
                <p className="mt-4 text-[15px] text-[hsl(var(--muted-foreground))]">
                  No races match these filters. Try a broader search, a recent
                  date, or clear the state/status filter.
                </p>
              </div>
            )}
          </div>

          <aside className="giq-races-side-rail">
            <UpcomingQueue items={nextToGo} now={now} />
          </aside>
        </section>

        {data.replayRaces.length > 0 && (
          <section className="mt-10">
            <div className="giq-races-section-heading mb-4">
              <div>
                <p className="program-label">Replay library</p>
                <h2>Playable replays on this date</h2>
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
                  className="giq-panel giq-panel-hover group block p-4 hover:border-[hsl(var(--secondary)/0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[hsl(var(--secondary-light))] active:translate-y-[1px]"
                  aria-label={`Open replay for race ${race.raceNumber} at ${race.meeting.track.name}`}
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
                    {formatRaceTime(race.raceTime)}
                    {race.grade ? ` / ${race.grade}` : ""}
                  </p>
                  <div className="race-box-strip mt-5 opacity-80" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
      </main>
    </div>
  );
}

function NextToGoStrip({ items, now }: { items: NextRaceItem[]; now: Date }) {
  return (
    <section className="giq-next-to-go-section">
      <div className="giq-races-section-heading">
        <div>
          <p className="program-label">Next to go</p>
          <h2>Upcoming race queue</h2>
        </div>
        <p>{items.length > 0 ? "Live and upcoming races sorted by time." : "No live or upcoming races in this selection."}</p>
      </div>

      {items.length > 0 ? (
        <div className="giq-next-to-go-grid">
          {items.slice(0, 5).map(({ meeting, race }) => {
            const live = isRaceLive(race, now);
            return (
              <Link
                key={race.id}
                href={`/races/${race.id}`}
                className={`giq-next-race-card ${live ? "giq-next-race-card-live" : ""}`}
                aria-label={`Open ${meeting.track.name} race ${race.raceNumber} at ${formatRaceTime(race.raceTime)}`}
              >
                <span className="giq-next-race-countdown">
                  {formatCountdown(race, now)}
                  <small>{live ? "Now" : "To go"}</small>
                </span>
                <span className="giq-next-race-main">
                  <strong>R{race.raceNumber} {meeting.track.name}</strong>
                  <small>
                    {formatRaceTime(race.raceTime)} / {race.distance}m
                    {race.grade ? ` / ${race.grade}` : ""}
                  </small>
                </span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="giq-empty-state giq-next-empty">
          <Clock3 className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <span>Choose today or a future date to see the next race queue.</span>
        </div>
      )}
    </section>
  );
}

function RaceMeetingPanel({
  meeting,
  now,
}: {
  meeting: RaceExplorerMeeting;
  now: Date;
}) {
  const track = meeting.track;
  const firstRace = meeting.races[0];
  const featuredRace = meeting.races.find((race) => race.raceTime > now) ?? firstRace;
  const replayCount = meeting.races.filter(hasReplay).length;
  const status = meetingStatus(meeting, now);
  const distanceRange = meetingDistanceRange(meeting);

  return (
    <article className="giq-race-meeting-panel">
      <div className="giq-race-meeting-time" aria-hidden="true">
        <span>{firstRace ? formatRaceTime(firstRace.raceTime) : "--:--"}</span>
      </div>
      <div className="giq-race-meeting-body">
        <div className="giq-race-meeting-header">
          <div className="min-w-0">
            <Link
              href={`/tracks/${track.id}`}
              className="giq-meeting-track-link"
            >
              <h3>{track.name}</h3>
              <span>{track.state}</span>
            </Link>
            <div className="giq-meeting-summary">
              <span>
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {distanceRange}
              </span>
              <span>
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {meeting.races.length} races
              </span>
              <span>
                <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {replayCount} replays
              </span>
              <span className={`giq-meeting-state giq-meeting-state-${status.tone}`}>
                {status.label}
              </span>
            </div>
          </div>

          {featuredRace && (
            <Link
              href={`/races/${featuredRace.id}`}
              className="giq-meeting-open-action"
              aria-label={`Open ${track.name} race ${featuredRace.raceNumber} at ${formatRaceTime(featuredRace.raceTime)}`}
            >
              Open next
              <span>R{featuredRace.raceNumber}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="giq-race-row-list">
          {meeting.races.map((race) => (
            <RaceRowLink
              key={race.id}
              race={race}
              trackName={track.name}
              state={track.state}
              now={now}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function RaceRowLink({
  race,
  trackName,
  state,
  now,
}: {
  race: RaceExplorerRace;
  trackName: string;
  state: string;
  now: Date;
}) {
  const live = isRaceLive(race, now);
  const upcoming = race.raceTime > now;
  const replayReady = hasReplay(race);
  const statusLabel = live
    ? "Live"
    : upcoming
      ? "Upcoming"
      : replayReady
        ? "Replay"
        : "Resulted";

  return (
    <Link
      href={`/races/${race.id}`}
      className={`giq-race-row-card ${live ? "giq-race-row-live" : upcoming ? "giq-race-row-upcoming" : ""}`}
      aria-label={`Open ${trackName}, ${state} race ${race.raceNumber} at ${formatRaceTime(race.raceTime)}`}
    >
      <span className="giq-race-row-number">R{race.raceNumber}</span>
      <span className="giq-race-row-main">
        <strong>{formatRaceTime(race.raceTime)}</strong>
        <small>
          {race.distance}m{race.grade ? ` / ${race.grade}` : ""}
        </small>
      </span>
      <span className="giq-race-row-meta">
        <span>{race._count.runners} runners</span>
        <span className={replayReady ? "giq-race-row-replay" : ""}>
          {replayReady ? "Replay" : statusLabel}
        </span>
      </span>
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="giq-filter-group">
      <span>{label}</span>
      <div className="giq-filter-scroll">{children}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`giq-filter-chip ${active ? "giq-filter-chip-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function UpcomingQueue({ items, now }: { items: NextRaceItem[]; now: Date }) {
  return (
    <section className="giq-panel giq-upcoming-queue">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="program-label">Upcoming queue</p>
          <h2>Next 10 races</h2>
        </div>
        <Timer className="h-5 w-5 text-[hsl(var(--secondary-light))]" />
      </div>
      <div className="mt-4 grid gap-2">
        {items.slice(0, 10).map(({ meeting, race }) => (
          <Link
            key={race.id}
            href={`/races/${race.id}`}
            className="giq-upcoming-queue-item"
            aria-label={`Open ${meeting.track.name} race ${race.raceNumber}`}
          >
            <span>{formatCountdown(race, now)}</span>
            <strong>R{race.raceNumber} {meeting.track.name}</strong>
            <small>
              {formatRaceTime(race.raceTime)} / {race.distance}m
            </small>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ))}
        {items.length === 0 && (
          <p className="text-[13px] leading-5 text-[hsl(var(--muted-foreground))]">
            No upcoming races are available for the active filters.
          </p>
        )}
      </div>
    </section>
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

function getNextToGo(meetings: RaceExplorerMeeting[], now: Date): NextRaceItem[] {
  return meetings
    .flatMap((meeting) => meeting.races.map((race) => ({ meeting, race })))
    .filter(({ race }) => race.raceTime > now || isRaceLive(race, now))
    .sort((a, b) => a.race.raceTime.getTime() - b.race.raceTime.getTime());
}

function buildDateRail(
  recentRaceDates: { date: string; races: number }[],
  selectedDate: string
): RaceDateRailItem[] {
  const selected = recentRaceDates.find((item) => item.date === selectedDate) ?? {
    date: selectedDate,
    races: null,
  };
  const rail = [selected, ...recentRaceDates.filter((item) => item.date !== selectedDate)]
    .slice(0, 10);
  return rail;
}

function dateChipLabel(date: string, now: Date) {
  const today = formatRaceDateInput(now);
  const tomorrow = addInputDateDays(today, 1);
  if (date === today) return "Today";
  if (date === tomorrow) return "Tomorrow";
  return formatShortRaceDayLabel(date);
}

function dateChipSubLabel(date: string, now: Date) {
  const today = formatRaceDateInput(now);
  const tomorrow = addInputDateDays(today, 1);
  return date === today || date === tomorrow ? formatShortRaceDayLabel(date) : null;
}

function addInputDateDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function meetingDistanceRange(meeting: RaceExplorerMeeting) {
  const distances = [...new Set(meeting.races.map((race) => race.distance))].sort(
    (a, b) => a - b
  );
  if (distances.length === 0) return "No distances";
  if (distances.length === 1) return `${distances[0]}m`;
  return `${distances[0]}m - ${distances[distances.length - 1]}m`;
}

function meetingStatus(meeting: RaceExplorerMeeting, now: Date) {
  if (meeting.races.some((race) => isRaceLive(race, now))) {
    return { label: "Live", tone: "live" };
  }
  if (meeting.races.some((race) => race.raceTime > now)) {
    return { label: "Upcoming", tone: "upcoming" };
  }
  if (meeting.races.some(hasReplay)) {
    return { label: "Replay ready", tone: "replay" };
  }
  return { label: "Resulted", tone: "resulted" };
}

function isRaceLive(race: RaceExplorerRace, now: Date) {
  return (
    race.raceTime <= now &&
    now.getTime() - race.raceTime.getTime() < 20 * 60 * 1000
  );
}

function hasReplay(race: RaceExplorerRace) {
  return race.videos.some((video) => video.streamUrl);
}

function formatCountdown(race: RaceExplorerRace, now: Date) {
  if (isRaceLive(race, now)) return "Live";
  const diff = race.raceTime.getTime() - now.getTime();
  if (diff <= 0) return "Done";
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  return formatRaceTime(race.raceTime);
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function dateLink(
  date: string | null,
  state: string | null,
  q: string | null,
  status: string,
  sort: string
) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (state) params.set("state", state);
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (sort !== "time") params.set("sort", sort);
  return `/races?${params.toString()}`;
}

function formatCount(value: number | null | undefined) {
  return countFormatter.format(value ?? 0);
}
