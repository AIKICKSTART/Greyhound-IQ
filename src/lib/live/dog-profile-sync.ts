import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

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
const DOG_IDENTITY_QUERY_LIMIT = 5_000;
const PAUSE_MS = 500;
const THEDOGS_PROVIDER = "thedogs";
const THEDOGS_ORIGIN = new URL(
  process.env.THEDOGS_BASE_URL ?? "https://www.thedogs.com.au",
).origin;
// Canonical writes stay unavailable until append-only profile provenance exists
// and the pedigree migration has passed an isolated runtime rehearsal.
const LIVE_PROFILE_CANONICAL_WRITES_ENABLED = false;
const MAX_PROFILE_FORM_ROWS = 5_000;
const MAX_PROFILE_JSON_BYTES = 5 * 1024 * 1024;
const MAX_FORM_JSON_BYTES = 256 * 1024;
const MAX_FIELD_DECISIONS_JSON_BYTES = 5 * 1024 * 1024;
const EARLIEST_PROVIDER_DATE = new Date("1900-01-01T00:00:00.000Z");
const EARLIEST_OBSERVATION_DATE = new Date("2000-01-01T00:00:00.000Z");
const PLACEHOLDER_NAMES = new Set([
  "n a",
  "na",
  "not available",
  "placeholder",
  "tbd",
  "test",
  "test dog",
  "unknown",
  "unknown dog",
  "unnamed",
]);

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
  sourceProvider: string | null;
  sourceId: string | null;
  profileUrl: string | null;
};

export type DogProfileObservationOccurrence = {
  id: string;
  observedAt: Date;
  requestUrl: string;
  requestSha256: string;
  evidenceJson: string;
  evidenceSha256: string;
};

type FieldDecision = {
  field: string;
  decision: "accepted" | "no_change" | "preserved";
  reasonCode: string;
};

type ResolvedProfileParents = {
  sireId: string | null;
  damId: string | null;
};

type FormMergeResult = {
  mutated: boolean;
  decisions: FieldDecision[];
};

export async function syncDogProfilesBatch(
  opts: SyncOptions = {},
): Promise<SyncResult> {
  if (!LIVE_PROFILE_CANONICAL_WRITES_ENABLED) {
    throw new Error(
      "dog_profile_sync.disabled_pending_provenance_and_migration_rehearsal",
    );
  }
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
        sourceProvider: true,
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
      const occurrence = createProfileObservationOccurrence(profile);
      await withDbSystemContext((tx) =>
        saveProfile(tx, dog.id, profile, occurrence),
      );
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

export async function fetchProfileForDog(
  provider: Pick<
    TheDogsDogProfileProvider,
    "fetchProfile" | "fetchFullForm"
  >,
  dog: DogSeed,
): Promise<TheDogsDogProfile> {
  const profileSourceId = profileIdFor(dog);
  if (!profileSourceId) {
    throw new Error(`Missing The Dogs source id for ${dog.id}`);
  }
  const profilePath = dog.profileUrl
    ? new URL(dog.profileUrl).pathname
    : buildTheDogsProfilePath(profileSourceId, dog.name);
  assertBoundProfilePath(profilePath, profileSourceId);
  const profileHtml = await provider.fetchProfile(profilePath);
  assertExactTheDogsProfilePageIdentity(profileHtml, profileSourceId);
  const showMorePath = exactFullFormPath(
    parseShowMorePath(profileHtml),
    profileSourceId,
  );
  const fullFormHtml = showMorePath
    ? await provider.fetchFullForm(showMorePath)
    : "";
  if (showMorePath && !fullFormHtml.trim()) {
    throw new Error("The Dogs full-form evidence is empty");
  }
  return parseTheDogsDogProfile(
    profileHtml,
    profileSourceId,
    profilePath,
    fullFormHtml,
  );
}

export function createProfileObservationOccurrence(
  profile: TheDogsDogProfile,
  overrides: { id?: string; observedAt?: Date } = {},
): DogProfileObservationOccurrence {
  assertProfilePayload(profile);
  const evidenceJson = buildProfileEvidenceJson(profile);
  const occurrence = {
    id: overrides.id ?? randomUUID(),
    observedAt: overrides.observedAt ?? new Date(),
    requestUrl: profile.profileUrl,
    requestSha256: sha256(
      `${profile.sourceProvider}\u0000${profile.sourceId}\u0000${profile.profileUrl}`,
    ),
    evidenceJson,
    evidenceSha256: sha256(evidenceJson),
  };
  assertProfileObservationOccurrence(profile, occurrence);
  return occurrence;
}

export async function saveProfile(
  tx: DbContextClient,
  dogId: string,
  profile: TheDogsDogProfile,
  occurrence: DogProfileObservationOccurrence =
    createProfileObservationOccurrence(profile),
) {
  assertProfilePayload(profile);
  assertProfileObservationOccurrence(profile, occurrence);
  await tx.$queryRaw`
    SELECT "id"
    FROM "Dog"
    WHERE "id" = ${dogId}
    FOR UPDATE
  `;
  const canonicalDogId = await resolveExactDogIdentity(tx, profile.sourceId);
  if (!canonicalDogId) {
    throw new Error("The Dogs profile has no exact canonical dog identity");
  }
  if (canonicalDogId !== dogId) {
    throw new Error("The Dogs profile resolves to a different canonical dog");
  }
  if (await occurrenceRetryAlreadyCompleted(tx, dogId, profile, occurrence)) {
    return;
  }

  const current = await tx.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      name: true,
      earBrand: true,
      colour: true,
      sex: true,
      whelpDate: true,
      sireId: true,
      damId: true,
      trainerId: true,
      sourceProvider: true,
      sourceId: true,
      profileUrl: true,
      ownerName: true,
      careerStarts: true,
      careerWins: true,
      careerSeconds: true,
      careerThirds: true,
      prizeMoney: true,
      winPercentage: true,
      placePercentage: true,
      profileStatsJson: true,
      bestTimesJson: true,
      boxHistoryJson: true,
      distanceHistoryJson: true,
      profileSourceRawJson: true,
      lastProfileSyncedAt: true,
    },
  });
  if (!current) throw new Error("Canonical dog disappeared during profile sync");

  const resolvedParents = await resolveProfileParents(tx, profile, dogId);
  const decisions: FieldDecision[] = [];
  const dogUpdate: Prisma.DogUncheckedUpdateInput = {};

  recordCanonicalNameDecision(decisions, current.name, profile.name);
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "earBrand",
    current.earBrand,
    `${THEDOGS_PROVIDER}:${profile.sourceId}`,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "colour",
    current.colour,
    profile.colour,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "sex",
    current.sex,
    profile.sex,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "whelpDate",
    current.whelpDate,
    profile.whelpDate,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "sourceProvider",
    current.sourceProvider,
    profile.sourceProvider,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "sourceId",
    current.sourceId,
    profile.sourceId,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "profileUrl",
    current.profileUrl,
    profile.profileUrl,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "ownerName",
    current.ownerName,
    profile.ownerName,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "careerStarts",
    current.careerStarts,
    profile.careerStarts,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "careerWins",
    current.careerWins,
    profile.careerWins,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "careerSeconds",
    current.careerSeconds,
    profile.careerSeconds,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "careerThirds",
    current.careerThirds,
    profile.careerThirds,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "prizeMoney",
    current.prizeMoney,
    profile.prizeMoney,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "winPercentage",
    current.winPercentage,
    profile.winPercentage,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "placePercentage",
    current.placePercentage,
    profile.placePercentage,
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "profileStatsJson",
    current.profileStatsJson,
    sanitizeRawJson(profile.profileStatsJson),
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "bestTimesJson",
    current.bestTimesJson,
    sanitizeRawJson(profile.bestTimesJson),
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "boxHistoryJson",
    current.boxHistoryJson,
    sanitizeRawJson(profile.boxHistoryJson),
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "distanceHistoryJson",
    current.distanceHistoryJson,
    sanitizeRawJson(profile.distanceHistoryJson),
  );
  decideMissingCanonicalValue(
    dogUpdate,
    decisions,
    "profileSourceRawJson",
    current.profileSourceRawJson,
    sanitizeRawJson(profile.profileSourceRawJson),
  );

  recordRelationshipDecision(
    decisions,
    "sireId",
    current.sireId,
    resolvedParents.sireId,
    profile.sire !== undefined,
  );
  recordRelationshipDecision(
    decisions,
    "damId",
    current.damId,
    resolvedParents.damId,
    profile.dam !== undefined,
  );
  decisions.push(
    profile.trainerName === undefined
      ? {
          field: "trainerId",
          decision: "no_change",
          reasonCode: "provider_trainer_absent",
        }
      : {
          field: "trainerId",
          decision: "preserved",
          reasonCode: "trainer_identity_unresolved",
        },
  );

  const parentEvidenceMatchesCanonical =
    resolvedParents.sireId !== null &&
    resolvedParents.damId !== null &&
    current.sireId === resolvedParents.sireId &&
    current.damId === resolvedParents.damId;
  const profileEvidenceComplete =
    parentEvidenceMatchesCanonical &&
    profile.trainerName === undefined &&
    profile.formRows.length > 0;
  if (profileEvidenceComplete && current.lastProfileSyncedAt === null) {
    dogUpdate.lastProfileSyncedAt = occurrence.observedAt;
    decisions.push({
      field: "lastProfileSyncedAt",
      decision: "accepted",
      reasonCode: "complete_evidence_matches_canonical",
    });
  } else if (profileEvidenceComplete) {
    decisions.push({
      field: "lastProfileSyncedAt",
      decision: "no_change",
      reasonCode: "profile_already_complete",
    });
  } else {
    decisions.push({
      field: "lastProfileSyncedAt",
      decision: "preserved",
      reasonCode: "profile_evidence_incomplete",
    });
  }

  await tx.dogProfileObservation.create({
    data: {
      id: occurrence.id,
      dogId,
      sourceProvider: profile.sourceProvider,
      sourceId: profile.sourceId,
      requestUrl: occurrence.requestUrl,
      requestSha256: occurrence.requestSha256,
      observedAt: occurrence.observedAt,
      evidenceSha256: occurrence.evidenceSha256,
      evidenceJson: occurrence.evidenceJson,
      verificationStatus: "verified",
    },
  });

  let canonicalMutated = false;
  if (Object.keys(dogUpdate).length > 0) {
    await tx.dog.update({ where: { id: dogId }, data: dogUpdate });
    canonicalMutated = true;
  }

  for (const row of profile.formRows) {
    const result = await mergeProfileForm(
      tx,
      dogId,
      profile.sourceProvider,
      row,
    );
    canonicalMutated ||= result.mutated;
    decisions.push(...result.decisions);
  }

  const decision = canonicalMutated
    ? "accepted"
    : decisions.some((entry) => entry.decision === "preserved")
      ? "preserved"
      : "no_change";
  const fieldDecisionsJson = JSON.stringify(decisions);
  assertFieldDecisionsJson(fieldDecisionsJson);
  await tx.dogProfileMergeLedger.create({
    data: {
      observationId: occurrence.id,
      dogId,
      sourceProvider: profile.sourceProvider,
      sourceId: profile.sourceId,
      requestSha256: occurrence.requestSha256,
      evidenceSha256: occurrence.evidenceSha256,
      decision,
      reasonCode:
        decision === "accepted"
          ? "verified_fields_accepted"
          : decision === "preserved"
            ? "verified_observation_preserved"
            : "verified_observation_no_change",
      verificationStatus: "verified",
      fieldDecisionsJson,
    },
  });
}

export async function resolveExactDogIdentity(
  tx: DbContextClient,
  sourceId: string,
) {
  if (!/^\d+$/.test(sourceId)) {
    throw new Error("The Dogs source identity must be numeric");
  }
  const earBrand = `${THEDOGS_PROVIDER}:${sourceId}`;
  const [dogs, identityClaims] = await Promise.all([
    tx.dog.findMany({
      where: {
        OR: [
          { sourceProvider: THEDOGS_PROVIDER, sourceId },
          { earBrand },
        ],
      },
      select: {
        id: true,
        sourceProvider: true,
        sourceId: true,
        earBrand: true,
      },
      take: DOG_IDENTITY_QUERY_LIMIT,
    }),
    tx.dogSourceIdentity.findMany({
      where: { sourceProvider: THEDOGS_PROVIDER, sourceId },
      select: { dogId: true, verificationStatus: true },
      take: DOG_IDENTITY_QUERY_LIMIT,
    }),
  ]);

  if (
    dogs.length >= DOG_IDENTITY_QUERY_LIMIT ||
    identityClaims.length >= DOG_IDENTITY_QUERY_LIMIT
  ) {
    throw new Error("The Dogs identity lookup exceeded its safe bound");
  }

  for (const dog of dogs) {
    const providerMatch =
      dog.sourceProvider === THEDOGS_PROVIDER && dog.sourceId === sourceId;
    const earBrandMatch = dog.earBrand === earBrand;
    if (
      (providerMatch && dog.earBrand != null && !earBrandMatch) ||
      (earBrandMatch &&
        ((dog.sourceProvider != null &&
          dog.sourceProvider !== THEDOGS_PROVIDER) ||
          (dog.sourceId != null && dog.sourceId !== sourceId)))
    ) {
      throw new Error("Conflicting direct The Dogs identity claim");
    }
  }

  if (
    identityClaims.some(
      (claim) =>
        claim.dogId == null || claim.verificationStatus !== "verified",
    )
  ) {
    throw new Error("Unlinked or nonverified The Dogs identity claim");
  }

  const dogIds = new Set([
    ...dogs.map((dog) => dog.id),
    ...identityClaims.map((claim) => claim.dogId as string),
  ]);
  if (dogIds.size > 1) {
    throw new Error("Ambiguous canonical The Dogs identity");
  }
  return dogIds.values().next().value ?? null;
}

async function occurrenceRetryAlreadyCompleted(
  tx: DbContextClient,
  dogId: string,
  profile: TheDogsDogProfile,
  occurrence: DogProfileObservationOccurrence,
) {
  const existing = await tx.dogProfileObservation.findUnique({
    where: { id: occurrence.id },
    select: {
      dogId: true,
      sourceProvider: true,
      sourceId: true,
      requestUrl: true,
      requestSha256: true,
      observedAt: true,
      evidenceSha256: true,
      evidenceJson: true,
      verificationStatus: true,
    },
  });
  if (!existing) return false;
  if (
    existing.dogId !== dogId ||
    existing.sourceProvider !== profile.sourceProvider ||
    existing.sourceId !== profile.sourceId ||
    existing.requestUrl !== occurrence.requestUrl ||
    existing.requestSha256 !== occurrence.requestSha256 ||
    existing.observedAt.getTime() !== occurrence.observedAt.getTime() ||
    existing.evidenceSha256 !== occurrence.evidenceSha256 ||
    existing.evidenceJson !== occurrence.evidenceJson ||
    existing.verificationStatus !== "verified"
  ) {
    throw new Error("Dog profile occurrence payload drift detected");
  }
  const ledger = await tx.dogProfileMergeLedger.findUnique({
    where: { observationId: occurrence.id },
    select: {
      dogId: true,
      sourceProvider: true,
      sourceId: true,
      requestSha256: true,
      evidenceSha256: true,
      verificationStatus: true,
    },
  });
  if (!ledger) {
    throw new Error("Dog profile occurrence has no completed merge decision");
  }
  if (
    ledger.dogId !== dogId ||
    ledger.sourceProvider !== profile.sourceProvider ||
    ledger.sourceId !== profile.sourceId ||
    ledger.requestSha256 !== occurrence.requestSha256 ||
    ledger.evidenceSha256 !== occurrence.evidenceSha256 ||
    ledger.verificationStatus !== "verified"
  ) {
    throw new Error("Dog profile occurrence merge binding drift detected");
  }
  return true;
}

async function resolveProfileParents(
  tx: DbContextClient,
  profile: TheDogsDogProfile,
  subjectDogId: string,
): Promise<ResolvedProfileParents> {
  const [sireId, damId] = await Promise.all([
    profile.sire?.sourceId
      ? resolveExactDogIdentity(tx, profile.sire.sourceId)
      : null,
    profile.dam?.sourceId
      ? resolveExactDogIdentity(tx, profile.dam.sourceId)
      : null,
  ]);
  if (sireId === subjectDogId || damId === subjectDogId) {
    throw new Error("A dog cannot be its own parent");
  }
  if (sireId !== null && sireId === damId) {
    throw new Error("A dog cannot have the same canonical sire and dam");
  }
  return { sireId, damId };
}

async function mergeProfileForm(
  tx: DbContextClient,
  dogId: string,
  sourceProvider: string,
  row: TheDogsDogProfile["formRows"][number],
): Promise<FormMergeResult> {
  assertProfileForm(row);
  const key = {
    dogId,
    sourceProvider,
    sourceId: row.sourceId,
  };
  await tx.$queryRaw`
    SELECT "id"
    FROM "DogProfileForm"
    WHERE "dogId" = ${dogId}
      AND "sourceProvider" = ${sourceProvider}
      AND "sourceId" = ${row.sourceId}
    FOR UPDATE
  `;
  const create = {
    ...key,
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
      ? `${THEDOGS_PROVIDER}:${row.winnerDogSourceId}`
      : undefined,
    inRunningPositions: row.inRunningPositions,
    hasVideo: row.hasVideo,
    sourceRawJson: sanitizeRawJson(row.sourceRawJson),
  };
  const existing = await tx.dogProfileForm.findUnique({
    where: { dogId_sourceProvider_sourceId: key },
    select: {
      id: true,
      raceUrl: true,
      date: true,
      trackCode: true,
      raceName: true,
      finishText: true,
      finishingPosition: true,
      starters: true,
      boxNumber: true,
      weight: true,
      distance: true,
      grade: true,
      runningTime: true,
      winnerTime: true,
      bestOfNightTime: true,
      firstSectional: true,
      margin: true,
      winnerDogName: true,
      winnerDogSourceId: true,
      inRunningPositions: true,
      hasVideo: true,
      sourceRawJson: true,
    },
  });
  if (
    existing &&
    (existing.raceUrl !== row.raceUrl ||
      existing.date.getTime() !== row.date.getTime())
  ) {
    throw new Error("Conflicting The Dogs profile-form source identity");
  }
  if (!existing) {
    await tx.dogProfileForm.upsert({
      where: { dogId_sourceProvider_sourceId: key },
      create,
      update: {},
    });
    return {
      mutated: true,
      decisions: recordCreatedFormDecisions(row.sourceId, create),
    };
  }

  const decisions: FieldDecision[] = [
    {
      field: `form[${row.sourceId}].raceUrl`,
      decision: "no_change",
      reasonCode: "source_identity_matches",
    },
    {
      field: `form[${row.sourceId}].date`,
      decision: "no_change",
      reasonCode: "source_identity_matches",
    },
  ];
  const update: Prisma.DogProfileFormUncheckedUpdateInput = {};
  for (const field of [
    "trackCode",
    "raceName",
    "finishText",
    "finishingPosition",
    "starters",
    "boxNumber",
    "weight",
    "distance",
    "grade",
    "runningTime",
    "winnerTime",
    "bestOfNightTime",
    "firstSectional",
    "margin",
    "winnerDogName",
    "winnerDogSourceId",
    "inRunningPositions",
    "sourceRawJson",
  ] as const) {
    decideMissingCanonicalValue(
      update,
      decisions,
      field,
      existing[field],
      create[field],
      `form[${row.sourceId}].${field}`,
    );
  }
  if (!existing.hasVideo && create.hasVideo) {
    update.hasVideo = true;
    decisions.push({
      field: `form[${row.sourceId}].hasVideo`,
      decision: "accepted",
      reasonCode: "filled_missing_canonical_value",
    });
  } else {
    decisions.push({
      field: `form[${row.sourceId}].hasVideo`,
      decision: existing.hasVideo === create.hasVideo ? "no_change" : "preserved",
      reasonCode:
        existing.hasVideo === create.hasVideo
          ? "canonical_matches_observation"
          : "canonical_value_preserved",
    });
  }
  if (Object.keys(update).length === 0) {
    return { mutated: false, decisions };
  }
  await tx.dogProfileForm.upsert({
    where: { dogId_sourceProvider_sourceId: key },
    create,
    update,
  });
  return { mutated: true, decisions };
}

function recordCreatedFormDecisions(
  sourceId: string,
  create: Prisma.DogProfileFormUncheckedCreateInput,
) {
  const decisions: FieldDecision[] = [];
  for (const field of [
    "dogId",
    "sourceProvider",
    "sourceId",
    "raceUrl",
    "date",
    "trackCode",
    "raceName",
    "finishText",
    "finishingPosition",
    "starters",
    "boxNumber",
    "weight",
    "distance",
    "grade",
    "runningTime",
    "winnerTime",
    "bestOfNightTime",
    "firstSectional",
    "margin",
    "winnerDogName",
    "winnerDogSourceId",
    "inRunningPositions",
    "hasVideo",
    "sourceRawJson",
  ] as const) {
    decisions.push({
      field: `form[${sourceId}].${field}`,
      decision: create[field] === undefined ? "no_change" : "accepted",
      reasonCode:
        create[field] === undefined
          ? "provider_value_absent"
          : "verified_form_field_created",
    });
  }
  return decisions;
}

export function assertExactTheDogsProfilePageIdentity(
  html: string,
  expectedSourceId: string,
) {
  if (!/^\d+$/.test(expectedSourceId)) {
    throw new Error("The Dogs source identity must be numeric");
  }
  const pageDogIds = new Set(
    [...html.matchAll(
      /<blackbook-dog\b[^>]*\bdata-dog-id=["'](\d+)["'][^>]*>/gi,
    )].map((match) => match[1]),
  );
  if (pageDogIds.size !== 1 || !pageDogIds.has(expectedSourceId)) {
    throw new Error("The Dogs profile page identity does not match the request");
  }
}

function assertBoundProfilePath(profilePath: string, sourceId: string) {
  if (
    !/^\d+$/.test(sourceId) ||
    !new RegExp(`^/dogs/${sourceId}/[^/?#]+/?$`, "i").test(profilePath)
  ) {
    throw new Error("The Dogs profile path does not bind the requested dog");
  }
}

function exactFullFormPath(path: string | undefined, sourceId: string) {
  if (!path) return undefined;
  let url: URL;
  try {
    url = new URL(path, THEDOGS_ORIGIN);
  } catch {
    throw new Error("Invalid The Dogs full-form path");
  }
  if (
    url.origin !== THEDOGS_ORIGIN ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !new RegExp(`^/dogs/${sourceId}/[^/?#]+/full-form/?$`, "i").test(
      url.pathname,
    )
  ) {
    throw new Error("The Dogs full-form path does not bind the requested dog");
  }
  return url.pathname;
}

function assertProfilePayload(profile: TheDogsDogProfile) {
  if (
    profile.sourceProvider !== THEDOGS_PROVIDER ||
    !/^\d{1,32}$/.test(profile.sourceId) ||
    !isBoundedText(profile.name, 200) ||
    isPlaceholderName(profile.name) ||
    profile.formRows.length > MAX_PROFILE_FORM_ROWS
  ) {
    throw new Error("Invalid The Dogs profile payload");
  }
  assertDogUrl(profile.profileUrl, profile.sourceId, false);
  assertOptionalText(profile.trainerName, 200, "trainer name");
  assertOptionalText(profile.ownerName, 500, "owner name");
  assertOptionalText(profile.colour, 32, "colour");
  assertOptionalNonPlaceholderText(profile.trainerName, "trainer name");
  assertOptionalNonPlaceholderText(profile.ownerName, "owner name");
  assertOptionalNonPlaceholderText(profile.colour, "colour");
  if (profile.sex !== undefined && profile.sex !== "M" && profile.sex !== "F") {
    throw new Error("Invalid The Dogs profile sex");
  }
  assertProviderDate(profile.whelpDate, "whelp date");

  const counts = [
    profile.careerStarts,
    profile.careerWins,
    profile.careerSeconds,
    profile.careerThirds,
  ];
  for (const count of counts) assertOptionalInteger(count, 0, 100_000, "career count");
  const placements = [
    profile.careerWins ?? 0,
    profile.careerSeconds ?? 0,
    profile.careerThirds ?? 0,
  ];
  if (
    (profile.careerStarts === undefined && placements.some((count) => count > 0)) ||
    (profile.careerStarts !== undefined &&
      (placements.some((count) => count > profile.careerStarts!) ||
        placements.reduce((sum, count) => sum + count, 0) > profile.careerStarts))
  ) {
    throw new Error("Invalid The Dogs career totals");
  }
  assertOptionalNumber(profile.prizeMoney, 0, 1_000_000_000, "prize money");
  assertOptionalNumber(profile.winPercentage, 0, 100, "win percentage");
  assertOptionalNumber(profile.placePercentage, 0, 100, "place percentage");

  for (const value of [
    profile.profileStatsJson,
    profile.bestTimesJson,
    profile.boxHistoryJson,
    profile.distanceHistoryJson,
    profile.profileSourceRawJson,
  ]) {
    assertJson(value, MAX_PROFILE_JSON_BYTES, "profile evidence");
  }
  for (const parent of [profile.sire, profile.dam]) {
    if (!parent) continue;
    if (
      !/^\d{1,32}$/.test(parent.sourceId) ||
      !isBoundedText(parent.name, 200) ||
      isPlaceholderName(parent.name)
    ) {
      throw new Error("Invalid The Dogs parent identity");
    }
    assertDogUrl(parent.url, parent.sourceId, true);
  }
  if (
    profile.sire?.sourceId &&
    profile.sire.sourceId === profile.dam?.sourceId
  ) {
    throw new Error("The Dogs profile has the same sire and dam identity");
  }
  for (const row of profile.formRows) assertProfileForm(row);
}

function assertProfileForm(row: TheDogsDogProfile["formRows"][number]) {
  if (
    row.sourceId !== row.raceUrl ||
    !/^\/racing\/[a-z0-9-]+\/\d{4}-\d{2}-\d{2}\/\d+(?:\/[a-z0-9-]+)?\/?(?:\?trial=(?:true|false))?$/i.test(
      row.raceUrl,
    ) ||
    typeof row.hasVideo !== "boolean"
  ) {
    throw new Error("Invalid The Dogs profile-form source identity");
  }
  assertProviderDate(row.date, "form date");
  assertOptionalText(row.trackCode, 32, "track code");
  assertOptionalText(row.raceName, 300, "race name");
  assertOptionalText(row.finishText, 64, "finish text");
  assertOptionalText(row.grade, 64, "grade");
  assertOptionalText(row.winnerDogName, 200, "winner dog name");
  assertOptionalText(row.inRunningPositions, 200, "in-running positions");
  for (const [value, label] of [
    [row.trackCode, "track code"],
    [row.raceName, "race name"],
    [row.finishText, "finish text"],
    [row.grade, "grade"],
    [row.winnerDogName, "winner dog name"],
    [row.inRunningPositions, "in-running positions"],
  ] as const) {
    assertOptionalNonPlaceholderText(value, label);
  }
  assertOptionalInteger(row.finishingPosition, 1, 20, "finishing position");
  assertOptionalInteger(row.starters, 1, 20, "starters");
  assertOptionalInteger(row.boxNumber, 1, 20, "box number");
  if (
    row.finishingPosition !== undefined &&
    row.starters !== undefined &&
    row.finishingPosition > row.starters
  ) {
    throw new Error("Invalid The Dogs form finishing position");
  }
  assertOptionalNumber(row.weight, 1, 100, "weight");
  assertOptionalInteger(row.distance, 1, 2_000, "distance");
  for (const [value, label] of [
    [row.runningTime, "running time"],
    [row.winnerTime, "winner time"],
    [row.bestOfNightTime, "best-of-night time"],
    [row.firstSectional, "first sectional"],
  ] as const) {
    assertOptionalNumber(value, 0.001, 1_000, label);
  }
  assertOptionalNumber(row.margin, -1_000, 1_000, "margin");
  if (
    row.winnerDogSourceId !== undefined &&
    !/^\d{1,32}$/.test(row.winnerDogSourceId)
  ) {
    throw new Error("Invalid The Dogs form winner identity");
  }
  assertJson(row.sourceRawJson, MAX_FORM_JSON_BYTES, "form evidence");
}

function buildProfileEvidenceJson(profile: TheDogsDogProfile) {
  const evidence = {
    schemaVersion: 1,
    source: {
      provider: profile.sourceProvider,
      id: profile.sourceId,
      requestUrl: profile.profileUrl,
    },
    dog: {
      name: profile.name,
      trainerName: profile.trainerName,
      ownerName: profile.ownerName,
      colour: profile.colour,
      sex: profile.sex,
      whelpDate: profile.whelpDate?.toISOString(),
      careerStarts: profile.careerStarts,
      careerWins: profile.careerWins,
      careerSeconds: profile.careerSeconds,
      careerThirds: profile.careerThirds,
      prizeMoney: profile.prizeMoney,
      winPercentage: profile.winPercentage,
      placePercentage: profile.placePercentage,
      profileStats: parseSanitizedEvidenceJson(profile.profileStatsJson),
      bestTimes: parseSanitizedEvidenceJson(profile.bestTimesJson),
      boxHistory: parseSanitizedEvidenceJson(profile.boxHistoryJson),
      distanceHistory: parseSanitizedEvidenceJson(profile.distanceHistoryJson),
      profileSource: parseSanitizedEvidenceJson(profile.profileSourceRawJson),
    },
    relationships: {
      sire: profile.sire ?? null,
      dam: profile.dam ?? null,
    },
    formRows: profile.formRows.map((row) => ({
      sourceId: row.sourceId,
      raceUrl: row.raceUrl,
      date: row.date.toISOString(),
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
      winnerDogSourceId: row.winnerDogSourceId,
      inRunningPositions: row.inRunningPositions,
      hasVideo: row.hasVideo,
      source: parseSanitizedEvidenceJson(row.sourceRawJson),
    })),
  };
  const serialized = JSON.stringify(evidence);
  if (
    Buffer.byteLength(serialized, "utf8") < 2 ||
    Buffer.byteLength(serialized, "utf8") > MAX_PROFILE_JSON_BYTES
  ) {
    throw new Error("Invalid live profile observation evidence size");
  }
  return serialized;
}

function parseSanitizedEvidenceJson(raw: string) {
  return JSON.parse(sanitizeRawJson(raw)) as unknown;
}

function assertProfileObservationOccurrence(
  profile: TheDogsDogProfile,
  occurrence: DogProfileObservationOccurrence,
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      occurrence.id,
    )
  ) {
    throw new Error("Invalid dog profile occurrence id");
  }
  const observedAt = occurrence.observedAt.getTime();
  if (
    !Number.isFinite(observedAt) ||
    observedAt < EARLIEST_OBSERVATION_DATE.getTime() ||
    observedAt > Date.now() + 2 * 24 * 60 * 60 * 1_000
  ) {
    throw new Error("Invalid dog profile occurrence timestamp");
  }
  const expectedRequestSha256 = sha256(
    `${profile.sourceProvider}\u0000${profile.sourceId}\u0000${profile.profileUrl}`,
  );
  const expectedEvidenceJson = buildProfileEvidenceJson(profile);
  if (
    occurrence.requestUrl !== profile.profileUrl ||
    occurrence.requestSha256 !== expectedRequestSha256 ||
    occurrence.evidenceJson !== expectedEvidenceJson ||
    occurrence.evidenceSha256 !== sha256(expectedEvidenceJson)
  ) {
    throw new Error("Dog profile occurrence does not bind exact evidence");
  }
}

function decideMissingCanonicalValue(
  target: object,
  decisions: FieldDecision[],
  targetField: string,
  current: unknown,
  incoming: unknown,
  decisionField = targetField,
) {
  if (incoming === undefined) {
    decisions.push({
      field: decisionField,
      decision: "no_change",
      reasonCode: "provider_value_absent",
    });
    return;
  }
  if (current === null || current === undefined) {
    (target as Record<string, unknown>)[targetField] = incoming;
    decisions.push({
      field: decisionField,
      decision: "accepted",
      reasonCode: "filled_missing_canonical_value",
    });
    return;
  }
  const matches = observedValuesEqual(current, incoming);
  decisions.push({
    field: decisionField,
    decision: matches ? "no_change" : "preserved",
    reasonCode: matches
      ? "canonical_matches_observation"
      : "canonical_value_preserved",
  });
}

function observedValuesEqual(current: unknown, incoming: unknown) {
  if (current instanceof Date && incoming instanceof Date) {
    return current.getTime() === incoming.getTime();
  }
  return Object.is(current, incoming);
}

function recordCanonicalNameDecision(
  decisions: FieldDecision[],
  current: string,
  incoming: string,
) {
  const matches = current.trim().toLowerCase() === incoming.trim().toLowerCase();
  decisions.push({
    field: "name",
    decision: matches ? "no_change" : "preserved",
    reasonCode: matches
      ? "canonical_matches_observation"
      : "canonical_name_preserved",
  });
}

function recordRelationshipDecision(
  decisions: FieldDecision[],
  field: "sireId" | "damId",
  current: string | null,
  resolved: string | null,
  providerClaimPresent: boolean,
) {
  if (!providerClaimPresent) {
    decisions.push({
      field,
      decision: "preserved",
      reasonCode: "provider_relationship_absent",
    });
  } else if (resolved === null) {
    decisions.push({
      field,
      decision: "preserved",
      reasonCode: "provider_relationship_unresolved",
    });
  } else if (current === resolved) {
    decisions.push({
      field,
      decision: "no_change",
      reasonCode: "canonical_relationship_matches",
    });
  } else {
    decisions.push({
      field,
      decision: "preserved",
      reasonCode:
        current === null
          ? "canonical_pedigree_pipeline_required"
          : "canonical_relationship_conflict",
    });
  }
}

function assertFieldDecisionsJson(value: string) {
  if (
    Buffer.byteLength(value, "utf8") < 2 ||
    Buffer.byteLength(value, "utf8") > MAX_FIELD_DECISIONS_JSON_BYTES
  ) {
    throw new Error("Invalid dog profile field-decision evidence size");
  }
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid dog profile field-decision evidence");
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isPlaceholderName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return PLACEHOLDER_NAMES.has(normalized);
}

function assertDogUrl(value: string, sourceId: string, allowRelative: boolean) {
  let url: URL;
  try {
    url = allowRelative ? new URL(value, THEDOGS_ORIGIN) : new URL(value);
  } catch {
    throw new Error("Invalid The Dogs dog URL");
  }
  if (
    url.origin !== THEDOGS_ORIGIN ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !new RegExp(`^/dogs/${sourceId}/[^/?#]+/?$`, "i").test(url.pathname)
  ) {
    throw new Error("The Dogs dog URL does not bind the source identity");
  }
}

function assertProviderDate(value: Date | undefined, label: string) {
  if (value === undefined) return;
  const timestamp = value instanceof Date ? value.getTime() : Number.NaN;
  if (
    !Number.isFinite(timestamp) ||
    timestamp < EARLIEST_PROVIDER_DATE.getTime() ||
    timestamp > Date.now() + 2 * 24 * 60 * 60 * 1_000
  ) {
    throw new Error(`Invalid The Dogs ${label}`);
  }
}

function assertOptionalInteger(
  value: number | undefined,
  min: number,
  max: number,
  label: string,
) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < min || value > max)) {
    throw new Error(`Invalid The Dogs ${label}`);
  }
}

function assertOptionalNumber(
  value: number | undefined,
  min: number,
  max: number,
  label: string,
) {
  if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) {
    throw new Error(`Invalid The Dogs ${label}`);
  }
}

function assertOptionalText(value: string | undefined, max: number, label: string) {
  if (value !== undefined && !isBoundedText(value, max)) {
    throw new Error(`Invalid The Dogs ${label}`);
  }
}

function assertOptionalNonPlaceholderText(
  value: string | undefined,
  label: string,
) {
  if (value !== undefined && isPlaceholderName(value)) {
    throw new Error(`Invalid placeholder The Dogs ${label}`);
  }
}

function isBoundedText(value: string, max: number) {
  const length = value.trim().length;
  return length > 0 && length <= max;
}

function assertJson(value: string, maxBytes: number, label: string) {
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new Error(`Oversized The Dogs ${label}`);
  }
  try {
    JSON.parse(value);
  } catch {
    throw new Error(`Invalid The Dogs ${label}`);
  }
}

function profileIdFor(dog: DogSeed) {
  const sourceId =
    dog.sourceProvider === THEDOGS_PROVIDER ? dog.sourceId : undefined;
  const earBrandId = dog.earBrand?.match(/^thedogs:(\d+)$/)?.[1];
  const exactId = sourceId ?? earBrandId;
  return exactId && /^\d+$/.test(exactId) ? exactId : null;
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
