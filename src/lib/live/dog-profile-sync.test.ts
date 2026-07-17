import assert from "node:assert/strict";

import {
  createProfileObservationOccurrence,
  fetchProfileForDog,
  resolveExactDogIdentity,
  saveProfile,
  syncDogProfilesBatch,
} from "./dog-profile-sync";
import type {
  TheDogsDogProfile,
  TheDogsDogProfileForm,
} from "./thedogs-profile";

type DogRow = {
  id: string;
  name: string;
  earBrand: string | null;
  colour: string | null;
  sex: string | null;
  whelpDate: Date | null;
  sireId: string | null;
  damId: string | null;
  trainerId: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
  profileUrl: string | null;
  ownerName: string | null;
  careerStarts: number | null;
  careerWins: number | null;
  careerSeconds: number | null;
  careerThirds: number | null;
  prizeMoney: number | null;
  winPercentage: number | null;
  placePercentage: number | null;
  profileStatsJson: string | null;
  bestTimesJson: string | null;
  boxHistoryJson: string | null;
  distanceHistoryJson: string | null;
  profileSourceRawJson: string | null;
  lastProfileSyncedAt?: Date | null;
};

type IdentityClaim = {
  sourceProvider: string;
  sourceId: string;
  dogId: string | null;
  verificationStatus: string;
};

type FormRow = ReturnType<typeof storedForm>;
type FormSourceKey = {
  dogId: string;
  sourceProvider: string;
  sourceId: string;
};

type ObservationRow = ReturnType<typeof createProfileObservationOccurrence> & {
  dogId: string;
  sourceProvider: string;
  sourceId: string;
  verificationStatus: string;
};

type LedgerRow = {
  observationId: string;
  dogId: string;
  sourceProvider: string;
  sourceId: string;
  requestSha256: string;
  evidenceSha256: string;
  decision: string;
  reasonCode: string;
  verificationStatus: string;
  fieldDecisionsJson: string;
};

async function main() {
  await liveBatchStaysDisabledWithoutProvenance();
  await wrongPageIdentityFailsBeforeDependentFetch();
  await fullFormEvidenceMustRemainBoundAndNonempty();
  await exactIdentityResolutionIsCanonicalAndFailClosed();
  await profileMergePreservesCanonicalDataAndPartialFormHistory();
  await completeParentEvidenceDoesNotBypassCanonicalPedigreeWrites();
  await occurrenceRetriesAreExactAndRepeatedFetchesRemainAppendOnly();
  await invalidProviderValuesFailBeforeMutation();
  await placeholderIdentityEvidenceFailsBeforeMutation();
  await conflictingStoredFormIdentityFailsClosed();
  console.log("TheDogs live profile ingestion safety checks passed");
}

async function liveBatchStaysDisabledWithoutProvenance() {
  await assert.rejects(
    syncDogProfilesBatch(),
    /disabled_pending_provenance_and_migration_rehearsal/,
  );
}

async function wrongPageIdentityFailsBeforeDependentFetch() {
  let fullFormFetched = false;
  await assert.rejects(
    fetchProfileForDog(
      {
        fetchProfile: async () =>
          '<blackbook-dog data-dog-id="999"></blackbook-dog>',
        fetchFullForm: async () => {
          fullFormFetched = true;
          return "";
        },
      },
      {
        id: "dog-100",
        name: "Exact Dog",
        earBrand: "thedogs:100",
        sourceProvider: "thedogs",
        sourceId: "100",
        profileUrl: "https://www.thedogs.com.au/dogs/100/exact-dog",
      },
    ),
    /profile page identity does not match/,
  );
  assert.equal(fullFormFetched, false);
}

async function fullFormEvidenceMustRemainBoundAndNonempty() {
  const dogSeed = {
    id: "dog-100",
    name: "Exact Dog",
    earBrand: "thedogs:100",
    sourceProvider: "thedogs",
    sourceId: "100",
    profileUrl: "https://www.thedogs.com.au/dogs/100/exact-dog",
  };
  let fetchedPath = "";
  await assert.rejects(
    fetchProfileForDog(
      {
        fetchProfile: async () =>
          '<blackbook-dog data-dog-id="100"></blackbook-dog><div class="dog-statistics__name">Exact Dog</div><div data-runner-show-more="/dogs/100/exact-dog/full-form"></div>',
        fetchFullForm: async (path) => {
          fetchedPath = path;
          return " ";
        },
      },
      dogSeed,
    ),
    /full-form evidence is empty/,
  );
  assert.equal(fetchedPath, "/dogs/100/exact-dog/full-form");

  await assert.rejects(
    fetchProfileForDog(
      {
        fetchProfile: async () =>
          '<blackbook-dog data-dog-id="100"></blackbook-dog><div data-runner-show-more="/dogs/999/wrong/full-form"></div>',
        fetchFullForm: async () => "not reached",
      },
      dogSeed,
    ),
    /full-form path does not bind/,
  );
}

async function exactIdentityResolutionIsCanonicalAndFailClosed() {
  const canonical = dog({
    id: "canonical-200",
    earBrand: "thedogs:200",
    sourceProvider: "thedogs",
    sourceId: "200",
  });
  const exact = fakeDb({
    dogs: [canonical],
    identities: [verifiedIdentity("200", canonical.id)],
  });
  assert.equal(
    await resolveExactDogIdentity(exact.tx, "200"),
    canonical.id,
    "duplicate exact channels for one canonical dog are deduplicated",
  );

  const ambiguous = fakeDb({
    dogs: [canonical],
    identities: [verifiedIdentity("200", "different-canonical")],
  });
  await assert.rejects(
    resolveExactDogIdentity(ambiguous.tx, "200"),
    /Ambiguous canonical/,
  );

  for (const claim of [
    { ...verifiedIdentity("200", null) },
    { ...verifiedIdentity("200", canonical.id), verificationStatus: "parsed" },
  ]) {
    const unsafeClaim = fakeDb({ dogs: [canonical], identities: [claim] });
    await assert.rejects(
      resolveExactDogIdentity(unsafeClaim.tx, "200"),
      /Unlinked or nonverified/,
    );
  }
}

async function profileMergePreservesCanonicalDataAndPartialFormHistory() {
  const child = dog({
    id: "child-100",
    name: "Canonical Child",
    earBrand: "thedogs:100",
    colour: "BLACK",
    sex: null,
    damId: "existing-dam",
    profileStatsJson: '{"verified":"existing"}',
  });
  const sire = dog({
    id: "sire-200",
    name: "Existing Sire",
    earBrand: "thedogs:200",
    sourceProvider: "thedogs",
    sourceId: "200",
  });
  const retainedForm = storedForm({
    id: "form-retained",
    dogId: child.id,
    sourceId: "/racing/track/2026-07-01/2/retained",
    raceUrl: "/racing/track/2026-07-01/2/retained",
    raceName: "Retained from earlier complete response",
  });
  const mergeForm = storedForm({
    id: "form-merge",
    dogId: child.id,
    sourceId: "/racing/track/2026-07-01/1/merge",
    raceUrl: "/racing/track/2026-07-01/1/merge",
    raceName: "Verified existing race name",
    grade: null,
  });
  const database = fakeDb({
    dogs: [child, sire],
    identities: [
      verifiedIdentity("100", child.id),
      verifiedIdentity("200", sire.id),
    ],
    trainers: [{ id: "trainer-1", name: "Known Trainer" }],
    forms: [retainedForm, mergeForm],
  });
  const profile = dogProfile([
    providerForm({
      sourceId: mergeForm.sourceId,
      raceUrl: mergeForm.raceUrl,
      raceName: "Incoming replacement name",
      grade: "5",
    }),
    providerForm({
      sourceId: "/racing/track/2026-07-02/3/new",
      raceUrl: "/racing/track/2026-07-02/3/new",
      raceName: "New verified form",
    }),
  ]);

  await saveProfile(database.tx, child.id, profile);

  const savedChild = database.dogs.get(child.id);
  assert(savedChild);
  assert.equal(savedChild.name, "Canonical Child");
  assert.equal(savedChild.colour, "BLACK", "existing canonical fields win");
  assert.equal(savedChild.sex, "M", "missing fields are enriched");
  assert.equal(savedChild.sireId, null, "live profile sync never writes pedigree links");
  assert.equal(savedChild.damId, "existing-dam", "existing relationships are preserved");
  assert.equal(savedChild.trainerId, null, "trainer names never resolve identities");
  assert.equal(savedChild.sourceProvider, "thedogs");
  assert.equal(savedChild.sourceId, "100");
  assert.equal(savedChild.profileStatsJson, '{"verified":"existing"}');
  assert.equal(
    savedChild.lastProfileSyncedAt,
    null,
    "unresolved parent evidence remains retryable",
  );
  assert(database.locks().includes(`dog:${child.id}`));
  assert(
    database.locks().some((lock) => lock.startsWith(`form:${child.id}:thedogs:`)),
  );

  assert.equal(database.forms.size, 3, "partial responses never remove old forms");
  assert.equal(database.forms.get(formKey(mergeForm))?.raceName, mergeForm.raceName);
  assert.equal(database.forms.get(formKey(mergeForm))?.grade, "5");
  assert(database.forms.has(formKey(retainedForm)));
  const upsertsAfterFirstMerge = database.formUpserts();
  assert.equal(database.observations.size, 1);
  assert.equal(database.ledgers.size, 1);
  const firstLedger = [...database.ledgers.values()][0];
  assert(firstLedger);
  const firstDecisions = JSON.parse(firstLedger.fieldDecisionsJson) as Array<{
    field: string;
    decision: string;
    reasonCode: string;
  }>;
  assert(
    firstDecisions.some(
      (entry) =>
        entry.field === "trainerId" &&
        entry.reasonCode === "trainer_identity_unresolved" &&
        entry.decision === "preserved",
    ),
  );
  assert(
    firstDecisions.some(
      (entry) =>
        entry.field === "damId" &&
        entry.reasonCode === "provider_relationship_unresolved",
    ),
  );
  const firstEvents = database.events();
  const observationIndex = firstEvents.findIndex((event) =>
    event.startsWith("observation:"),
  );
  const firstMutationIndex = firstEvents.findIndex(
    (event) => event.startsWith("dog-update:") || event.startsWith("form-upsert:"),
  );
  const ledgerIndex = firstEvents.findIndex((event) =>
    event.startsWith("ledger:"),
  );
  assert(observationIndex >= 0 && observationIndex < firstMutationIndex);
  assert(ledgerIndex > firstMutationIndex);

  await saveProfile(database.tx, child.id, profile);
  assert.equal(database.forms.size, 3, "repeated sync is source-key idempotent");
  assert.equal(
    database.formUpserts(),
    upsertsAfterFirstMerge,
    "an identical repeat performs no form write",
  );
  assert.equal(
    database.observations.size,
    2,
    "a legitimate repeated fetch remains a distinct occurrence",
  );
  assert.equal(database.ledgers.size, 2);
}

async function completeParentEvidenceDoesNotBypassCanonicalPedigreeWrites() {
  const child = dog({
    id: "child-complete",
    earBrand: "thedogs:100",
    sireId: "sire-complete",
    damId: "dam-complete",
  });
  const sire = dog({
    id: "sire-complete",
    earBrand: "thedogs:200",
    sourceProvider: "thedogs",
    sourceId: "200",
  });
  const dam = dog({
    id: "dam-complete",
    earBrand: "thedogs:300",
    sourceProvider: "thedogs",
    sourceId: "300",
  });
  const database = fakeDb({
    dogs: [child, sire, dam],
    identities: [
      verifiedIdentity("100", child.id),
      verifiedIdentity("200", sire.id),
      verifiedIdentity("300", dam.id),
    ],
  });

  const unresolvedTrainerProfile = dogProfile([providerForm({})]);
  await saveProfile(database.tx, child.id, unresolvedTrainerProfile);

  const incomplete = database.dogs.get(child.id);
  assert(incomplete);
  assert.equal(
    incomplete.lastProfileSyncedAt,
    null,
    "a provider trainer name cannot silently complete an unresolved identity",
  );
  const unresolvedLedger = [...database.ledgers.values()][0];
  assert(unresolvedLedger);
  assert(
    (
      JSON.parse(unresolvedLedger.fieldDecisionsJson) as Array<{
        field: string;
        reasonCode: string;
      }>
    ).some(
      (entry) =>
        entry.field === "trainerId" &&
        entry.reasonCode === "trainer_identity_unresolved",
    ),
  );

  const profileWithoutTrainer = dogProfile([providerForm({})]);
  delete profileWithoutTrainer.trainerName;
  await saveProfile(database.tx, child.id, profileWithoutTrainer);

  const saved = database.dogs.get(child.id);
  assert(saved);
  assert.equal(saved.sireId, sire.id);
  assert.equal(saved.damId, dam.id);
  assert.equal(saved.trainerId, null);
  assert(saved.lastProfileSyncedAt instanceof Date);
}

async function occurrenceRetriesAreExactAndRepeatedFetchesRemainAppendOnly() {
  const child = dog({ id: "child-occurrence", earBrand: "thedogs:100" });
  const database = fakeDb({
    dogs: [child],
    identities: [verifiedIdentity("100", child.id)],
  });
  const profile = dogProfile([]);
  const occurrence = createProfileObservationOccurrence(profile);

  await saveProfile(database.tx, child.id, profile, occurrence);
  const eventsAfterFirstWrite = database.events().length;
  await saveProfile(database.tx, child.id, profile, occurrence);
  assert.equal(database.observations.size, 1, "same occurrence retry is idempotent");
  assert.equal(database.ledgers.size, 1);
  assert.equal(
    database.events().length,
    eventsAfterFirstWrite,
    "same occurrence retry performs no write",
  );

  const changedProfile = { ...profile, ownerName: "Changed verified owner" };
  const driftedOccurrence = createProfileObservationOccurrence(changedProfile, {
    id: occurrence.id,
    observedAt: occurrence.observedAt,
  });
  await assert.rejects(
    saveProfile(database.tx, child.id, changedProfile, driftedOccurrence),
    /occurrence payload drift detected/,
  );
  assert.equal(database.observations.size, 1);
  assert.equal(database.ledgers.size, 1);
}

async function invalidProviderValuesFailBeforeMutation() {
  const child = dog({ id: "child-invalid", earBrand: "thedogs:100" });
  const database = fakeDb({
    dogs: [child],
    identities: [verifiedIdentity("100", child.id)],
  });
  const profile = dogProfile([]);
  profile.careerStarts = 2;
  profile.careerWins = 3;

  await assert.rejects(saveProfile(database.tx, child.id, profile), /career totals/);
  assert.equal(database.dogs.get(child.id)?.sex, null);
  assert.equal(database.locks().length, 0, "invalid evidence is rejected before locking");

  const invalidForm = dogProfile([
    providerForm({ finishingPosition: 9, starters: 8 }),
  ]);
  await assert.rejects(
    saveProfile(database.tx, child.id, invalidForm),
    /form finishing position/,
  );
  assert.equal(database.locks().length, 0);
}

async function placeholderIdentityEvidenceFailsBeforeMutation() {
  const child = dog({ id: "child-placeholder", earBrand: "thedogs:100" });
  const database = fakeDb({
    dogs: [child],
    identities: [verifiedIdentity("100", child.id)],
  });
  const placeholderDog = dogProfile([]);
  placeholderDog.name = "UNKNOWN DOG";
  await assert.rejects(
    saveProfile(database.tx, child.id, placeholderDog),
    /Invalid The Dogs profile payload/,
  );

  const placeholderParent = dogProfile([]);
  placeholderParent.sire = {
    sourceId: "200",
    name: "TBD",
    url: "/dogs/200/tbd",
  };
  await assert.rejects(
    saveProfile(database.tx, child.id, placeholderParent),
    /Invalid The Dogs parent identity/,
  );

  const placeholderOwner = dogProfile([]);
  placeholderOwner.ownerName = "N/A";
  await assert.rejects(
    saveProfile(database.tx, child.id, placeholderOwner),
    /Invalid placeholder The Dogs owner name/,
  );
  assert.equal(database.observations.size, 0);
  assert.equal(database.ledgers.size, 0);
  assert.equal(database.locks().length, 0);
}

async function conflictingStoredFormIdentityFailsClosed() {
  const child = dog({ id: "child-conflict", earBrand: "thedogs:100" });
  const sourceId = "/racing/track/2026-07-01/1/conflict";
  const existing = storedForm({
    id: "form-conflict",
    dogId: child.id,
    sourceId,
    raceUrl: "/racing/track/2026-07-01/2/different",
  });
  const database = fakeDb({
    dogs: [child],
    identities: [verifiedIdentity("100", child.id)],
    forms: [existing],
  });
  const profile = dogProfile([
    providerForm({ sourceId, raceUrl: sourceId }),
  ]);

  await assert.rejects(
    saveProfile(database.tx, child.id, profile),
    /Conflicting The Dogs profile-form source identity/,
  );
  assert.equal(database.formUpserts(), 0);
}

function fakeDb(input: {
  dogs?: DogRow[];
  identities?: IdentityClaim[];
  trainers?: { id: string; name: string }[];
  forms?: FormRow[];
}) {
  const dogs = new Map((input.dogs ?? []).map((row) => [row.id, { ...row }]));
  const forms = new Map(
    (input.forms ?? []).map((row) => [formKey(row), { ...row }]),
  );
  const observations = new Map<string, ObservationRow>();
  const ledgers = new Map<string, LedgerRow>();
  let formUpserts = 0;
  const locks: string[] = [];
  const events: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes('FROM "DogProfileForm"')) {
        locks.push(`form:${values.join(":")}`);
      } else if (sql.includes('FROM "Dog"')) {
        locks.push(`dog:${values[0]}`);
      }
      return [];
    },
    dog: {
      findMany: async ({
        where,
      }: {
        where: {
          OR: [
            { sourceProvider: string; sourceId: string },
            { earBrand: string },
          ];
        };
      }) => {
        const providerClaim = where.OR[0];
        const earBrandClaim = where.OR[1];
        return [...dogs.values()].filter(
          (row) =>
            (row.sourceProvider === providerClaim.sourceProvider &&
              row.sourceId === providerClaim.sourceId) ||
            row.earBrand === earBrandClaim.earBrand,
        );
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        assert(locks.includes(`dog:${where.id}`), "Dog must be locked before read");
        return dogs.get(where.id) ?? null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        assert(locks.includes(`dog:${where.id}`), "Dog must stay locked for update");
        const row = dogs.get(where.id);
        assert(row);
        applyDefined(row, data);
        events.push(`dog-update:${where.id}`);
        return row;
      },
    },
    dogSourceIdentity: {
      findMany: async ({
        where,
      }: {
        where: { sourceProvider: string; sourceId: string };
      }) =>
        (input.identities ?? []).filter(
          (claim) =>
            claim.sourceProvider === where.sourceProvider &&
            claim.sourceId === where.sourceId,
        ),
    },
    trainer: {
      findMany: async ({
        where,
        take,
      }: {
        where: { name: string };
        take: number;
      }) =>
        (input.trainers ?? [])
          .filter((trainer) => trainer.name === where.name)
          .slice(0, take),
    },
    dogProfileObservation: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        observations.get(where.id) ?? null,
      create: async ({ data }: { data: ObservationRow }) => {
        assert(!observations.has(data.id), "occurrence ids must be unique");
        const row = { ...data };
        observations.set(row.id, row);
        events.push(`observation:${row.id}`);
        return row;
      },
    },
    dogProfileMergeLedger: {
      findUnique: async ({
        where,
      }: {
        where: { observationId: string };
      }) => ledgers.get(where.observationId) ?? null,
      create: async ({ data }: { data: LedgerRow }) => {
        assert(
          observations.has(data.observationId),
          "merge decisions require an observation",
        );
        assert(!ledgers.has(data.observationId), "occurrence ledger is one-to-one");
        const row = { ...data };
        ledgers.set(row.observationId, row);
        events.push(`ledger:${row.observationId}`);
        return row;
      },
    },
    dogProfileForm: {
      findUnique: async ({
        where,
      }: {
        where: { dogId_sourceProvider_sourceId: FormSourceKey };
      }) => {
        const key = where.dogId_sourceProvider_sourceId;
        assert(
          locks.includes(`form:${key.dogId}:${key.sourceProvider}:${key.sourceId}`),
          "profile form must be locked before read",
        );
        return forms.get(formKey(key)) ?? null;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { dogId_sourceProvider_sourceId: FormSourceKey };
        create: Omit<FormRow, "id">;
        update: Partial<FormRow>;
      }) => {
        formUpserts += 1;
        const key = formKey(where.dogId_sourceProvider_sourceId);
        const existing = forms.get(key);
        if (existing) applyDefined(existing, update);
        else forms.set(key, { id: `form-${forms.size + 1}`, ...create });
        events.push(`form-upsert:${key}`);
      },
    },
  };
  return {
    tx: tx as unknown as Parameters<typeof saveProfile>[0],
    dogs,
    forms,
    observations,
    ledgers,
    formUpserts: () => formUpserts,
    locks: () => [...locks],
    events: () => [...events],
  };
}

function dog(overrides: Partial<DogRow>): DogRow {
  return {
    id: "dog",
    name: "Dog",
    earBrand: null,
    colour: null,
    sex: null,
    whelpDate: null,
    sireId: null,
    damId: null,
    trainerId: null,
    sourceProvider: null,
    sourceId: null,
    profileUrl: null,
    ownerName: null,
    careerStarts: null,
    careerWins: null,
    careerSeconds: null,
    careerThirds: null,
    prizeMoney: null,
    winPercentage: null,
    placePercentage: null,
    profileStatsJson: null,
    bestTimesJson: null,
    boxHistoryJson: null,
    distanceHistoryJson: null,
    profileSourceRawJson: null,
    lastProfileSyncedAt: null,
    ...overrides,
  };
}

function verifiedIdentity(
  sourceId: string,
  dogId: string | null,
): IdentityClaim {
  return {
    sourceProvider: "thedogs",
    sourceId,
    dogId,
    verificationStatus: "verified",
  };
}

function dogProfile(formRows: TheDogsDogProfileForm[]): TheDogsDogProfile {
  return {
    sourceProvider: "thedogs",
    sourceId: "100",
    profileUrl: "https://www.thedogs.com.au/dogs/100/incoming-child",
    name: "Incoming Child Name",
    trainerName: "Known Trainer",
    ownerName: "Verified Owner",
    sire: {
      sourceId: "200",
      name: "Existing Sire",
      url: "/dogs/200/existing-sire",
    },
    dam: {
      sourceId: "300",
      name: "Unresolved Dam",
      url: "/dogs/300/unresolved-dam",
    },
    colour: "BLUE",
    sex: "M",
    careerStarts: 12,
    profileStatsJson: '{"incoming":true}',
    bestTimesJson: "[]",
    boxHistoryJson: "[]",
    distanceHistoryJson: "[]",
    profileSourceRawJson: '{"sourceId":"100"}',
    formRows,
  };
}

function providerForm(
  overrides: Partial<TheDogsDogProfileForm>,
): TheDogsDogProfileForm {
  return {
    sourceId: "/racing/track/2026-07-01/1/default",
    raceUrl: "/racing/track/2026-07-01/1/default",
    date: new Date("2026-07-01T10:00:00.000Z"),
    hasVideo: false,
    sourceRawJson: '{"provider":"thedogs"}',
    ...overrides,
  };
}

function storedForm(overrides: Record<string, unknown> = {}) {
  return {
    id: "form",
    dogId: "dog",
    sourceProvider: "thedogs",
    sourceId: "/racing/track/2026-07-01/1/default",
    raceUrl: "/racing/track/2026-07-01/1/default",
    date: new Date("2026-07-01T10:00:00.000Z"),
    trackCode: null as string | null,
    raceName: null as string | null,
    finishText: null as string | null,
    finishingPosition: null as number | null,
    starters: null as number | null,
    boxNumber: null as number | null,
    weight: null as number | null,
    distance: null as number | null,
    grade: null as string | null,
    runningTime: null as number | null,
    winnerTime: null as number | null,
    bestOfNightTime: null as number | null,
    firstSectional: null as number | null,
    margin: null as number | null,
    winnerDogName: null as string | null,
    winnerDogSourceId: null as string | null,
    inRunningPositions: null as string | null,
    hasVideo: false,
    sourceRawJson: null as string | null,
    ...overrides,
  };
}

function formKey(row: {
  dogId: string;
  sourceProvider: string;
  sourceId: string;
}) {
  return `${row.dogId}\u0000${row.sourceProvider}\u0000${row.sourceId}`;
}

function applyDefined(target: object, source: object) {
  const targetRecord = target as Record<string, unknown>;
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) targetRecord[key] = value;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
