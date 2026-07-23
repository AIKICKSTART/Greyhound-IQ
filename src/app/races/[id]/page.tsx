import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Activity,
  Clock,
  DollarSign,
  MapPin,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { resolveDemoProviderRouteId } from "@/lib/demo-route-samples";
import { safePhotoFinishSrc } from "@/lib/csp";
import { getPreviousRaceVideoRunners, getRaceById } from "@/lib/queries";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { PageTitle } from "@/components/page-title";
import { RaceMeetingNavigation } from "@/components/race-meeting-navigation";
import { RacingDataDisclosure } from "@/components/racing-data-disclosure";
import { RunnerRow } from "@/components/runner-row";
import { RaceReplayPlayer } from "@/components/race-replay-player";
import type { ResolvedRaceReplay } from "@/lib/live/race-replay";
import {
  embedUrlFromReplayPage,
  officialRaceReplayUrl,
  resolveProviderRaceReplay,
  resolveRaceVideoReplay,
} from "@/lib/live/race-replay";
import { proxiedStreamPath } from "@/lib/live/replay-proxy";
import {
  buildRaceDetailHref,
  buildRaceListReturnHref,
  normaliseRaceListContext,
  parseRaceListContext,
  resolveMeetingRaceNavigation,
} from "@/lib/race-navigation";
import { formatRaceDateInput, formatRaceDetailTime } from "@/lib/race-time";
import {
  getRacePresentationStatus,
  normaliseRaceSourceStatus,
  raceSchemaEventStatus,
} from "@/lib/race-status";
import { orderRunners } from "@/lib/runner-order";

export const dynamic = "force-dynamic";

const MAX_PREVIOUS_RACE_VIDEO_RESOLVES = 2;

type RaceDetail = NonNullable<Awaited<ReturnType<typeof getRaceById>>>;
type PreviousRaceVideoRunner = Awaited<
  ReturnType<typeof getPreviousRaceVideoRunners>
>[number];

type PreviousRaceVideoCandidate = {
  id: string;
  pageUrl: string;
  sourceProvider: string;
  sourceId: string;
  embedSourceType?: string | null;
  dogNames: string[];
  date: Date;
  trackName: string;
  raceLabel: string;
  raceName: string | null;
  finishText: string | null;
  runningTime: number | null;
  winnerTime: number | null;
  title: string | null;
  localReplay: ResolvedRaceReplay | null;
};

type ResolvedPreviousRaceVideo = PreviousRaceVideoCandidate & {
  replay: ResolvedRaceReplay | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = await params;
  const id = await resolveDemoProviderRouteId("race", routeId);
  const race = await getRaceById(id);
  if (!race)
    return {
      title: "Race not found - GreyhoundIQ",
      description: "Race not found in the GreyhoundIQ database.",
    };
  const title = `${race.meeting.track.name} Race ${race.raceNumber} (${race.distance}m) | GreyhoundIQ`;
  const description = `Race ${race.raceNumber} at ${race.meeting.track.name}, ${race.distance}m${race.grade ? ` (${race.grade})` : ""}. Full runner list, results, and replay video where available.`;
  return {
    title,
    description,
    alternates: { canonical: `/races/${id}` },
    openGraph: {
      title,
      description,
      url: `/races/${id}`,
      type: "website",
    },
  };
}

export default async function RacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id: routeId }, detailSearchParams] = await Promise.all([params, searchParams]);
  const id = await resolveDemoProviderRouteId("race", routeId);
  const race = await getRaceById(id);
  if (!race) notFound();

  const track = race.meeting.track;
  const meetingRaceNavigation = resolveMeetingRaceNavigation(
    race.meeting.races,
    race.id,
  );
  const listContext =
    parseRaceListContext(detailSearchParams) ??
    normaliseRaceListContext({
      date: formatRaceDateInput(race.meeting.meetingDate),
      state: track.state,
      meetingId: race.meeting.id,
    });
  const previousRaceTarget = meetingRaceNavigation.previous
    ? {
        ...meetingRaceNavigation.previous,
        href: buildRaceDetailHref(meetingRaceNavigation.previous.id, listContext),
      }
    : null;
  const nextRaceTarget = meetingRaceNavigation.next
    ? {
        ...meetingRaceNavigation.next,
        href: buildRaceDetailHref(meetingRaceNavigation.next.id, listContext),
      }
    : null;
  const replayCandidates = race.videos
    .map((video) => ({ video, officialUrl: officialRaceReplayUrl(video) }))
    .filter((candidate) => candidate.officialUrl);
  const orderedVideos = [...race.videos].sort(
    (left, right) =>
      Number(Boolean(right.streamUrl)) - Number(Boolean(left.streamUrl)) ||
      Number(Boolean(embedUrlFromReplayPage(right.pageUrl)?.embedUrl)) -
        Number(Boolean(embedUrlFromReplayPage(left.pageUrl)?.embedUrl))
  );
  let primaryVideo = orderedVideos[0] ?? null;
  let storedReplay: ResolvedRaceReplay | null = null;
  for (const video of orderedVideos) {
    const resolved = await resolveRaceVideoReplay(video);
    if (resolved?.streamUrl || resolved?.embedUrl) {
      primaryVideo = video;
      storedReplay = resolved;
      break;
    }
  }
  const replayOfficialUrl =
    (primaryVideo ? officialRaceReplayUrl(primaryVideo) : null) ??
    replayCandidates[0]?.officialUrl ??
    officialRaceReplayUrl({
      sourceProvider: race.sourceProvider,
      pageUrl: race.replayUrl,
      sourceStatus: null,
    });
  // Resolve each stored record in playable-first order, then fall back to the
  // race-level provider fields. The official URL remains the outbound source.
  const providerReplay =
    storedReplay?.streamUrl || storedReplay?.embedUrl
      ? null
      : await resolveProviderRaceReplay({
          sourceProvider: race.sourceProvider,
          sourceId: race.sourceId,
          replayUrl: race.replayUrl,
        });
  // Proxy the provider stream through our own origin so the browser never sees
  // the source host. Unknown hosts return null and fall through to embed/none.
  const replayStreamUrl = proxiedStreamPath(
    storedReplay?.streamUrl ?? providerReplay?.streamUrl ?? null
  );
  const replayStreamContentType =
    storedReplay?.streamContentType ?? providerReplay?.streamContentType ?? null;
  const replayEmbedUrl = replayStreamUrl
    ? null
    : storedReplay?.embedUrl ??
      providerReplay?.embedUrl ??
      embedUrlFromReplayPage(replayOfficialUrl)?.embedUrl ??
      null;
  const replayTitle =
    storedReplay?.title ??
    providerReplay?.title ??
    primaryVideo?.title ??
    race.name;
  const hasPlayableReplay = Boolean(replayStreamUrl || replayEmbedUrl);
  const hasOfficialReplaySource = Boolean(replayOfficialUrl);
  const photoFinishSrc = safePhotoFinishSrc(race.photoFinishUrl);
  const resultCount = race.runners.filter((runner) => runner.result).length;
  const activeRunnerCount = race.runners.filter((runner) => !runner.scratched).length;
  const expectedResultCount = activeRunnerCount || race.runners.length;
  const hasResults = resultCount > 0;
  const sourceRaceStatus = normaliseRaceSourceStatus(race.resultStatus);
  const racePresentationStatus = getRacePresentationStatus({
    resultStatus: race.resultStatus,
    raceTime: race.raceTime,
    now: new Date(),
    hasResults,
    hasReplay: hasPlayableReplay || hasOfficialReplaySource,
  });
  const resultStatusLabel =
    resultCount === 0
      ? sourceRaceStatus === "abandoned"
        ? "Not run - abandoned"
        : sourceRaceStatus === "postponed"
          ? "Pending - postponed"
          : "Pending"
      : resultCount < expectedResultCount
        ? `Partial ${resultCount}/${expectedResultCount}`
        : "Resulted";
  const orderedRunners = orderRunners(race.runners, hasResults ? "finish" : "box");
  const winner = orderedRunners.find(
    (runner) => runner.result?.finishingPosition === 1
  );
  const raceTimeLabel = formatRaceDetailTime(race.raceTime);
  const previousVideoRunners = await getPreviousRaceVideoRunners(race.id);
  const previousRaceVideos = await resolvePreviousRaceVideos(
    collectPreviousRaceVideoCandidates(race, previousVideoRunners)
  );

  const raceEventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `https://greyhoundsiq.com.au/races/${race.id}`,
    name: race.name || `${track.name} Race ${race.raceNumber} (${race.distance}m)`,
    url: `https://greyhoundsiq.com.au/races/${race.id}`,
    sport: "Greyhound racing",
    startDate: race.raceTime.toISOString(),
    eventStatus: raceSchemaEventStatus(race.resultStatus),
    location: {
      "@type": "SportsActivityLocation",
      name: track.name,
      address: {
        "@type": "PostalAddress",
        addressRegion: track.state,
        addressCountry: "AU",
      },
    },
    competitor: race.runners
      .filter((runner) => !runner.scratched)
      .map((runner) => ({ "@type": "Person", name: runner.dog.name })),
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Racecards", path: "/races" },
            {
              name: `${track.name} R${race.raceNumber}`,
              path: `/races/${race.id}`,
            },
          ]),
          raceEventSchema,
        ]}
      />
      <RacingDataDisclosure className="mb-6" />
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
          {race.prizeMoney !== null && (
            <>
              <span className="text-white/[0.1]">/</span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                {race.prizeMoney.toLocaleString("en-AU")}
              </span>
            </>
          )}
          {(hasPlayableReplay || hasOfficialReplaySource) && (
            <>
              <span className="text-white/[0.1]">/</span>
              <span className="flex items-center gap-1.5 text-[hsl(var(--secondary))]">
                <PlayCircle className="h-3.5 w-3.5" />
                {hasPlayableReplay ? "Replay ready" : "Replay source ready"}
              </span>
            </>
          )}
          <span className="text-white/[0.1]">/</span>
          <span
            className={`giq-detail-race-status giq-detail-race-status-${racePresentationStatus.key}`}
            data-race-status={racePresentationStatus.key}
          >
            <Activity className="h-3.5 w-3.5" />
            {racePresentationStatus.label}
          </span>
        </div>
        <PageTitle>
          Race {race.raceNumber}
          <span className="text-[hsl(var(--muted-foreground))]">
            {" "}
            / {race.distance}m
            {race.grade && ` / ${race.grade}`}
          </span>
        </PageTitle>
        {race.name && (
          <p className="mt-3 max-w-3xl text-[15px] leading-6 text-[hsl(215_14%_70%)]">
            {race.name}
          </p>
        )}
      </div>

      {(sourceRaceStatus === "abandoned" ||
        sourceRaceStatus === "postponed") && (
        <div
          className={`giq-race-status-notice giq-race-status-notice-${sourceRaceStatus}`}
          role="status"
          data-race-source-status={sourceRaceStatus}
        >
          <Activity className="h-5 w-5" aria-hidden="true" />
          <div>
            <strong>{racePresentationStatus.label}</strong>
            <p>
              The loaded race source marks this race as {sourceRaceStatus}.
              Its scheduled time remains visible for reference; it is excluded
              from live and next-to-go queues.
            </p>
          </div>
        </div>
      )}

      <RaceMeetingNavigation
        previous={previousRaceTarget}
        next={nextRaceTarget}
        position={meetingRaceNavigation.position}
        total={meetingRaceNavigation.total}
        meetingHref={buildRaceListReturnHref(listContext)}
        trackName={track.name}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,430px)]">
        <section className="min-w-0 space-y-5">
          {replayStreamUrl ? (
            <RaceReplayPlayer
              streamUrl={replayStreamUrl}
              streamContentType={replayStreamContentType}
              trackName={track.name}
              raceLabel={`Race ${race.raceNumber} / ${race.distance}m`}
              raceTimeLabel={raceTimeLabel}
            />
          ) : replayEmbedUrl ? (
            <ReplayEmbed
              embedUrl={replayEmbedUrl}
              officialUrl={replayOfficialUrl ?? replayEmbedUrl}
              title={replayTitle ?? "Race replay"}
              trackName={track.name}
              raceLabel={`Race ${race.raceNumber} / ${race.distance}m`}
              raceTimeLabel={raceTimeLabel}
            />
          ) : replayOfficialUrl ? (
            <OfficialReplaySource
              officialUrl={replayOfficialUrl}
              title={replayTitle ?? "Race replay"}
              raceTimeLabel={raceTimeLabel}
            />
          ) : (
            <ReplayFallback
              hasVideoRecord={Boolean(primaryVideo || race.replayUrl)}
            />
          )}

          {photoFinishSrc && (
            <section className="giq-racecard-section giq-table-shell overflow-hidden">
              <div className="border-b border-white/[0.07] p-5">
                <p className="program-label">Photo finish</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
                  Official photo finish
                </h2>
              </div>
              {/* Plain img: external GRV Azure host is CSP-allowlisted for
                  img-src and is not a configured next/image remote pattern. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoFinishSrc}
                alt={`Photo finish for ${track.name} Race ${race.raceNumber}`}
                loading="lazy"
                className="w-full bg-black object-contain"
              />
            </section>
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
            {hasResults && (
              <div className="grid gap-3 border-b border-white/[0.07] p-4 sm:grid-cols-3">
                <SummaryTile
                  label="Winner"
                  value={winner ? winner.dog.name : "Pending"}
                  icon={<Trophy className="h-4 w-4" />}
                  tone="gold"
                />
                <SummaryTile
                  label="Winning time"
                  value={
                    winner?.result?.runningTime
                      ? `${winner.result.runningTime.toFixed(2)}s`
                      : "Not recorded"
                  }
                  icon={<Clock className="h-4 w-4" />}
                />
                <SummaryTile
                  label="Result status"
                  value={resultStatusLabel}
                  icon={<Activity className="h-4 w-4" />}
                />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
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
                  {orderedRunners.map((runner) => (
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

          {previousRaceVideos.length > 0 && (
            <PreviousRaceVideoSection videos={previousRaceVideos} />
          )}
        </section>

        <aside className="min-w-0 space-y-3">
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
                value={
                  hasPlayableReplay
                    ? "Playable replay"
                    : hasOfficialReplaySource
                      ? "Official replay available"
                      : "No official replay linked"
                }
                icon={<PlayCircle className="h-4 w-4" />}
                tone={hasPlayableReplay || hasOfficialReplaySource ? "gold" : "primary"}
              />
              <SummaryTile
                label="Race status"
                value={racePresentationStatus.label}
                icon={<Activity className="h-4 w-4" />}
              />
              <SummaryTile
                label="Results"
                value={resultStatusLabel}
                icon={<Trophy className="h-4 w-4" />}
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
                  </p>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function collectPreviousRaceVideoCandidates(
  race: RaceDetail,
  previousVideoRunners: PreviousRaceVideoRunner[]
) {
  const byPageUrl = new Map<string, PreviousRaceVideoCandidate>();

  for (const pastRunner of previousVideoRunners) {
    const pastRace = pastRunner.race;
    const replayCandidate = pastRace.videos
      .map((video) => ({ video, officialUrl: officialRaceReplayUrl(video) }))
      .find((candidate) => candidate.officialUrl);
    const video = replayCandidate?.video ?? null;
    const pageUrl =
      replayCandidate?.officialUrl ??
      officialRaceReplayUrl({
        sourceProvider: pastRace.sourceProvider,
        pageUrl: pastRace.replayUrl,
        sourceStatus: null,
      });
    if (!pageUrl) continue;

    const streamVideo = pastRace.videos.find((entry) =>
      proxiedStreamPath(entry.streamUrl)
    );
    upsertPreviousVideoCandidate(byPageUrl, {
      id: video?.id ?? pastRace.id,
      pageUrl,
      sourceProvider:
        video?.sourceProvider ?? pastRace.sourceProvider ?? "",
      sourceId: video?.sourceId ?? pastRace.sourceId ?? pageUrl,
      embedSourceType: video?.embedSourceType,
      dogNames: [pastRunner.dog.name],
      date: pastRace.raceTime,
      trackName: pastRace.meeting.track.name,
      raceLabel: `Race ${pastRace.raceNumber} / ${pastRace.distance}m`,
      raceName: pastRace.name,
      finishText: resultFinishText(pastRunner.result?.finishingPosition),
      runningTime: pastRunner.result?.runningTime ?? null,
      winnerTime: null,
      title: video?.title ?? pastRace.name,
      localReplay: streamVideo?.streamUrl
        ? {
            pageUrl,
            streamUrl: streamVideo.streamUrl,
            streamContentType: streamVideo.streamContentType,
            title: streamVideo.title,
            description: streamVideo.description,
            sourceStatus: streamVideo.sourceStatus,
            sourceCode: streamVideo.sourceCode,
          }
        : null,
    });
  }

  for (const runner of race.runners) {
    for (const entry of runner.dog.profileForms) {
      const entryTime = entry.date.getTime();
      if (
        !entry.hasVideo ||
        !entry.raceUrl ||
        !Number.isFinite(entryTime) ||
        entryTime >= race.raceTime.getTime()
      ) {
        continue;
      }

      const pageUrl = officialRaceReplayUrl({
        sourceProvider: entry.sourceProvider,
        pageUrl: entry.raceUrl,
        sourceStatus: null,
      });
      if (!pageUrl) continue;

      upsertPreviousVideoCandidate(byPageUrl, {
        id: entry.id,
        pageUrl,
        sourceProvider: entry.sourceProvider,
        sourceId: entry.raceUrl,
        dogNames: [runner.dog.name],
        date: entry.date,
        trackName: entry.trackName ?? entry.trackCode ?? "Previous race",
        raceLabel: previousRaceLabel(entry.distance, entry.grade),
        raceName: entry.raceName,
        finishText: entry.finishText,
        runningTime: entry.runningTime,
        winnerTime: entry.winnerTime,
        title: entry.raceName,
        localReplay: null,
      });
    }
  }

  return [...byPageUrl.values()].sort(
    (a, b) =>
      Number(Boolean(b.localReplay?.streamUrl)) -
        Number(Boolean(a.localReplay?.streamUrl)) ||
      b.date.getTime() - a.date.getTime()
  );
}

async function resolvePreviousRaceVideos(
  candidates: PreviousRaceVideoCandidate[]
): Promise<ResolvedPreviousRaceVideo[]> {
  const resolved: Array<ResolvedPreviousRaceVideo | null> = await Promise.all(
    candidates
      .slice(0, MAX_PREVIOUS_RACE_VIDEO_RESOLVES)
      .map(async (candidate): Promise<ResolvedPreviousRaceVideo | null> => {
        const replay =
          candidate.localReplay ??
          (await resolveRaceVideoReplay({
            sourceProvider: candidate.sourceProvider,
            sourceId: candidate.sourceId,
            pageUrl: candidate.pageUrl,
            embedSourceType: candidate.embedSourceType,
          }));
        const embedUrl = replayEmbedUrl(replay, candidate.pageUrl);
        const proxiedStream = proxiedStreamPath(replay?.streamUrl);
        if (!embedUrl && !proxiedStream) return null;

        return {
          ...candidate,
          replay: replay
            ? {
                ...replay,
                streamUrl: proxiedStream ? replay.streamUrl : null,
                embedUrl,
                embedType:
                  embedUrlFromReplayPage(embedUrl)?.type ??
                  replay.embedType ??
                  null,
              }
            : {
                pageUrl: candidate.pageUrl,
                streamUrl: null,
                streamContentType: null,
                title: candidate.title,
                description: null,
                sourceStatus: 200,
                sourceCode: "embedded-official-source",
                embedUrl,
                embedType: embedUrlFromReplayPage(embedUrl)?.type ?? null,
              },
        };
      })
  );
  return resolved.filter(
    (video): video is ResolvedPreviousRaceVideo => video !== null
  );
}

function replayEmbedUrl(
  replay: ResolvedRaceReplay | null,
  officialUrl: string
) {
  for (const candidate of [
    replay?.embedUrl,
    replay?.pageUrl,
    replay?.streamUrl,
    officialUrl,
  ]) {
    const embed = embedUrlFromReplayPage(candidate);
    if (embed) return embed.embedUrl;
  }
  return null;
}

function upsertPreviousVideoCandidate(
  candidates: Map<string, PreviousRaceVideoCandidate>,
  candidate: PreviousRaceVideoCandidate
) {
  const existing = candidates.get(candidate.pageUrl);
  if (!existing) {
    candidates.set(candidate.pageUrl, candidate);
    return;
  }

  for (const dogName of candidate.dogNames) {
    if (!existing.dogNames.includes(dogName)) existing.dogNames.push(dogName);
  }
  if (!existing.localReplay && candidate.localReplay) {
    existing.localReplay = candidate.localReplay;
  }
}

function PreviousRaceVideoSection({
  videos,
}: {
  videos: ResolvedPreviousRaceVideo[];
}) {
  return (
    <section className="giq-racecard-section p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="program-label">Previous race videos</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            Recent replay form
          </h2>
        </div>
        <span className="giq-badge giq-badge-neutral">
          {videos.length} source{videos.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {videos.map((video) => {
          const proxiedStream = proxiedStreamPath(video.replay?.streamUrl);
          return (
            <article key={video.pageUrl} className="min-w-0 space-y-3">
            <div className="flex flex-col gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
                  {video.dogNames.join(", ")}
                </p>
                <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                  {formatRaceDetailTime(video.date)}
                  {video.raceName ? ` / ${video.raceName}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
                {video.finishText && (
                  <span className="giq-badge giq-badge-neutral">
                    {video.finishText}
                  </span>
                )}
                {video.runningTime && (
                  <span className="font-mono">{video.runningTime.toFixed(2)}s</span>
                )}
              </div>
            </div>
            {proxiedStream ? (
              <RaceReplayPlayer
                streamUrl={proxiedStream}
                streamContentType={video.replay?.streamContentType}
                trackName={video.trackName}
                raceLabel={video.raceLabel}
                raceTimeLabel={formatRaceDetailTime(video.date)}
              />
            ) : video.replay?.embedUrl ? (
              <ReplayEmbed
                embedUrl={video.replay.embedUrl}
                officialUrl={video.pageUrl}
                title={video.replay.title ?? video.raceName ?? "Race replay"}
                trackName={video.trackName}
                raceLabel={video.raceLabel}
                raceTimeLabel={formatRaceDetailTime(video.date)}
              />
            ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function previousRaceLabel(distance: number | null, grade: string | null) {
  const distanceLabel = distance ? `${distance}m` : "Previous run";
  return grade ? `${distanceLabel} / ${grade}` : distanceLabel;
}

function resultFinishText(position: number | null | undefined) {
  return position ? `Finished ${position}` : null;
}

function ReplayFallback({
  hasVideoRecord,
}: {
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
            Official replay unavailable
          </h2>
          <p className="mt-2 text-sm leading-6 text-[hsl(215_14%_68%)]">
            {hasVideoRecord
              ? "A replay record exists, but it does not contain a verified official source link."
              : "No official replay source is linked to this race yet."}
          </p>
        </div>
      </div>
    </section>
  );
}

function ReplayEmbed({
  embedUrl,
  officialUrl,
  title,
  trackName,
  raceLabel,
  raceTimeLabel,
}: {
  embedUrl: string;
  officialUrl: string;
  title: string;
  trackName: string;
  raceLabel: string;
  raceTimeLabel: string;
}) {
  const trustedEmbed = embedUrlFromReplayPage(embedUrl);
  if (!trustedEmbed) {
    return (
      <OfficialReplaySource
        officialUrl={officialUrl}
        title={title}
        raceTimeLabel={raceTimeLabel}
      />
    );
  }

  return (
    <section className="race-panel overflow-hidden">
      <div className="relative aspect-video w-full max-w-full bg-black">
        <iframe
          src={trustedEmbed.embedUrl}
          title={`${raceLabel} replay at ${trackName}`}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allowFullScreen
        />
      </div>
      <div className="border-t border-white/[0.07] bg-white/[0.025] p-4">
        <div className="min-w-0">
          <p className="program-label">Race replay</p>
          <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            {title}
          </h2>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            {raceTimeLabel}
          </p>
          <OfficialReplayLink officialUrl={officialUrl} />
        </div>
      </div>
    </section>
  );
}

function OfficialReplaySource({
  officialUrl,
  title,
  raceTimeLabel,
}: {
  officialUrl: string;
  title: string;
  raceTimeLabel: string;
}) {
  return (
    <section className="race-panel p-5">
      <p className="program-label">Replay source</p>
      <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
        {title}
      </h2>
      <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
        {raceTimeLabel}
      </p>
      <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
        An in-site player is not available for this replay source.
      </p>
      <OfficialReplayLink officialUrl={officialUrl} />
    </section>
  );
}

function OfficialReplayLink({ officialUrl }: { officialUrl: string }) {
  return (
    <a
      href={officialUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="giq-button giq-button-glass mt-4 min-h-11 w-full px-4 text-[13px] font-semibold sm:w-auto"
    >
      Watch on official source <span aria-hidden="true">↗</span>
    </a>
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
