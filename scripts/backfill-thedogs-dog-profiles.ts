/**
 * Backfill rich dog profile data from The Dogs dog profile pages.
 *
 * Examples:
 *   npm run backfill:thedogs:dog-profiles -- --limit 25
 *   npm run backfill:thedogs:dog-profiles -- --source-id 60626 --no-resume
 *   npm run backfill:thedogs:dog-profiles -- --full --concurrency 2
 *   npm run backfill:thedogs:dog-profiles -- --full --shard-index 1 --shard-count 4
 */
import "./load-env";
import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import {
  buildTheDogsProfilePath,
  parseShowMorePath,
  parseTheDogsDogProfile,
  TheDogsDogProfileProvider,
  type TheDogsDogProfile,
} from "../src/lib/live/thedogs-profile";

const DEFAULT_PROGRESS = ".backfill/thedogs-dog-profile-progress.jsonl";

type Options = {
  full: boolean;
  limit: number;
  concurrency: number;
  pauseMs: number;
  progressFile: string;
  resume: boolean;
  sourceId?: string;
  continueOnError: boolean;
  maxErrors: number;
  shardIndex: number;
  shardCount: number;
};

type DogSeed = {
  id: string;
  name: string;
  earBrand: string | null;
  sourceId: string | null;
  profileUrl: string | null;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const completed = options.resume
    ? await readCompletedDogIds(options.progressFile)
    : new Set<string>();
  const dogs = await findDogs(options, completed);
  const selected = options.full ? dogs : dogs.slice(0, options.limit);

  console.log(
    JSON.stringify(
      {
        totalPendingDogs: dogs.length,
        selectedDogs: selected.length,
        full: options.full,
        concurrency: options.concurrency,
        progressFile: options.progressFile,
        sourceId: options.sourceId,
        shardIndex: options.shardIndex,
        shardCount: options.shardCount,
      },
      null,
      2
    )
  );

  const provider = new TheDogsDogProfileProvider();
  let errorCount = 0;
  await mapLimit(selected, options.concurrency, async (dog) => {
    const startedAt = Date.now();
    try {
      const profileSourceId = profileIdFor(dog);
      if (!profileSourceId) throw new Error(`Missing The Dogs source id for ${dog.id}`);
      const profilePath = dog.profileUrl
        ? new URL(dog.profileUrl).pathname
        : buildTheDogsProfilePath(profileSourceId, dog.name);
      const profileHtml = await provider.fetchProfile(profilePath);
      const showMorePath = parseShowMorePath(profileHtml);
      const fullFormHtml = showMorePath
        ? await provider.fetchFullForm(showMorePath)
        : "";
      const profile = parseTheDogsDogProfile(
        profileHtml,
        profileSourceId,
        profilePath,
        fullFormHtml
      );
      await saveProfile(dog.id, profile);
      await appendProgress(options.progressFile, {
        dogId: dog.id,
        sourceId: profileSourceId,
        name: dog.name,
        ok: true,
        durationMs: Date.now() - startedAt,
        formRows: profile.formRows.length,
      });
      console.log(
        `[backfill:thedogs:dog-profiles] ${dog.name} (${profileSourceId}) ok: ${profile.formRows.length} form rows in ${Date.now() - startedAt}ms`
      );
    } catch (err) {
      errorCount += 1;
      await appendProgress(options.progressFile, {
        dogId: dog.id,
        sourceId: profileIdFor(dog),
        name: dog.name,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(
        `[backfill:thedogs:dog-profiles] ${dog.name} failed:`,
        err
      );
      if (!options.continueOnError || errorCount >= options.maxErrors) {
        throw err;
      }
    }

    if (options.pauseMs > 0) await sleep(options.pauseMs);
  });
}

async function findDogs(options: Options, completed: Set<string>) {
  const where = options.sourceId
    ? { earBrand: `thedogs:${options.sourceId}` }
    : { earBrand: { startsWith: "thedogs:" }, lastProfileSyncedAt: null };
  const dogs = await prisma.dog.findMany({
    where,
    select: {
      id: true,
      name: true,
      earBrand: true,
      sourceId: true,
      profileUrl: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return dogs
    .filter((dog) => !completed.has(dog.id))
    .filter((dog) => belongsToShard(dog, options));
}

async function saveProfile(dogId: string, profile: TheDogsDogProfile) {
  const sireId = await ensureParentDog(profile.sire);
  const damId = await ensureParentDog(profile.dam);
  const trainerId = await ensureTrainer(profile.trainerName);

  await prisma.$transaction(async (tx) => {
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
        profileSourceRawJson: profile.profileSourceRawJson,
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
          startingPrice: row.startingPrice,
          hasVideo: row.hasVideo,
          sourceRawJson: row.sourceRawJson,
        })),
      });
    }
  });
}

async function ensureParentDog(
  dog: TheDogsDogProfile["sire"] | TheDogsDogProfile["dam"]
) {
  if (!dog?.sourceId) return null;
  const earBrand = `thedogs:${dog.sourceId}`;
  const row = await prisma.dog.upsert({
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

async function ensureTrainer(name: string | undefined) {
  if (!name) return null;
  const existing = await prisma.trainer.findFirst({
    where: { name },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.trainer.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
}

function parseOptions(args: string[]): Options {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inlineValue != null) {
      values.set(rawKey, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(rawKey, next);
      index += 1;
    } else {
      values.set(rawKey, true);
    }
  }

  return {
    full: values.has("full"),
    limit: positiveInt(stringOption(values, "limit"), 25),
    concurrency: positiveInt(stringOption(values, "concurrency"), 2),
    pauseMs: positiveInt(stringOption(values, "pause-ms"), 750),
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    resume: !values.has("no-resume"),
    sourceId: stringOption(values, "source-id"),
    continueOnError: !values.has("stop-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 25),
    shardIndex: positiveInt(stringOption(values, "shard-index"), 1),
    shardCount: positiveInt(stringOption(values, "shard-count"), 1),
  };
}

async function readCompletedDogIds(progressFile: string) {
  const completed = new Set<string>();
  try {
    const body = await readFile(progressFile, "utf8");
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as { dogId?: string; ok?: boolean };
      if (record.dogId && record.ok) completed.add(record.dogId);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return completed;
}

async function appendProgress(progressFile: string, record: Record<string, unknown>) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await appendFile(
    progressFile,
    `${JSON.stringify({ ...record, loggedAt: new Date().toISOString() })}\n`
  );
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, limit) }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        await worker(items[index]);
      }
    })
  );
}

function profileIdFor(dog: DogSeed) {
  return dog.sourceId ?? dog.earBrand?.replace(/^thedogs:/, "");
}

function belongsToShard(dog: DogSeed, options: Options) {
  if (options.sourceId || options.shardCount <= 1) return true;
  const shardIndex = Math.min(options.shardIndex, options.shardCount) - 1;
  const key = profileIdFor(dog) ?? dog.id;
  return stableHash(key) % options.shardCount === shardIndex;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((err) => {
    console.error("[backfill:thedogs:dog-profiles] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
