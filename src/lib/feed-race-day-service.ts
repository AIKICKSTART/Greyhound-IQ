import "server-only";

import type { Prisma } from "@prisma/client";

import type { CurrentUserProfile } from "@/lib/auth-types";
import { withDbRequestContext } from "@/lib/db-context";
import type { FeedRaceDayClaimedRunner } from "@/lib/feed-race-day";
import { formatRaceDateInput, raceDateWindow } from "@/lib/race-time";

const CLAIMED_RUNNER_LIMIT = 64;

export function approvedClaimedDogRunnerWhere(
  profileId: string,
  now: Date,
): Prisma.RunnerWhereInput {
  const { gte, lt } = raceDateWindow(formatRaceDateInput(now));
  return {
    race: { raceTime: { gte, lt } },
    dog: {
      ownership: {
        some: {
          profileId,
          status: "approved",
          verified: true,
        },
      },
    },
  };
}

export function approvedClaimedTrainerRunnerWhere(
  profileId: string,
  now: Date,
): Prisma.RunnerWhereInput {
  const { gte, lt } = raceDateWindow(formatRaceDateInput(now));
  return {
    race: { raceTime: { gte, lt } },
    trainer: {
      is: {
        claims: {
          some: {
            profileId,
            status: "approved",
            verified: true,
          },
        },
      },
    },
  };
}

export function listApprovedClaimedRunners(
  current: CurrentUserProfile,
  now = new Date(),
): Promise<FeedRaceDayClaimedRunner[]> {
  return withDbRequestContext(current, async (tx) => {
    const select = {
      raceId: true,
      trainerId: true,
      dog: {
        select: {
          id: true,
          name: true,
          trainer: { select: { name: true } },
        },
      },
      trainer: { select: { name: true } },
    } satisfies Prisma.RunnerSelect;
    const [dogRunners, trainerRunners] = await Promise.all([
      tx.runner.findMany({
        where: approvedClaimedDogRunnerWhere(current.profileId, now),
        select,
        orderBy: [{ race: { raceTime: "asc" } }, { boxNumber: "asc" }],
        take: CLAIMED_RUNNER_LIMIT,
      }),
      tx.runner.findMany({
        where: approvedClaimedTrainerRunnerWhere(current.profileId, now),
        select,
        orderBy: [{ race: { raceTime: "asc" } }, { boxNumber: "asc" }],
        take: CLAIMED_RUNNER_LIMIT,
      }),
    ]);

    const claimed = new Map<string, FeedRaceDayClaimedRunner>();
    for (const [claimSource, runners] of [
      ["dog", dogRunners],
      ["trainer", trainerRunners],
    ] as const) {
      for (const runner of runners) {
        const key = `${runner.raceId}:${runner.dog.id}`;
        const existing = claimed.get(key);
        if (existing) {
          existing.claimSources = [
            ...new Set([...existing.claimSources, claimSource]),
          ];
          continue;
        }
        claimed.set(key, {
          raceId: runner.raceId,
          dogId: runner.dog.id,
          dogName: runner.dog.name,
          trainerId: runner.trainerId,
          trainerName:
            runner.trainer?.name ?? runner.dog.trainer?.name ?? null,
          claimSources: [claimSource],
        });
      }
    }
    return [...claimed.values()]
      .sort((left, right) =>
        left.raceId.localeCompare(right.raceId) ||
        left.dogId.localeCompare(right.dogId),
      )
      .slice(0, CLAIMED_RUNNER_LIMIT * 2);
  });
}
