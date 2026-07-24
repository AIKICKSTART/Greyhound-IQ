import "./load-env";

import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/db";
import { withDbSystemContext } from "../src/lib/db-context";
import {
  officialProviderProfileUrl,
  providerIdentityEvidenceSha256,
} from "../src/lib/live/provider-identity";
import { writeLiveFeedQuarantines } from "../src/lib/live/quarantine";

const DEFAULT_BATCH_SIZE = 10_000;
const TRANSACTION_TIMEOUT_MS = 120_000;
const APPLY_CONFIRMATION = "BACKFILL-RACING-PROVIDER-LINKAGE";
const SUPPORTED_PROVIDERS = new Set(["thedogs", "watchdog"]);

type Phase = "observe" | "link";

type Options = {
  apply: boolean;
  batchSize: number;
  from: Date | null;
  jobKey: string;
  maxBatches: number;
  phase: Phase;
};

type Cursor = {
  cutoff: string;
  from?: string;
  createdAt?: string;
  id?: string;
};

type RunnerRow = {
  id: string;
  dogId: string;
  trainerId: string | null;
  trainer: { name: string } | null;
  weight: number | null;
  sourceProvider: string | null;
  sourceRawJson: string | null;
  createdAt: Date;
};

export type RunnerProviderEvidence = {
  dogSourceId: string | null;
  dogProfileUrl: string | null;
  trainerSourceId: string | null;
  trainerName: string | null;
  trainerProfileUrl: string | null;
  officialWeight: number | null;
};

type BatchCounts = {
  ambiguous: number;
  lackingEvidence: number;
  linkedDogs: number;
  linkedTrainers: number;
  repairedWeights: number;
  scanned: number;
  unresolved: number;
};

export type IdentityCandidate = {
  canonicalId: string;
  evidenceSha256: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  profileUrl: string | null;
  sourceId: string;
  sourceProvider: string;
};

export type TrainerIdentityCandidate = IdentityCandidate & {
  historicalCanonical: boolean;
  name: string;
};

export function parseRunnerProviderEvidence(
  sourceProvider: string | null,
  sourceRawJson: string | null,
): RunnerProviderEvidence {
  const provider = normalizeProvider(sourceProvider);
  if (!provider || !SUPPORTED_PROVIDERS.has(provider) || !sourceRawJson) {
    return emptyEvidence();
  }

  let raw: Record<string, unknown>;
  try {
    const parsed = JSON.parse(sourceRawJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyEvidence();
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return emptyEvidence();
  }

  const dogSourceId = cleanSourceId(raw.dogId);
  const trainerSourceId = cleanSourceId(raw.trainerId);
  const dogProfileUrl =
    dogSourceId == null
      ? null
      : officialProviderProfileUrl({
          provider,
          entityKind: "dog",
          sourceId: dogSourceId,
          value: cleanText(raw.dogProfileUrl, 2_048),
        });
  const trainerProfileUrl =
    trainerSourceId == null
      ? null
      : officialProviderProfileUrl({
          provider,
          entityKind: "trainer",
          sourceId: trainerSourceId,
          value: cleanText(raw.trainerProfileUrl, 2_048),
        });
  const officialWeight = cleanWeight(raw.resultWeight ?? raw.weight);

  return {
    dogSourceId,
    dogProfileUrl,
    trainerSourceId,
    trainerName: cleanText(raw.trainerName ?? raw.trainer, 200),
    trainerProfileUrl,
    officialWeight,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!options.apply) {
    const cursor: Cursor = {
      cutoff: new Date().toISOString(),
      ...(options.from ? { from: options.from.toISOString() } : {}),
    };
    const rows = await readBatch(cursor, options.batchSize);
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          phase: options.phase,
          sampled: rows.length,
          classification: classifySample(rows),
          message: `Pass --apply --confirm=${APPLY_CONFIRMATION} to write.`,
        },
        null,
        2,
      ),
    );
    return;
  }

  const run = await getOrCreateRun(options);
  if (run.status === "completed") {
    console.log(JSON.stringify({ jobKey: options.jobKey, status: "completed" }));
    return;
  }

  let cursor = parseCursor(run.cursor);
  for (let batch = 0; batch < options.maxBatches; batch += 1) {
    const rows = await readBatch(cursor, options.batchSize);
    if (rows.length === 0) {
      await completeRun(options, cursor);
      console.log(JSON.stringify({ jobKey: options.jobKey, status: "completed" }));
      return;
    }

    const counts =
      options.phase === "observe"
        ? await observeBatch(rows)
        : await linkBatch(rows);
    const last = rows.at(-1)!;
    cursor = {
      cutoff: cursor.cutoff,
      createdAt: last.createdAt.toISOString(),
      id: last.id,
    };
    await checkpoint(options.jobKey, cursor, counts);
    console.log(
      JSON.stringify({
        jobKey: options.jobKey,
        batch: batch + 1,
        cursor,
        counts,
      }),
    );
  }
}

function parseOptions(args: string[]): Options {
  const apply = args.includes("--apply");
  const confirmation = flagValue(args, "--confirm");
  if (apply && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm=${APPLY_CONFIRMATION}.`);
  }

  const phaseValue = flagValue(args, "--phase") ?? "observe";
  if (phaseValue !== "observe" && phaseValue !== "link") {
    throw new Error("--phase must be observe or link.");
  }

  return {
    apply,
    phase: phaseValue,
    batchSize: positiveInteger(flagValue(args, "--batch-size"), DEFAULT_BATCH_SIZE),
    from: optionalDate(flagValue(args, "--from")),
    maxBatches: positiveInteger(
      flagValue(args, "--max-batches"),
      Number.POSITIVE_INFINITY,
    ),
    jobKey:
      flagValue(args, "--job-key") ??
      `racing-provider-linkage-${phaseValue}-v1`,
  };
}

function optionalDate(value: string | undefined) {
  if (value == null) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Expected a valid --from timestamp, received ${value}.`);
  }
  return parsed;
}

function flagValue(args: string[], flag: string) {
  const prefix = `${flag}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${value}.`);
  }
  return parsed;
}

async function getOrCreateRun(options: Options) {
  return withDbSystemContext(
    async (tx) => {
      const existing = await tx.racingDataBackfillRun.findUnique({
        where: { jobKey: options.jobKey },
      });
      if (existing) return existing;
      return tx.racingDataBackfillRun.create({
        data: {
          jobKey: options.jobKey,
          status: "running",
          cursor: JSON.stringify({
            cutoff: new Date().toISOString(),
            ...(options.from ? { from: options.from.toISOString() } : {}),
          } satisfies Cursor),
        },
      });
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

function parseCursor(value: string | null): Cursor {
  if (!value) return { cutoff: new Date().toISOString() };
  const parsed = JSON.parse(value) as Cursor;
  if (!Number.isFinite(new Date(parsed.cutoff).getTime())) {
    throw new Error("Backfill cursor has an invalid cutoff.");
  }
  if (parsed.from && !Number.isFinite(new Date(parsed.from).getTime())) {
    throw new Error("Backfill cursor has an invalid lower bound.");
  }
  return parsed;
}

async function readBatch(cursor: Cursor, take: number) {
  const cutoff = new Date(cursor.cutoff);
  const from = cursor.from ? new Date(cursor.from) : null;
  const createdAt = cursor.createdAt ? new Date(cursor.createdAt) : null;
  return withDbSystemContext(
    (tx) =>
      tx.runner.findMany({
        where: {
          createdAt: { lte: cutoff, ...(from ? { gte: from } : {}) },
          ...(createdAt && cursor.id
            ? {
                OR: [
                  { createdAt: { gt: createdAt, lte: cutoff } },
                  { createdAt, id: { gt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          dogId: true,
          trainerId: true,
          trainer: { select: { name: true } },
          weight: true,
          sourceProvider: true,
          sourceRawJson: true,
          createdAt: true,
        },
        take,
      }),
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

async function observeBatch(rows: RunnerRow[]): Promise<BatchCounts> {
  const dogCandidates = new Map<string, IdentityCandidate>();
  const trainerCandidates = new Map<string, TrainerIdentityCandidate>();
  const dogConflicts = new Set<string>();
  const trainerConflicts = new Set<string>();
  let lackingEvidence = 0;

  for (const row of rows) {
    const sourceProvider = normalizeProvider(row.sourceProvider);
    const evidence = parseRunnerProviderEvidence(
      sourceProvider,
      row.sourceRawJson,
    );
    if (!sourceProvider || !SUPPORTED_PROVIDERS.has(sourceProvider)) {
      lackingEvidence += 1;
      continue;
    }
    let rowLacksEvidence = false;
    if (evidence.dogSourceId) {
      addCandidate(
        dogCandidates,
        dogConflicts,
        identityKey(sourceProvider, evidence.dogSourceId),
        {
          canonicalId: row.dogId,
          sourceProvider,
          sourceId: evidence.dogSourceId,
          profileUrl: evidence.dogProfileUrl,
          firstSeenAt: row.createdAt,
          lastSeenAt: row.createdAt,
          evidenceSha256: providerIdentityEvidenceSha256(
            sourceProvider,
            "dog",
            evidence.dogSourceId,
            row.dogId,
          ),
        },
      );
    } else {
      rowLacksEvidence = true;
    }

    const trainerName =
      evidence.trainerName ?? cleanText(row.trainer?.name, 200);
    if (evidence.trainerSourceId && trainerName) {
      addTrainerCandidate(
        trainerCandidates,
        trainerConflicts,
        identityKey(sourceProvider, evidence.trainerSourceId),
        {
          canonicalId: row.trainerId ?? randomUUID(),
          historicalCanonical: row.trainerId != null,
          sourceProvider,
          sourceId: evidence.trainerSourceId,
          name: trainerName,
          profileUrl: evidence.trainerProfileUrl,
          firstSeenAt: row.createdAt,
          lastSeenAt: row.createdAt,
          evidenceSha256: "",
        },
      );
    } else {
      rowLacksEvidence = true;
    }
    if (rowLacksEvidence) lackingEvidence += 1;
  }

  for (const key of dogConflicts) dogCandidates.delete(key);
  for (const key of trainerConflicts) trainerCandidates.delete(key);

  const persistedConflicts = await withDbSystemContext(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('lock_timeout', '5s', true)`;
      return {
        dogs: await persistDogCandidates(
          tx,
          [...dogCandidates.values()],
          dogConflicts,
        ),
        trainers: await persistTrainerCandidates(
          tx,
          [...trainerCandidates.values()],
          trainerConflicts,
        ),
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
  await writeIdentityConflicts("dog", persistedConflicts.dogs);
  await writeIdentityConflicts("trainer", persistedConflicts.trainers);

  return {
    ambiguous:
      persistedConflicts.dogs.size + persistedConflicts.trainers.size,
    lackingEvidence,
    linkedDogs: 0,
    linkedTrainers: 0,
    repairedWeights: 0,
    scanned: rows.length,
    unresolved: 0,
  };
}

async function persistDogCandidates(
  tx: Prisma.TransactionClient,
  candidates: IdentityCandidate[],
  inBatchConflicts: Set<string>,
) {
  if (candidates.length === 0 && inBatchConflicts.size === 0) {
    return new Set<string>();
  }
  const wanted = identityConditions(candidates, inBatchConflicts);
  const existing =
    wanted.length === 0
      ? []
      : await tx.$queryRaw<
          Array<{
            id: string;
            dogId: string;
            sourceProvider: string;
            sourceId: string;
            profileUrl: string | null;
            lastSeenAt: Date;
          }>
        >(Prisma.sql`
          SELECT
            identity.id,
            identity."dogId",
            identity."sourceProvider",
            identity."sourceId",
            identity."profileUrl",
            identity."lastSeenAt"
          FROM "DogProviderIdentity" identity
          JOIN (
            VALUES ${Prisma.join(
              wanted.map(
                (key) =>
                  Prisma.sql`(${key.sourceProvider}::text, ${key.sourceId}::text)`,
              ),
            )}
          ) AS wanted(source_provider, source_id)
            ON wanted.source_provider = identity."sourceProvider"
            AND wanted.source_id = identity."sourceId"
        `);
  const byKey = new Map(
    existing.map((row) => [identityKey(row.sourceProvider, row.sourceId), row]),
  );
  const conflicts = new Set(inBatchConflicts);
  const creates: Prisma.DogProviderIdentityCreateManyInput[] = [];
  const touches: Array<{
    id: string;
    lastSeenAt: Date;
    profileUrl: string | null;
  }> = [];

  for (const candidate of candidates) {
    const key = identityKey(candidate.sourceProvider, candidate.sourceId);
    const current = byKey.get(key);
    if (current && current.dogId !== candidate.canonicalId) {
      conflicts.add(key);
    } else if (current) {
      const profileUrl = current.profileUrl ?? candidate.profileUrl;
      if (
        current.lastSeenAt < candidate.lastSeenAt ||
        current.profileUrl !== profileUrl
      ) {
        touches.push({
          id: current.id,
          lastSeenAt: candidate.lastSeenAt,
          profileUrl,
        });
      }
    } else {
      creates.push({
        id: randomUUID(),
        dogId: candidate.canonicalId,
        sourceProvider: candidate.sourceProvider,
        sourceId: candidate.sourceId,
        profileUrl: candidate.profileUrl,
        evidenceSha256: candidate.evidenceSha256,
        firstSeenAt: candidate.firstSeenAt,
        lastSeenAt: candidate.lastSeenAt,
        verificationStatus: "observed",
      });
    }
  }

  if (creates.length) await tx.dogProviderIdentity.createMany({ data: creates });
  if (touches.length) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "DogProviderIdentity" identity
      SET
        "lastSeenAt" = GREATEST(identity."lastSeenAt", values.last_seen_at),
        "profileUrl" = COALESCE(identity."profileUrl", values.profile_url),
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${Prisma.join(
          touches.map(
            (touch) =>
              Prisma.sql`(${touch.id}::text, ${touch.lastSeenAt}::timestamptz, ${touch.profileUrl}::text)`,
          ),
        )}
      ) AS values(id, last_seen_at, profile_url)
      WHERE identity.id = values.id
        AND (
          identity."lastSeenAt" < values.last_seen_at
          OR (
            identity."profileUrl" IS NULL
            AND values.profile_url IS NOT NULL
          )
        )
    `);
  }
  await markDogConflicts(tx, conflicts);
  return conflicts;
}

async function persistTrainerCandidates(
  tx: Prisma.TransactionClient,
  candidates: TrainerIdentityCandidate[],
  inBatchConflicts: Set<string>,
) {
  if (candidates.length === 0 && inBatchConflicts.size === 0) {
    return new Set<string>();
  }
  const wanted = identityConditions(candidates, inBatchConflicts);
  const existing =
    wanted.length === 0
      ? []
      : await tx.$queryRaw<
          Array<{
            id: string;
            trainerId: string;
            trainerName: string;
            sourceProvider: string;
            sourceId: string;
            profileUrl: string | null;
            lastSeenAt: Date;
          }>
        >(Prisma.sql`
          SELECT
            identity.id,
            identity."trainerId",
            trainer.name AS "trainerName",
            identity."sourceProvider",
            identity."sourceId",
            identity."profileUrl",
            identity."lastSeenAt"
          FROM "TrainerProviderIdentity" identity
          JOIN "Trainer" trainer ON trainer.id = identity."trainerId"
          JOIN (
            VALUES ${Prisma.join(
              wanted.map(
                (key) =>
                  Prisma.sql`(${key.sourceProvider}::text, ${key.sourceId}::text)`,
              ),
            )}
          ) AS wanted(source_provider, source_id)
            ON wanted.source_provider = identity."sourceProvider"
            AND wanted.source_id = identity."sourceId"
        `);
  const byKey = new Map(
    existing.map((row) => [identityKey(row.sourceProvider, row.sourceId), row]),
  );
  const conflicts = new Set(inBatchConflicts);
  const creates: TrainerIdentityCandidate[] = [];
  const touches: Array<{
    id: string;
    lastSeenAt: Date;
    profileUrl: string | null;
  }> = [];

  for (const candidate of candidates) {
    const key = identityKey(candidate.sourceProvider, candidate.sourceId);
    const current = byKey.get(key);
    if (
      current &&
      (
        normalizeName(current.trainerName) !== normalizeName(candidate.name) ||
        (
          candidate.historicalCanonical &&
          current.trainerId !== candidate.canonicalId
        )
      )
    ) {
      conflicts.add(key);
    } else if (current) {
      const profileUrl = current.profileUrl ?? candidate.profileUrl;
      if (
        current.lastSeenAt < candidate.lastSeenAt ||
        current.profileUrl !== profileUrl
      ) {
        touches.push({
          id: current.id,
          lastSeenAt: candidate.lastSeenAt,
          profileUrl,
        });
      }
    } else {
      candidate.evidenceSha256 = providerIdentityEvidenceSha256(
        candidate.sourceProvider,
        "trainer",
        candidate.sourceId,
        candidate.canonicalId,
      );
      creates.push(candidate);
    }
  }

  let approvedCreates = creates;
  const synthetic = creates.filter(
    (candidate) => !candidate.historicalCanonical,
  );
  if (synthetic.length) {
    const existingNames = await tx.$queryRaw<Array<{ normalizedName: string }>>(
      Prisma.sql`
        SELECT DISTINCT upper(
          regexp_replace(btrim(trainer.name), '\\s+', ' ', 'g')
        ) AS "normalizedName"
        FROM "Trainer" trainer
        JOIN (
          VALUES ${Prisma.join(
            synthetic.map(
              (candidate) => Prisma.sql`(${normalizeName(candidate.name)}::text)`,
            ),
          )}
        ) AS wanted(normalized_name)
          ON wanted.normalized_name = upper(
            regexp_replace(btrim(trainer.name), '\\s+', ' ', 'g')
          )
      `,
    );
    const blockedNames = new Set(
      existingNames.map((row) => row.normalizedName),
    );
    for (const candidate of synthetic) {
      if (blockedNames.has(normalizeName(candidate.name))) {
        conflicts.add(
          identityKey(candidate.sourceProvider, candidate.sourceId),
        );
      }
    }
    approvedCreates = creates.filter(
      (candidate) =>
        candidate.historicalCanonical ||
        !blockedNames.has(normalizeName(candidate.name)),
    );
  }

  if (approvedCreates.length) {
    const newTrainers = approvedCreates.filter(
      (candidate) => !candidate.historicalCanonical,
    );
    if (newTrainers.length) {
      await tx.trainer.createMany({
        data: newTrainers.map((candidate) => ({
          id: candidate.canonicalId,
          name: candidate.name,
        })),
      });
    }
    await tx.trainerProviderIdentity.createMany({
      data: approvedCreates.map((candidate) => ({
        id: randomUUID(),
        trainerId: candidate.canonicalId,
        sourceProvider: candidate.sourceProvider,
        sourceId: candidate.sourceId,
        profileUrl: candidate.profileUrl,
        evidenceSha256: candidate.evidenceSha256,
        firstSeenAt: candidate.firstSeenAt,
        lastSeenAt: candidate.lastSeenAt,
        verificationStatus: "observed",
      })),
    });
  }
  if (touches.length) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "TrainerProviderIdentity" identity
      SET
        "lastSeenAt" = GREATEST(identity."lastSeenAt", values.last_seen_at),
        "profileUrl" = COALESCE(identity."profileUrl", values.profile_url),
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${Prisma.join(
          touches.map(
            (touch) =>
              Prisma.sql`(${touch.id}::text, ${touch.lastSeenAt}::timestamptz, ${touch.profileUrl}::text)`,
          ),
        )}
      ) AS values(id, last_seen_at, profile_url)
      WHERE identity.id = values.id
        AND (
          identity."lastSeenAt" < values.last_seen_at
          OR (
            identity."profileUrl" IS NULL
            AND values.profile_url IS NOT NULL
          )
        )
    `);
  }
  await markTrainerConflicts(tx, conflicts);
  return conflicts;
}

async function markDogConflicts(
  tx: Prisma.TransactionClient,
  conflicts: Set<string>,
) {
  for (const where of conflictWheres(conflicts)) {
    await tx.dogProviderIdentity.updateMany({
      where: { ...where, verificationStatus: { not: "conflict" } },
      data: { verificationStatus: "conflict" },
    });
  }
}

async function markTrainerConflicts(
  tx: Prisma.TransactionClient,
  conflicts: Set<string>,
) {
  for (const where of conflictWheres(conflicts)) {
    await tx.trainerProviderIdentity.updateMany({
      where: { ...where, verificationStatus: { not: "conflict" } },
      data: { verificationStatus: "conflict" },
    });
  }
}

async function linkBatch(rows: RunnerRow[]): Promise<BatchCounts> {
  const parsed = rows.map((row) => ({
    row,
    provider: normalizeProvider(row.sourceProvider),
    evidence: parseRunnerProviderEvidence(row.sourceProvider, row.sourceRawJson),
  }));
  const dogKeys = uniqueIdentityKeys(
    parsed.flatMap(({ provider, evidence }) =>
      provider && evidence.dogSourceId
        ? [{ sourceProvider: provider, sourceId: evidence.dogSourceId }]
        : [],
    ),
  );
  const trainerKeys = uniqueIdentityKeys(
    parsed.flatMap(({ provider, evidence }) =>
      provider && evidence.trainerSourceId
        ? [{ sourceProvider: provider, sourceId: evidence.trainerSourceId }]
        : [],
    ),
  );

  return withDbSystemContext(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('lock_timeout', '5s', true)`;
      const [dogIdentities, trainerIdentities] = await Promise.all([
        dogKeys.length === 0
          ? []
          : tx.$queryRaw<
              Array<{
                dogId: string;
                sourceProvider: string;
                sourceId: string;
              }>
            >(Prisma.sql`
              SELECT
                identity."dogId",
                identity."sourceProvider",
                identity."sourceId"
              FROM "DogProviderIdentity" identity
              JOIN (
                VALUES ${Prisma.join(
                  dogKeys.map(
                    (key) =>
                      Prisma.sql`(${key.sourceProvider}::text, ${key.sourceId}::text)`,
                  ),
                )}
              ) AS wanted(source_provider, source_id)
                ON wanted.source_provider = identity."sourceProvider"
                AND wanted.source_id = identity."sourceId"
              WHERE identity."verificationStatus" = 'verified'
            `),
        trainerKeys.length === 0
          ? []
          : tx.$queryRaw<
              Array<{
                trainerId: string;
                sourceProvider: string;
                sourceId: string;
              }>
            >(Prisma.sql`
              SELECT
                identity."trainerId",
                identity."sourceProvider",
                identity."sourceId"
              FROM "TrainerProviderIdentity" identity
              JOIN (
                VALUES ${Prisma.join(
                  trainerKeys.map(
                    (key) =>
                      Prisma.sql`(${key.sourceProvider}::text, ${key.sourceId}::text)`,
                  ),
                )}
              ) AS wanted(source_provider, source_id)
                ON wanted.source_provider = identity."sourceProvider"
                AND wanted.source_id = identity."sourceId"
              WHERE identity."verificationStatus" = 'verified'
            `),
      ]);
      const dogMap = new Map(
        dogIdentities.map((row) => [
          identityKey(row.sourceProvider, row.sourceId),
          row.dogId,
        ]),
      );
      const trainerMap = new Map(
        trainerIdentities.map((row) => [
          identityKey(row.sourceProvider, row.sourceId),
          row.trainerId,
        ]),
      );
      const counts: BatchCounts = {
        ambiguous: 0,
        lackingEvidence: 0,
        linkedDogs: 0,
        linkedTrainers: 0,
        repairedWeights: 0,
        scanned: rows.length,
        unresolved: 0,
      };
      const updates: Prisma.Sql[] = [];

      for (const { row, provider, evidence } of parsed) {
        if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
          counts.lackingEvidence += 1;
          continue;
        }
        let rowAmbiguous = false;
        let rowUnresolved = false;
        let rowLacksEvidence = false;
        const dogId = evidence.dogSourceId
          ? dogMap.get(identityKey(provider, evidence.dogSourceId))
          : undefined;
        if (dogId === row.dogId) counts.linkedDogs += 1;
        else if (dogId) rowAmbiguous = true;
        else if (evidence.dogSourceId) rowUnresolved = true;
        else rowLacksEvidence = true;

        const trainerId = evidence.trainerSourceId
          ? trainerMap.get(identityKey(provider, evidence.trainerSourceId))
          : undefined;
        if (trainerId && (!row.trainerId || row.trainerId === trainerId)) {
          counts.linkedTrainers += 1;
          if (!row.trainerId) {
            updates.push(
              Prisma.sql`UPDATE "Runner" SET "trainerId" = ${trainerId} WHERE "id" = ${row.id} AND "trainerId" IS NULL`,
            );
          }
        } else if (trainerId) {
          rowAmbiguous = true;
        } else if (evidence.trainerSourceId) {
          rowUnresolved = true;
        } else {
          rowLacksEvidence = true;
        }
        if (rowAmbiguous) counts.ambiguous += 1;
        else if (rowLacksEvidence) counts.lackingEvidence += 1;
        else if (rowUnresolved) counts.unresolved += 1;

        if (row.weight == null && evidence.officialWeight != null) {
          updates.push(
            Prisma.sql`UPDATE "Runner" SET "weight" = ${evidence.officialWeight} WHERE "id" = ${row.id} AND "weight" IS NULL`,
          );
          counts.repairedWeights += 1;
        }
      }

      for (const update of updates) await tx.$executeRaw(update);
      return counts;
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

async function checkpoint(
  jobKey: string,
  cursor: Cursor,
  counts: BatchCounts,
) {
  const evidenceSha256 = createHash("sha256")
    .update(JSON.stringify({ cursor, counts }))
    .digest("hex");
  await withDbSystemContext(
    (tx) =>
      tx.racingDataBackfillRun.update({
        where: { jobKey },
        data: {
          cursor: JSON.stringify(cursor),
          scannedCount: { increment: counts.scanned },
          linkedDogCount: { increment: counts.linkedDogs },
          linkedTrainerCount: { increment: counts.linkedTrainers },
          repairedWeightCount: { increment: counts.repairedWeights },
          unresolvedCount: { increment: counts.unresolved },
          ambiguousCount: { increment: counts.ambiguous },
          lackingEvidenceCount: { increment: counts.lackingEvidence },
          lastBatchEvidenceSha256: evidenceSha256,
        },
      }),
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

async function completeRun(options: Options, cursor: Cursor) {
  await withDbSystemContext(
    async (tx) => {
      if (options.phase === "observe") {
        const cutoff = new Date(cursor.cutoff);
        await tx.dogProviderIdentity.updateMany({
          where: {
            verificationStatus: "observed",
            firstSeenAt: {
              lte: cutoff,
              ...(options.from ? { gte: options.from } : {}),
            },
          },
          data: { verificationStatus: "verified" },
        });
        await tx.trainerProviderIdentity.updateMany({
          where: {
            verificationStatus: "observed",
            firstSeenAt: {
              lte: cutoff,
              ...(options.from ? { gte: options.from } : {}),
            },
          },
          data: { verificationStatus: "verified" },
        });
      } else {
        await refreshCurrentDogTrainers(tx, new Date(cursor.cutoff));
      }
      await tx.racingDataBackfillRun.update({
        where: { jobKey: options.jobKey },
        data: { status: "completed", completedAt: new Date() },
      });
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

async function refreshCurrentDogTrainers(
  tx: Prisma.TransactionClient,
  asOf: Date,
) {
  await tx.$executeRaw`
    WITH preferred AS (
      SELECT DISTINCT ON (runner."dogId")
        runner."dogId",
        runner."trainerId"
      FROM "Runner" runner
      JOIN "Race" race ON race.id = runner."raceId"
      WHERE runner."trainerId" IS NOT NULL
        AND race."raceTime" >= ${asOf} - INTERVAL '30 days'
      ORDER BY
        runner."dogId",
        CASE WHEN race."raceTime" >= ${asOf} THEN 0 ELSE 1 END,
        CASE WHEN race."raceTime" >= ${asOf} THEN race."raceTime" END ASC,
        CASE WHEN race."raceTime" < ${asOf} THEN race."raceTime" END DESC
    )
    UPDATE "Dog" dog
    SET "trainerId" = preferred."trainerId"
    FROM preferred
    WHERE dog.id = preferred."dogId"
      AND dog."trainerId" IS DISTINCT FROM preferred."trainerId"
  `;
}

function classifySample(rows: RunnerRow[]) {
  return rows.reduce(
    (counts, row) => {
      const evidence = parseRunnerProviderEvidence(
        row.sourceProvider,
        row.sourceRawJson,
      );
      if (evidence.dogSourceId) counts.dogEvidence += 1;
      if (evidence.trainerSourceId && evidence.trainerName) {
        counts.trainerEvidence += 1;
      }
      if (row.weight == null && evidence.officialWeight != null) {
        counts.repairableWeights += 1;
      }
      return counts;
    },
    { dogEvidence: 0, trainerEvidence: 0, repairableWeights: 0 },
  );
}

export function addCandidate<T extends IdentityCandidate>(
  candidates: Map<string, T>,
  conflicts: Set<string>,
  key: string,
  candidate: T,
  equivalent = (left: T, right: T) => left.canonicalId === right.canonicalId,
) {
  const existing = candidates.get(key);
  if (existing && !equivalent(existing, candidate)) conflicts.add(key);
  else if (!existing) candidates.set(key, candidate);
  else mergeCandidateObservation(existing, candidate);
}

export function addTrainerCandidate(
  candidates: Map<string, TrainerIdentityCandidate>,
  conflicts: Set<string>,
  key: string,
  candidate: TrainerIdentityCandidate,
) {
  const existing = candidates.get(key);
  if (!existing) {
    candidates.set(key, candidate);
    return;
  }
  if (
    normalizeName(existing.name) !== normalizeName(candidate.name) ||
    (
      existing.historicalCanonical &&
      candidate.historicalCanonical &&
      existing.canonicalId !== candidate.canonicalId
    )
  ) {
    conflicts.add(key);
    return;
  }
  if (candidate.historicalCanonical && !existing.historicalCanonical) {
    existing.canonicalId = candidate.canonicalId;
    existing.historicalCanonical = true;
  }
  mergeCandidateObservation(existing, candidate);
}

function mergeCandidateObservation(
  existing: IdentityCandidate,
  candidate: IdentityCandidate,
) {
  if (candidate.firstSeenAt < existing.firstSeenAt) {
    existing.firstSeenAt = candidate.firstSeenAt;
  }
  if (candidate.lastSeenAt > existing.lastSeenAt) {
    existing.lastSeenAt = candidate.lastSeenAt;
  }
  existing.profileUrl ??= candidate.profileUrl;
}

function identityConditions(
  candidates: IdentityCandidate[],
  conflicts: Set<string>,
) {
  return [
    ...candidates.map(({ sourceProvider, sourceId }) => ({
      sourceProvider,
      sourceId,
    })),
    ...conflictWheres(conflicts),
  ];
}

function uniqueIdentityKeys(
  keys: Array<{ sourceProvider: string; sourceId: string }>,
) {
  return [
    ...new Map(
      keys.map((key) => [identityKey(key.sourceProvider, key.sourceId), key]),
    ).values(),
  ];
}

function conflictWheres(conflicts: Set<string>) {
  return [...conflicts].map((key) => {
    const [sourceProvider, sourceId] = key.split("\u0000", 2);
    return { sourceProvider, sourceId };
  });
}

function identityKey(provider: string, sourceId: string) {
  return `${provider}\u0000${sourceId}`;
}

async function writeIdentityConflicts(
  entityKind: "dog" | "trainer",
  conflicts: Set<string>,
) {
  if (conflicts.size === 0) return;
  await writeLiveFeedQuarantines(
    [...conflicts].map((key) => {
      const [provider, sourceId] = key.split("\u0000", 2);
      return {
        provider,
        entityKind,
        sourceId,
        reasonCode: "conflicting_provider_identity",
        classification: "conflict" as const,
        evidence: { provider, entityKind, sourceId },
      };
    }),
  );
}

function normalizeProvider(value: string | null | undefined) {
  const provider = value?.trim().toLowerCase();
  return provider && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(provider)
    ? provider
    : null;
}

function cleanSourceId(value: unknown) {
  const sourceId =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  return sourceId &&
    sourceId.length <= 256 &&
    !/[\u0000-\u001f\u007f]/.test(sourceId)
    ? sourceId
    : null;
}

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return text && text.length <= maximum ? text : null;
}

function cleanWeight(value: unknown) {
  const weight =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(weight) && weight >= 15 && weight <= 60 ? weight : null;
}

function normalizeName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toUpperCase();
}

function emptyEvidence(): RunnerProviderEvidence {
  return {
    dogSourceId: null,
    dogProfileUrl: null,
    trainerSourceId: null,
    trainerName: null,
    trainerProfileUrl: null,
    officialWeight: null,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
