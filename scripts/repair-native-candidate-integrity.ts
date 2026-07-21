import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Prisma, PrismaClient } from "@prisma/client";

const TARGET_PORT = 55_434;
const TARGET_DATABASE = "giq_production_candidate_20260716_r1";
const TARGET_DATA_DIRECTORY = "c:/greyhoundiq/native-postgres16/data";
const BATCH_SIZE = 1_000;
const MAX_RUNNERS_PER_GROUP = 100;
const MAX_EVIDENCE_BYTES = 2_048;
const EXPECTED_REPAIR_SCOPE = {
  duplicateGroups: 16,
  duplicateLosingOccurrences: 16,
  repairableDuplicateOccurrences: 15,
  duplicateConflictGroups: 1,
  orphanFormEntries: 101_059,
} as const;
const ENDPOINT_OVERRIDE_PARAMETERS = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "port",
  "socket",
]);

export type ResultCandidate = {
  id: string;
  runnerId: string;
  raceId: string;
  finishingPosition: number | null;
  runningTime: number | null;
  margin: number | null;
  prizeMoneyWon: number | null;
  splitTime: number | null;
  sectionals: string | null;
  gpsData: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
  sourceRawJson: string | null;
};

export type RunnerCandidate = {
  id: string;
  raceId: string;
  dogId: string;
  boxNumber: number;
  scratched: boolean;
  result: ResultCandidate | null;
};

export type DuplicatePlan = {
  winner: RunnerCandidate;
  losers: RunnerCandidate[];
  repairable: boolean;
  reasonCode: "duplicate_runner" | "duplicate_runner_result_conflict";
  fingerprint: string;
};

type DuplicateKey = { raceId: string; dogId: string; rowCount: number };
type CountRow = { groups: number; occurrences: number };
type FormEntryCandidate = { id: string; dogId: string; raceId: string };
type TargetIdentityRow = {
  database: string;
  port: number;
  dataDirectory: string;
  serverVersionNum: string;
};
export type ExistingRepairProgress = {
  repairedRunnerQuarantines: number;
  conflictingRunnerQuarantines: number;
  formEntryQuarantines: number;
  quarantinedFormEntriesStillOrphaned: number;
};
type QuarantineOccurrence = {
  id: string;
  observedAt: Date;
  provider: string;
  entityKind: string;
  sourceId: string;
  naturalIdentity: string;
  reasonCode: string;
  classification: "conflict" | "invalid";
  evidenceSha256: string;
  evidenceJson: string;
};

export function assertNativeCandidateUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NATIVE_CANDIDATE_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("NATIVE_CANDIDATE_DATABASE_URL must use PostgreSQL.");
  }
  if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname.toLowerCase())) {
    throw new Error("NATIVE_CANDIDATE_DATABASE_URL must use 127.0.0.1 or localhost.");
  }
  if (Number(url.port || 5432) !== TARGET_PORT) {
    throw new Error(`NATIVE_CANDIDATE_DATABASE_URL must use native port ${TARGET_PORT}.`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (database !== TARGET_DATABASE) {
    throw new Error(`NATIVE_CANDIDATE_DATABASE_URL must name ${TARGET_DATABASE}.`);
  }
  for (const parameter of url.searchParams.keys()) {
    if (ENDPOINT_OVERRIDE_PARAMETERS.has(parameter.toLowerCase())) {
      throw new Error("NATIVE_CANDIDATE_DATABASE_URL must not override its endpoint.");
    }
  }
  return { host: url.hostname.toLowerCase(), port: TARGET_PORT, database };
}

export function parseRepairArguments(args: string[]) {
  if (args.length === 0) return { apply: false };
  if (args.length === 1 && args[0] === "--apply") return { apply: true };
  throw new Error("Usage: npm run db:native-candidate:repair-integrity -- [--apply]");
}

export function compareRunnerCandidates(
  left: RunnerCandidate,
  right: RunnerCandidate,
) {
  return (
    Number(Boolean(right.result)) - Number(Boolean(left.result)) ||
    Number(left.scratched) - Number(right.scratched) ||
    Number(!isActiveBox(left.boxNumber)) - Number(!isActiveBox(right.boxNumber)) ||
    left.boxNumber - right.boxNumber ||
    left.id.localeCompare(right.id)
  );
}

export function resultsAreCompatible(
  left: ResultCandidate,
  right: ResultCandidate,
) {
  return resultComparableFields(left).every((value, index) =>
    Object.is(value, resultComparableFields(right)[index]),
  );
}

export function planDuplicateGroup(rows: RunnerCandidate[]): DuplicatePlan {
  if (rows.length < 2) throw new Error("Duplicate planning requires at least two runners.");
  const [winner, ...losers] = [...rows].sort(compareRunnerCandidates);
  const repairable = losers.every(
    (loser) =>
      !loser.result ||
      Boolean(winner.result && resultsAreCompatible(winner.result, loser.result)),
  );
  const reasonCode = repairable
    ? "duplicate_runner"
    : "duplicate_runner_result_conflict";
  return {
    winner,
    losers,
    repairable,
    reasonCode,
    fingerprint: sha256(
      JSON.stringify({
        winner: runnerFingerprint(winner),
        losers: losers.map(runnerFingerprint),
        repairable,
      }),
    ),
  };
}

export function deterministicQuarantineId(seed: string) {
  const bytes = Buffer.from(sha256(seed).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function assertExpectedRepairScope(scope: {
  duplicateGroups: number;
  duplicateLosingOccurrences: number;
  repairableDuplicateOccurrences: number;
  duplicateConflictGroups: number;
  orphanFormEntries: number;
}, progress: ExistingRepairProgress = {
  repairedRunnerQuarantines: 0,
  conflictingRunnerQuarantines: 0,
  formEntryQuarantines: 0,
  quarantinedFormEntriesStillOrphaned: 0,
}) {
  const runnerScopeIsOriginal =
    scope.duplicateGroups === EXPECTED_REPAIR_SCOPE.duplicateGroups &&
    scope.duplicateLosingOccurrences === EXPECTED_REPAIR_SCOPE.duplicateLosingOccurrences &&
    scope.repairableDuplicateOccurrences === EXPECTED_REPAIR_SCOPE.repairableDuplicateOccurrences &&
    scope.duplicateConflictGroups === EXPECTED_REPAIR_SCOPE.duplicateConflictGroups &&
    progress.repairedRunnerQuarantines === 0 &&
    progress.conflictingRunnerQuarantines === 0;
  const runnerScopeIsRepaired =
    scope.duplicateGroups === 1 &&
    scope.duplicateLosingOccurrences === 1 &&
    scope.repairableDuplicateOccurrences === 0 &&
    scope.duplicateConflictGroups === 1 &&
    progress.repairedRunnerQuarantines === 15 &&
    progress.conflictingRunnerQuarantines === 1;
  if (!runnerScopeIsOriginal && !runnerScopeIsRepaired) {
    throw new Error(
      "Native candidate Runner repair scope changed; rerun the dry audit and review before --apply.",
    );
  }

  const reconstructedFormEntryScope =
    scope.orphanFormEntries +
    progress.formEntryQuarantines -
    progress.quarantinedFormEntriesStillOrphaned;
  if (
    scope.orphanFormEntries < 0 ||
    progress.formEntryQuarantines < 0 ||
    progress.quarantinedFormEntriesStillOrphaned < 0 ||
    progress.quarantinedFormEntriesStillOrphaned > scope.orphanFormEntries ||
    progress.quarantinedFormEntriesStillOrphaned > progress.formEntryQuarantines ||
    progress.formEntryQuarantines > EXPECTED_REPAIR_SCOPE.orphanFormEntries ||
    reconstructedFormEntryScope !== EXPECTED_REPAIR_SCOPE.orphanFormEntries
  ) {
    throw new Error(
      "Native candidate FormEntry repair scope changed; rerun the dry audit and review before --apply.",
    );
  }
}

export function assertNativeCandidateIdentity(row: TargetIdentityRow) {
  const dataDirectory = row.dataDirectory
    .replace(/\\/gu, "/")
    .replace(/\/+$/u, "")
    .toLowerCase();
  const version = Number(row.serverVersionNum);
  if (
    row.database !== TARGET_DATABASE ||
    Number(row.port) !== TARGET_PORT ||
    dataDirectory !== TARGET_DATA_DIRECTORY ||
    !Number.isInteger(version) ||
    version < 160_000 ||
    version >= 170_000
  ) {
    throw new Error("Connected PostgreSQL instance is not the verified native candidate.");
  }
}

async function runRepair(databaseUrl: string, apply: boolean) {
  const target = assertNativeCandidateUrl(databaseUrl);
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", "greyhoundiq_native_candidate_integrity_repair");
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("connect_timeout", "10");
  url.searchParams.set("pool_timeout", "10");
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  try {
    await verifyTarget(prisma, apply);
    const beforeDuplicates = await countDuplicateRunners(prisma);
    const beforeFormEntries = await countOrphanFormEntries(prisma);
    const planned = await scanDuplicatePlans(prisma);
    const report = {
      mode: apply ? "apply" : "dry-run",
      target,
      runners: {
        beforeGroups: beforeDuplicates.groups,
        beforeLosingOccurrences: beforeDuplicates.occurrences,
        plannedQuarantines: planned.losingOccurrences,
        plannedMutations: planned.repairableOccurrences,
        conflictGroups: planned.conflictGroups,
        appliedQuarantines: 0,
        appliedMutations: 0,
        remainingGroups: beforeDuplicates.groups,
        remainingLosingOccurrences: beforeDuplicates.occurrences,
      },
      formEntries: {
        before: beforeFormEntries,
        plannedQuarantines: beforeFormEntries,
        plannedMutations: beforeFormEntries,
        appliedQuarantines: 0,
        appliedMutations: 0,
        remaining: beforeFormEntries,
      },
    };

    if (apply) {
      const progress = await loadExistingRepairProgress(prisma);
      assertExpectedRepairScope({
        duplicateGroups: beforeDuplicates.groups,
        duplicateLosingOccurrences: beforeDuplicates.occurrences,
        repairableDuplicateOccurrences: planned.repairableOccurrences,
        duplicateConflictGroups: planned.conflictGroups,
        orphanFormEntries: beforeFormEntries,
      }, progress);
      const runnerApplied = await applyDuplicateRepairs(prisma);
      const formApplied = await applyOrphanFormEntryRepairs(prisma);
      const remainingDuplicates = await countDuplicateRunners(prisma);
      const remainingFormEntries = await countOrphanFormEntries(prisma);
      report.runners.appliedQuarantines = runnerApplied.quarantines;
      report.runners.appliedMutations = runnerApplied.mutations;
      report.runners.remainingGroups = remainingDuplicates.groups;
      report.runners.remainingLosingOccurrences = remainingDuplicates.occurrences;
      report.formEntries.appliedQuarantines = formApplied.quarantines;
      report.formEntries.appliedMutations = formApplied.mutations;
      report.formEntries.remaining = remainingFormEntries;
    }

    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyTarget(prisma: PrismaClient, apply: boolean) {
  const rows = await prisma.$queryRaw<TargetIdentityRow[]>`
    SELECT
      current_database() AS "database",
      inet_server_port()::int AS "port",
      current_setting('data_directory') AS "dataDirectory",
      current_setting('server_version_num') AS "serverVersionNum"
  `;
  if (rows.length !== 1) throw new Error("Native candidate identity query failed.");
  assertNativeCandidateIdentity(rows[0]);
  if (!apply) return;
  const quarantine = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public."LiveFeedQuarantine"')::text AS "tableName"
  `;
  if (quarantine[0]?.tableName !== '"LiveFeedQuarantine"') {
    throw new Error("LiveFeedQuarantine must exist before --apply.");
  }
}

async function scanDuplicatePlans(prisma: PrismaClient) {
  let cursor: Pick<DuplicateKey, "raceId" | "dogId"> | null = null;
  let repairableOccurrences = 0;
  let losingOccurrences = 0;
  let conflictGroups = 0;
  while (true) {
    const groups = await duplicateGroupBatch(prisma, cursor);
    if (groups.length === 0) break;
    for (const group of groups) {
      const rows = await loadDuplicateGroup(prisma, group);
      const plan = planDuplicateGroup(rows);
      losingOccurrences += plan.losers.length;
      if (plan.repairable) repairableOccurrences += plan.losers.length;
      else conflictGroups += 1;
    }
    cursor = groups.at(-1)!;
  }
  return { repairableOccurrences, losingOccurrences, conflictGroups };
}

async function applyDuplicateRepairs(prisma: PrismaClient) {
  let cursor: Pick<DuplicateKey, "raceId" | "dogId"> | null = null;
  let quarantines = 0;
  let mutations = 0;
  while (true) {
    const groups = await duplicateGroupBatch(prisma, cursor);
    if (groups.length === 0) break;
    for (const group of groups) {
      const plan = planDuplicateGroup(await loadDuplicateGroup(prisma, group));
      const occurrences = runnerQuarantines(plan);
      quarantines += await persistQuarantines(prisma, occurrences);
      if (plan.repairable) mutations += await mutateDuplicateGroup(prisma, plan);
    }
    cursor = groups.at(-1)!;
  }
  return { quarantines, mutations };
}

async function mutateDuplicateGroup(prisma: PrismaClient, expected: DuplicatePlan) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.system', 'true', true)`;
      const currentRows = await tx.runner.findMany({
        where: { raceId: expected.winner.raceId, dogId: expected.winner.dogId },
        include: { result: true },
        orderBy: { id: "asc" },
        take: MAX_RUNNERS_PER_GROUP + 1,
      });
      if (currentRows.length < 2 || currentRows.length > MAX_RUNNERS_PER_GROUP) return 0;
      const current = planDuplicateGroup(currentRows as RunnerCandidate[]);
      if (
        !current.repairable ||
        current.fingerprint !== expected.fingerprint ||
        current.winner.id !== expected.winner.id
      ) {
        return 0;
      }
      const resultGuards = current.losers.flatMap((runner) =>
        runner.result ? [{ id: runner.result.id, runnerId: runner.id }] : [],
      );
      if (resultGuards.length > 0) {
        const deleted = await tx.result.deleteMany({ where: { OR: resultGuards } });
        if (deleted.count !== resultGuards.length) throw new Error("Duplicate Result guard changed.");
      }
      const deleted = await tx.runner.deleteMany({
        where: {
          OR: current.losers.map((runner) => ({
            id: runner.id,
            raceId: runner.raceId,
            dogId: runner.dogId,
            boxNumber: runner.boxNumber,
            scratched: runner.scratched,
          })),
        },
      });
      if (deleted.count !== current.losers.length) throw new Error("Duplicate Runner guard changed.");
      const remaining = await tx.runner.findMany({
        where: { raceId: current.winner.raceId, dogId: current.winner.dogId },
        select: { id: true },
        take: 2,
      });
      if (remaining.length !== 1 || remaining[0].id !== current.winner.id) {
        throw new Error("Duplicate Runner repair did not preserve exactly the selected winner.");
      }
      return deleted.count;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
  );
}

async function applyOrphanFormEntryRepairs(prisma: PrismaClient) {
  let cursor: string | null = null;
  let quarantines = 0;
  let mutations = 0;
  while (true) {
    const rows = await orphanFormEntryBatch(prisma, cursor);
    if (rows.length === 0) break;
    const occurrences = rows.map(formEntryQuarantine);
    quarantines += await persistQuarantines(prisma, occurrences);
    mutations += await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.system', 'true', true)`;
        return tx.$executeRaw`
          WITH candidates("id", "dogId", "raceId") AS (
            VALUES ${Prisma.join(
              rows.map((row) => Prisma.sql`(
                CAST(${row.id} AS text),
                CAST(${row.dogId} AS text),
                CAST(${row.raceId} AS text)
              )`),
            )}
          )
          UPDATE "FormEntry" AS form_entry
          SET "raceId" = NULL
          FROM candidates
          WHERE form_entry."id" = candidates."id"
            AND form_entry."dogId" = candidates."dogId"
            AND form_entry."raceId" = candidates."raceId"
            AND NOT EXISTS (
              SELECT 1 FROM "Runner" AS runner
              WHERE runner."raceId" = form_entry."raceId"
                AND runner."dogId" = form_entry."dogId"
            )
        `;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    );
    cursor = rows.at(-1)!.id;
  }
  return { quarantines, mutations };
}

async function loadExistingRepairProgress(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<ExistingRepairProgress[]>`
    SELECT
      COUNT(*) FILTER (
        WHERE quarantine."entityKind" = 'runner'
          AND quarantine."reasonCode" = 'duplicate_runner'
      )::int AS "repairedRunnerQuarantines",
      COUNT(*) FILTER (
        WHERE quarantine."entityKind" = 'runner'
          AND quarantine."reasonCode" = 'duplicate_runner_result_conflict'
      )::int AS "conflictingRunnerQuarantines",
      COUNT(*) FILTER (
        WHERE quarantine."entityKind" = 'form_entry'
          AND quarantine."reasonCode" = 'form_entry_runner_missing'
      )::int AS "formEntryQuarantines",
      COUNT(*) FILTER (
        WHERE quarantine."entityKind" = 'form_entry'
          AND quarantine."reasonCode" = 'form_entry_runner_missing'
          AND EXISTS (
            SELECT 1
            FROM "FormEntry" AS form_entry
            WHERE form_entry."id" = quarantine."sourceId"
              AND form_entry."raceId" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM "Runner" AS runner
                WHERE runner."raceId" = form_entry."raceId"
                  AND runner."dogId" = form_entry."dogId"
              )
          )
      )::int AS "quarantinedFormEntriesStillOrphaned"
    FROM "LiveFeedQuarantine" AS quarantine
    WHERE quarantine."provider" = 'native_candidate'
  `;
  return rows[0] ?? {
    repairedRunnerQuarantines: 0,
    conflictingRunnerQuarantines: 0,
    formEntryQuarantines: 0,
    quarantinedFormEntriesStillOrphaned: 0,
  };
}

async function persistQuarantines(
  prisma: PrismaClient,
  occurrences: QuarantineOccurrence[],
) {
  if (occurrences.length === 0) return 0;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.system', 'true', true)`;
    const inserted = await tx.$executeRaw`
      INSERT INTO "LiveFeedQuarantine"
        ("id", "observedAt", "provider", "entityKind", "sourceId", "naturalIdentity",
         "reasonCode", "classification", "evidenceSha256", "evidenceJson")
      VALUES ${Prisma.join(
        occurrences.map((row) => Prisma.sql`(
          ${row.id}, ${row.observedAt}, ${row.provider}, ${row.entityKind}, ${row.sourceId},
          ${row.naturalIdentity}, ${row.reasonCode}, ${row.classification},
          ${row.evidenceSha256}, ${row.evidenceJson}
        )`),
      )}
      ON CONFLICT ("id") DO NOTHING
    `;
    const durable = await tx.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "LiveFeedQuarantine"
      WHERE "id" IN (${Prisma.join(occurrences.map((row) => row.id))})
    `;
    if (durable[0]?.count !== occurrences.length) {
      throw new Error("Quarantine durability check failed; mutation was not attempted.");
    }
    return inserted;
  });
}

async function duplicateGroupBatch(
  prisma: PrismaClient,
  cursor: Pick<DuplicateKey, "raceId" | "dogId"> | null,
) {
  const after = cursor
    ? Prisma.sql`WHERE ("raceId" > ${cursor.raceId} OR ("raceId" = ${cursor.raceId} AND "dogId" > ${cursor.dogId}))`
    : Prisma.empty;
  return prisma.$queryRaw<DuplicateKey[]>(Prisma.sql`
    SELECT "raceId", "dogId", COUNT(*)::int AS "rowCount"
    FROM "Runner"
    ${after}
    GROUP BY "raceId", "dogId"
    HAVING COUNT(*) > 1
    ORDER BY "raceId", "dogId"
    LIMIT ${BATCH_SIZE}
  `);
}

async function loadDuplicateGroup(prisma: PrismaClient, group: DuplicateKey) {
  const rows = await prisma.runner.findMany({
    where: { raceId: group.raceId, dogId: group.dogId },
    include: { result: true },
    orderBy: { id: "asc" },
    take: MAX_RUNNERS_PER_GROUP + 1,
  });
  if (rows.length !== group.rowCount || rows.length > MAX_RUNNERS_PER_GROUP) {
    throw new Error(
      `Duplicate Runner group changed or exceeds the ${MAX_RUNNERS_PER_GROUP}-row safety bound; rerun after operator review.`,
    );
  }
  return rows as RunnerCandidate[];
}

async function countDuplicateRunners(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS "groups", COALESCE(SUM(grouped."rowCount" - 1), 0)::int AS "occurrences"
    FROM (
      SELECT COUNT(*)::int AS "rowCount"
      FROM "Runner"
      GROUP BY "raceId", "dogId"
      HAVING COUNT(*) > 1
    ) AS grouped
  `;
  return rows[0] ?? { groups: 0, occurrences: 0 };
}

async function countOrphanFormEntries(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM "FormEntry" AS form_entry
    WHERE form_entry."raceId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Runner" AS runner
        WHERE runner."raceId" = form_entry."raceId"
          AND runner."dogId" = form_entry."dogId"
      )
  `;
  return rows[0]?.count ?? 0;
}

async function orphanFormEntryBatch(prisma: PrismaClient, cursor: string | null) {
  const after = cursor ? Prisma.sql`AND form_entry."id" > ${cursor}` : Prisma.empty;
  return prisma.$queryRaw<FormEntryCandidate[]>(Prisma.sql`
    SELECT form_entry."id", form_entry."dogId", form_entry."raceId"
    FROM "FormEntry" AS form_entry
    WHERE form_entry."raceId" IS NOT NULL
      ${after}
      AND NOT EXISTS (
        SELECT 1 FROM "Runner" AS runner
        WHERE runner."raceId" = form_entry."raceId"
          AND runner."dogId" = form_entry."dogId"
      )
    ORDER BY form_entry."id"
    LIMIT ${BATCH_SIZE}
  `);
}

function runnerQuarantines(plan: DuplicatePlan) {
  return plan.losers.map((loser) =>
    quarantineOccurrence({
      entityKind: "runner",
      sourceId: loser.id,
      naturalIdentity: `${loser.raceId}:${loser.dogId}`,
      reasonCode: plan.reasonCode,
      classification: "conflict",
      evidence: {
        raceId: loser.raceId,
        dogId: loser.dogId,
        selectedRunnerId: plan.winner.id,
        discardedRunnerId: loser.id,
        selectedBoxNumber: plan.winner.boxNumber,
        discardedBoxNumber: loser.boxNumber,
        selectedResultId: plan.winner.result?.id ?? null,
        discardedResultId: loser.result?.id ?? null,
        resultFieldsCompatible: plan.repairable,
        planFingerprint: plan.fingerprint,
      },
    }),
  );
}

function formEntryQuarantine(row: FormEntryCandidate) {
  return quarantineOccurrence({
    entityKind: "form_entry",
    sourceId: row.id,
    naturalIdentity: `${row.dogId}:${row.raceId}`,
    reasonCode: "form_entry_runner_missing",
    classification: "invalid",
    evidence: { formEntryId: row.id, dogId: row.dogId, raceId: row.raceId },
  });
}

function quarantineOccurrence(input: {
  entityKind: string;
  sourceId: string;
  naturalIdentity: string;
  reasonCode: string;
  classification: "conflict" | "invalid";
  evidence: Record<string, unknown>;
}) {
  const evidenceJson = JSON.stringify(input.evidence);
  if (Buffer.byteLength(evidenceJson) > MAX_EVIDENCE_BYTES) {
    throw new Error("Repair quarantine evidence exceeded its safety bound.");
  }
  const evidenceSha256 = sha256(evidenceJson);
  return {
    id: deterministicQuarantineId(
      [input.entityKind, input.sourceId, input.reasonCode, evidenceSha256].join(":"),
    ),
    observedAt: new Date(),
    provider: "native_candidate",
    ...input,
    evidenceSha256,
    evidenceJson,
  } satisfies QuarantineOccurrence;
}

function isActiveBox(boxNumber: number) {
  return boxNumber >= 1 && boxNumber <= 8;
}

function resultComparableFields(result: ResultCandidate) {
  return [
    result.raceId,
    result.finishingPosition,
    result.runningTime,
    result.margin,
    result.prizeMoneyWon,
    result.splitTime,
    result.sectionals,
    result.gpsData,
    result.sourceProvider,
    result.sourceId,
    result.sourceRawJson,
  ];
}

function runnerFingerprint(runner: RunnerCandidate) {
  return {
    id: runner.id,
    raceId: runner.raceId,
    dogId: runner.dogId,
    boxNumber: runner.boxNumber,
    scratched: runner.scratched,
    result: runner.result
      ? { id: runner.result.id, fieldsSha256: sha256(JSON.stringify(resultComparableFields(runner.result))) }
      : null,
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeDiagnostic(value: unknown) {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, "<redacted-database-connection>")
    .replace(/\b(password|secret|token)\s*[=:]\s*[^\s,;]+/giu, "$1=<redacted>");
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry) && resolve(entry) === fileURLToPath(import.meta.url);
}

async function main() {
  try {
    const { apply } = parseRepairArguments(process.argv.slice(2));
    const databaseUrl = process.env.NATIVE_CANDIDATE_DATABASE_URL;
    if (!databaseUrl) throw new Error("NATIVE_CANDIDATE_DATABASE_URL is required explicitly.");
    console.log(JSON.stringify(await runRepair(databaseUrl, apply), null, 2));
  } catch (error) {
    console.error(`Native candidate integrity repair failed: ${sanitizeDiagnostic(error)}`);
    process.exitCode = 1;
  }
}

if (isMainModule()) void main();
