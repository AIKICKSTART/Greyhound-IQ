import "server-only";

import { withDbSystemContext, type DbContextClient } from "@/lib/db-context";
import {
  buildTheDogsProfilePath,
  parseShowMorePath,
  parseTheDogsDogProfile,
  TheDogsDogProfileProvider,
  type TheDogsDogProfile,
} from "@/lib/live/thedogs-profile";
import { sanitizeRawJson } from "@/lib/live/raw-sanitizer";
import { logRequestError } from "@/lib/logger";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;
const PAUSE_MS = 500;

type SyncOptions = {
  limit?: number;
  racedOnly?: boolean;
};

type SyncResult = {
  attempted: number;
  synced: number;
  failed: number;
};

type DogSeed = {
  id: string;
  name: string;
  earBrand: string | null;
  sourceId: string | null;
  profileUrl: string | null;
};

export async function syncDogProfilesBatch(
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const limit = clampLimit(opts.limit ?? DEFAULT_LIMIT);
  const racedOnly = opts.racedOnly ?? true;

  const dogs = await withDbSystemContext((tx) =>
    tx.dog.findMany({
      where: {
        earBrand: { startsWith: "thedogs:" },
        lastProfileSyncedAt: null,
        // Skip scratching artifacts (e.g. "Foo (L/SCR)") — real greyhound names
        // never contain parentheses. Their thedogs pages don't exist, so they
        // fail every fetch and, being oldest by createdAt, permanently clog the
        // fixed-size batch. Excluding them lets the queue reach real dogs.
        NOT: { name: { contains: "(" } },
        ...(racedOnly ? { runners: { some: {} } } : {}),
      },
      select: {
        id: true,
        name: true,
        earBrand: true,
        sourceId: true,
        profileUrl: true,
      },
      orderBy: { createdAt: "asc" },
      take: Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT),
    }),
  );

  const provider = new TheDogsDogProfileProvider();
  let synced = 0;
  let failed = 0;

  // Sequential (concurrency 1) with a gentle pause between dogs; one bad dog
  // must not abort the batch, so each is isolated in its own try/catch.
  for (const dog of dogs) {
    try {
      const profile = await fetchProfileForDog(provider, dog);
      await withDbSystemContext((tx) => saveProfile(tx, dog.id, profile));
      synced += 1;
    } catch (err) {
      failed += 1;
      await logRequestError("dog_profile_sync.profile_failed", {
        provider: "thedogs",
        dogId: dog.id,
      }, err);
    }
    if (PAUSE_MS > 0) await sleep(PAUSE_MS);
  }

  return { attempted: dogs.length, synced, failed };
}

async function fetchProfileForDog(
  provider: TheDogsDogProfileProvider,
  dog: DogSeed,
): Promise<TheDogsDogProfile> {
  const profileSourceId = profileIdFor(dog);
  if (!profileSourceId) {
    throw new Error(`Missing The Dogs source id for ${dog.id}`);
  }
  const profilePath = dog.profileUrl
    ? new URL(dog.profileUrl).pathname
    : buildTheDogsProfilePath(profileSourceId, dog.name);
  const profileHtml = await provider.fetchProfile(profilePath);
  const showMorePath = parseShowMorePath(profileHtml);
  const fullFormHtml = showMorePath
    ? await provider.fetchFullForm(showMorePath)
    : "";
  return parseTheDogsDogProfile(
    profileHtml,
    profileSourceId,
    profilePath,
    fullFormHtml,
  );
}

async function saveProfile(
  tx: DbContextClient,
  dogId: string,
  profile: TheDogsDogProfile,
) {
  const sireId = await ensureParentDog(tx, profile.sire);
  const damId = await ensureParentDog(tx, profile.dam);
  const trainerId = await ensureTrainer(tx, profile.trainerName);

  await tx.dog.update({
    where: { id: dogId },
    data: {
      name: profile.name,
      earBrand: `thedogs:${profile.sourceId}`,
      colour: profile.colour,
      sex: profile.sex,
      whelpDate: profile.whelpDate,
      sireId,
      damId,
      trainerId,
      sourceProvider: profile.sourceProvider,
      sourceId: profile.sourceId,
      profileUrl: profile.profileUrl,
      ownerName: profile.ownerName,
      careerStarts: profile.careerStarts,
      careerWins: profile.careerWins,
      careerSeconds: profile.careerSeconds,
      careerThirds: profile.careerThirds,
      prizeMoney: profile.prizeMoney,
      winPercentage: profile.winPercentage,
      placePercentage: profile.placePercentage,
      profileStatsJson: profile.profileStatsJson,
      bestTimesJson: profile.bestTimesJson,
      boxHistoryJson: profile.boxHistoryJson,
      distanceHistoryJson: profile.distanceHistoryJson,
      profileSourceRawJson: sanitizeRawJson(profile.profileSourceRawJson),
      lastProfileSyncedAt: new Date(),
    },
  });

  await tx.dogProfileForm.deleteMany({
    where: { dogId, sourceProvider: profile.sourceProvider },
  });

  if (profile.formRows.length > 0) {
    await tx.dogProfileForm.createMany({
      data: profile.formRows.map((row) => ({
        dogId,
        sourceProvider: profile.sourceProvider,
        sourceId: row.sourceId,
        raceUrl: row.raceUrl,
        date: row.date,
        trackCode: row.trackCode,
        raceName: row.raceName,
        finishText: row.finishText,
        finishingPosition: row.finishingPosition,
        starters: row.starters,
        boxNumber: row.boxNumber,
        weight: row.weight,
        distance: row.distance,
        grade: row.grade,
        runningTime: row.runningTime,
        winnerTime: row.winnerTime,
        bestOfNightTime: row.bestOfNightTime,
        firstSectional: row.firstSectional,
        margin: row.margin,
        winnerDogName: row.winnerDogName,
        winnerDogSourceId: row.winnerDogSourceId
          ? `thedogs:${row.winnerDogSourceId}`
          : undefined,
        inRunningPositions: row.inRunningPositions,
        hasVideo: row.hasVideo,
        sourceRawJson: sanitizeRawJson(row.sourceRawJson),
      })),
    });
  }
}

async function ensureParentDog(
  tx: DbContextClient,
  dog: TheDogsDogProfile["sire"] | TheDogsDogProfile["dam"],
) {
  if (!dog?.sourceId) return null;
  const earBrand = `thedogs:${dog.sourceId}`;
  const row = await tx.dog.upsert({
    where: { earBrand },
    create: {
      name: dog.name,
      earBrand,
      sourceProvider: "thedogs",
      sourceId: dog.sourceId,
      profileUrl: new URL(dog.url, "https://www.thedogs.com.au").toString(),
    },
    update: {
      sourceProvider: "thedogs",
      sourceId: dog.sourceId,
      profileUrl: new URL(dog.url, "https://www.thedogs.com.au").toString(),
    },
    select: { id: true },
  });
  return row.id;
}

async function ensureTrainer(tx: DbContextClient, name: string | undefined) {
  if (!name) return null;
  const existing = await tx.trainer.findFirst({
    where: { name },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.trainer.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
}

function profileIdFor(dog: DogSeed) {
  return dog.sourceId ?? dog.earBrand?.replace(/^thedogs:/, "");
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
