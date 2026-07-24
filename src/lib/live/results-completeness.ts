import "server-only";

import { withDbSystemContext } from "@/lib/db-context";
import { replayPlaybackState } from "@/lib/live/race-replay";

const RECENT_HOURS = 48;

export type ResultsCompletenessMetric = {
  ageBucket: "under_30m" | "30m_to_90m" | "90m_to_6h" | "6h_to_48h";
  playableReplays: number;
  provider: string;
  races: number;
  resultRunners: number;
  runners: number;
  staleReplayRaces: number;
  staleResultRaces: number;
  track: string;
  trainers: number;
  weights: number;
};

type CompletenessRace = {
  raceTime: Date;
  replayUrl: string | null;
  sourceProvider: string | null;
  meeting: { track: { name: string } };
  runners: Array<{
    scratched: boolean;
    trainerId: string | null;
    weight: number | null;
    result: { id: string } | null;
  }>;
  videos: Array<{
    sourceProvider: string | null;
    pageUrl: string | null;
    embedSourceType: string | null;
    streamUrl: string | null;
    sourceStatus: number | null;
  }>;
};

export async function auditRecentResultsCompleteness(now = new Date()) {
  const races = await withDbSystemContext((tx) =>
    tx.race.findMany({
      where: {
        raceTime: {
          gte: new Date(now.getTime() - RECENT_HOURS * 60 * 60 * 1_000),
          lt: now,
        },
      },
      orderBy: { raceTime: "desc" },
      select: {
        raceTime: true,
        replayUrl: true,
        sourceProvider: true,
        meeting: { select: { track: { select: { name: true } } } },
        runners: {
          select: {
            scratched: true,
            trainerId: true,
            weight: true,
            result: { select: { id: true } },
          },
        },
        videos: {
          select: {
            sourceProvider: true,
            pageUrl: true,
            embedSourceType: true,
            streamUrl: true,
            sourceStatus: true,
          },
        },
      },
      take: 5000,
    }),
  );
  return aggregateResultsCompleteness(races, now);
}

export function aggregateResultsCompleteness(
  races: CompletenessRace[],
  now: Date,
) {
  const metrics = new Map<string, ResultsCompletenessMetric>();

  for (const race of races) {
    const ageMinutes = Math.max(
      0,
      (now.getTime() - race.raceTime.getTime()) / 60_000,
    );
    const ageBucket = completenessAgeBucket(ageMinutes);
    const provider = race.sourceProvider?.trim().toLowerCase() || "unknown";
    const track = race.meeting.track.name;
    const key = `${provider}\u0000${track}\u0000${ageBucket}`;
    const metric = metrics.get(key) ?? {
      ageBucket,
      playableReplays: 0,
      provider,
      races: 0,
      resultRunners: 0,
      runners: 0,
      staleReplayRaces: 0,
      staleResultRaces: 0,
      track,
      trainers: 0,
      weights: 0,
    };
    const runners = race.runners.filter((runner) => !runner.scratched);
    const playableReplay =
      race.videos.some((video) =>
        ["embedded", "external"].includes(replayPlaybackState(video)),
      ) ||
      (race.replayUrl
        ? ["embedded", "external"].includes(
            replayPlaybackState({
              sourceProvider: race.sourceProvider,
              pageUrl: race.replayUrl,
            }),
          )
        : false);
    const resultRunners = runners.filter((runner) => runner.result).length;

    metric.races += 1;
    metric.runners += runners.length;
    metric.resultRunners += resultRunners;
    metric.trainers += runners.filter((runner) => runner.trainerId).length;
    metric.weights += runners.filter((runner) => runner.weight != null).length;
    if (playableReplay) metric.playableReplays += 1;
    if (ageMinutes >= 30 && runners.length > 0 && resultRunners === 0) {
      metric.staleResultRaces += 1;
    }
    if (ageMinutes >= 90 && !playableReplay) metric.staleReplayRaces += 1;
    metrics.set(key, metric);
  }

  return [...metrics.values()].sort((left, right) =>
    `${left.provider}:${left.track}:${left.ageBucket}`.localeCompare(
      `${right.provider}:${right.track}:${right.ageBucket}`,
    ),
  );
}

export function completenessAgeBucket(
  ageMinutes: number,
): ResultsCompletenessMetric["ageBucket"] {
  if (ageMinutes < 30) return "under_30m";
  if (ageMinutes < 90) return "30m_to_90m";
  if (ageMinutes < 360) return "90m_to_6h";
  return "6h_to_48h";
}
