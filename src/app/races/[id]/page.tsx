import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Activity,
  Clock,
  DollarSign,
  ExternalLink,
  MapPin,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { getRaceById } from "@/lib/queries";
import { RaceReplayPlayer } from "@/components/race-replay-player";
import { RunnerRow } from "@/components/runner-row";
import {
  absoluteTheDogsUrl,
  resolveTheDogsRaceReplay,
} from "@/lib/live/thedogs-replay";

export const dynamic = "force-dynamic";

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Australia/Sydney",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const race = await getRaceById(id);
  if (!race)
    return {
      title: "Race not found - GreyhoundIQ",
      description: "Race not found in the GreyhoundIQ database.",
    };
  return {
    title: `R${race.raceNumber} ${race.meeting.track.name} - ${race.distance}m | GreyhoundIQ`,
    description: `Race ${race.raceNumber} at ${race.meeting.track.name}, ${race.distance}m${race.grade ? ` (${race.grade})` : ""}. Full runner list, results, and replay video where available.`,
  };
}

export default async function RacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const race = await getRaceById(id);
  if (!race) notFound();

  const track = race.meeting.track;
  const streamVideo = race.videos.find((video) => video.streamUrl);
  const primaryVideo = streamVideo ?? race.videos[0] ?? null;
  const providerReplay = streamVideo
    ? null
    : await resolveProviderReplay({
        sourceProvider: race.sourceProvider,
        sourceId: race.sourceId,
        replayUrl: race.replayUrl,
      });
  const replayStreamUrl = streamVideo?.streamUrl ?? providerReplay?.streamUrl ?? null;
  const replayStreamContentType =
    streamVideo?.streamContentType ?? providerReplay?.streamContentType ?? null;
  const replayPageUrl = normaliseReplayPageUrl(
    primaryVideo?.pageUrl ?? race.replayUrl ?? providerReplay?.pageUrl ?? null,
    race.sourceProvider
  );
  const replayTitle = primaryVideo?.title ?? providerReplay?.title ?? race.name;
  const hasResults = race.runners.some((runner) => runner.result);
  const winner = race.runners.find(
    (runner) => runner.result?.finishingPosition === 1
  );
  const raceTimeLabel = timeFormatter.format(race.raceTime);

  return (
    <main className="fade-in mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px] tracking-[-0.013em] text-[hsl(220_7%_52%)]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {track.name}, {track.state}
          </span>
          <span className="text-white/[0.1]">/</span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {raceTimeLabel}
          </span>
          {race.prizeMoney && (
            <>
              <span className="text-white/[0.1]">/</span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                {race.prizeMoney.toLocaleString("en-AU")}
              </span>
            </>
          )}
          {replayStreamUrl && (
            <>
              <span className="text-white/[0.1]">/</span>
              <span className="flex items-center gap-1.5 text-[hsl(var(--secondary))]">
                <PlayCircle className="h-3.5 w-3.5" />
                Replay ready
              </span>
            </>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))] md:text-5xl">
          Race {race.raceNumber}
          <span className="text-[hsl(var(--muted-foreground))]">
            {" "}
            / {race.distance}m
            {race.grade && ` / ${race.grade}`}
          </span>
        </h1>
        {race.name && (
          <p className="mt-3 max-w-3xl text-[15px] leading-6 text-[hsl(215_14%_70%)]">
            {race.name}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
        <section className="space-y-5">
          {replayStreamUrl ? (
            <RaceReplayPlayer
              streamUrl={replayStreamUrl}
              streamContentType={replayStreamContentType}
              pageUrl={replayPageUrl}
              title={replayTitle}
              trackName={track.name}
              raceLabel={`Race ${race.raceNumber} / ${race.distance}m`}
              raceTimeLabel={raceTimeLabel}
            />
          ) : (
            <ReplayFallback
              replayPageUrl={replayPageUrl}
              hasVideoRecord={Boolean(primaryVideo || race.replayUrl || providerReplay)}
            />
          )}

          <section className="giq-racecard-section giq-table-shell overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="program-label">Racecard</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
                  Runners and results
                </h2>
              </div>
              <span className="giq-badge giq-badge-neutral">
                {race.runners.length} runners
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="giq-table-head">
                    <th className="w-14 p-3 text-center tracking-[0.04em]">
                      Box
                    </th>
                    <th className="p-3 text-left tracking-[0.04em]">
                      Runner
                    </th>
                    <th className="p-3 text-left tracking-[0.04em]">
                      Trainer
                    </th>
                    <th className="p-3 text-center tracking-[0.04em]">
                      Wgt
                    </th>
                    <th className="p-3 text-left tracking-[0.04em]">Form</th>
                    {hasResults && (
                      <th className="p-3 text-center tracking-[0.04em]">
                        Result
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {race.runners.map((runner) => (
                    <RunnerRow
                      key={runner.id}
                      runner={runner}
                      showResults={hasResults}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {race.runners.length === 0 && (
            <div className="giq-empty-state p-8 text-center">
              <p className="text-[14px] tracking-[-0.013em] text-[hsl(var(--muted-foreground))]">
                No runners loaded for this race yet.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <section className="giq-panel p-5">
            <p className="program-label">Race summary</p>
            <div className="mt-5 grid gap-3">
              <SummaryTile
                label="Track"
                value={`${track.name}, ${track.state}`}
                icon={<MapPin className="h-4 w-4" />}
              />
              <SummaryTile
                label="Start time"
                value={raceTimeLabel}
                icon={<Clock className="h-4 w-4" />}
              />
              <SummaryTile
                label="Replay"
                value={replayStreamUrl ? "Playable stream" : "Not playable yet"}
                icon={<PlayCircle className="h-4 w-4" />}
                tone={replayStreamUrl ? "gold" : "primary"}
              />
              <SummaryTile
                label="Results"
                value={hasResults ? "Resulted" : "Pending"}
                icon={<Activity className="h-4 w-4" />}
              />
            </div>
          </section>

          {winner?.result && (
            <section className="giq-panel p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg border border-[hsl(var(--secondary)/0.28)] bg-[hsl(var(--secondary)/0.12)] text-[hsl(var(--secondary))]">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <p className="program-label">Winner</p>
                  <Link
                    href={`/dogs/${winner.dog.id}`}
                    className="mt-1 block text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-light))]"
                  >
                    {winner.dog.name}
                  </Link>
                  <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                    Box {winner.boxNumber}
                    {winner.result.runningTime
                      ? ` / ${winner.result.runningTime.toFixed(2)}s`
                      : ""}
                    {winner.startingPrice
                      ? ` / $${winner.startingPrice.toFixed(2)}`
                      : ""}
                  </p>
                </div>
              </div>
            </section>
          )}

          {replayPageUrl && (
            <Link
              href={replayPageUrl}
              target="_blank"
              rel="noreferrer"
              className="giq-button giq-button-glass w-full px-4 text-[13px] font-semibold"
            >
              Open source replay page
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}

async function resolveProviderReplay({
  sourceProvider,
  sourceId,
  replayUrl,
}: {
  sourceProvider?: string | null;
  sourceId?: string | null;
  replayUrl?: string | null;
}) {
  if (sourceProvider !== "thedogs") return null;
  return resolveTheDogsRaceReplay({ sourceId, replayUrl });
}

function normaliseReplayPageUrl(value: string | null, sourceProvider?: string | null) {
  if (!value) return null;
  if (sourceProvider === "thedogs") return absoluteTheDogsUrl(value);
  return value;
}

function ReplayFallback({
  replayPageUrl,
  hasVideoRecord,
}: {
  replayPageUrl: string | null;
  hasVideoRecord: boolean;
}) {
  return (
    <section className="giq-panel p-6">
      <div className="giq-subpanel relative overflow-hidden p-8">
        <div className="track-rail-overlay absolute inset-0" />
        <div className="relative max-w-xl">
          <span className="giq-icon-plate grid h-14 w-14 place-items-center rounded-full">
            <PlayCircle className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            Replay stream not ready
          </h2>
          <p className="mt-2 text-sm leading-6 text-[hsl(215_14%_68%)]">
            {hasVideoRecord
              ? "A replay record exists, but a playable stream URL is not attached yet."
              : "This race does not have a replay record in the local archive yet."}
          </p>
          {replayPageUrl && (
            <a
              href={replayPageUrl}
              target="_blank"
              rel="noreferrer"
              className="giq-button giq-button-glass mt-5 px-4 text-[13px] font-semibold"
            >
              Open source page
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "primary" | "gold";
}) {
  return (
    <div className="giq-subpanel flex items-center gap-3 p-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
          tone === "gold"
            ? "border-[hsl(var(--secondary)/0.24)] bg-[hsl(var(--secondary)/0.10)] text-[hsl(var(--secondary))]"
            : "border-[hsl(var(--primary-bright)/0.22)] bg-[hsl(var(--primary)/0.10)] text-[hsl(var(--primary-light))]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
          {value}
        </span>
      </span>
    </div>
  );
}
