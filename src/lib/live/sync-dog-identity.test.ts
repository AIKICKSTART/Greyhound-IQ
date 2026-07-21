import assert from "node:assert/strict";

import { ensureDogs } from "./sync";

type DogRow = {
  id: string;
  name: string;
  earBrand: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
  whelpDate: Date | null;
  sire: null;
  dam: null;
};

void main();

async function main() {
  await rejectsNameOnlyCollision();
  await rejectsConflictingExactClaims();
  await rejectsPlaceholderAndMissingIdentity();
  await rejectsPrototypeCreation();
  await resolvesLegacyExactKeyWithoutMutation();
  await createsOnlyStableIdentityIdempotently();
  await groupsExactLookupsByProvider();
  console.log("live dog identity sync tests passed");
}

async function rejectsNameOnlyCollision() {
  let findCalls = 0;
  let createCalls = 0;
  const candidate = dogRow({
    id: "existing-name-collision",
    name: "Collision Dog",
    sourceProvider: "watchdog",
    sourceId: "different-provider-id",
  });
  const warnings = await captureWarnings(async () => {
    const ids = await ensureDogs(
      {
        dog: {
          findMany: async () => {
            findCalls += 1;
            return findCalls === 1 ? [] : [candidate];
          },
          createMany: async () => {
            createCalls += 1;
            return { count: 0 };
          },
        },
        dogSourceIdentity: { findMany: async () => [] },
      } as never,
      [
        {
          sourceProvider: "topaz",
          sourceId: "123",
          name: "Collision Dog",
          whelpDate: "2024-01-02",
        },
      ],
    );
    assert.equal(ids.size, 0);
  });

  assert.equal(createCalls, 0);
  assert.ok(warnings.some((warning) => warning.reason === "possible_existing_candidate"));
}

async function rejectsConflictingExactClaims() {
  let createCalls = 0;
  const warnings = await captureWarnings(async () => {
    const ids = await ensureDogs(
      {
        dog: {
          findMany: async () => [
            {
              id: "canonical-a",
              earBrand: null,
              sourceProvider: "topaz",
              sourceId: "456",
            },
          ],
          createMany: async () => {
            createCalls += 1;
            return { count: 0 };
          },
        },
        dogSourceIdentity: {
          findMany: async () => [
            {
              dogId: "canonical-b",
              sourceProvider: "topaz",
              sourceId: "456",
            },
          ],
        },
      } as never,
      [{ sourceProvider: "topaz", sourceId: "456", name: "Exact Dog" }],
    );
    assert.equal(ids.size, 0);
  });

  assert.equal(createCalls, 0);
  assert.ok(warnings.some((warning) => warning.reason === "ambiguous_exact_identity"));
}

async function rejectsPlaceholderAndMissingIdentity() {
  let dbTouched = false;
  const warnings = await captureWarnings(async () => {
    const ids = await ensureDogs(
      {
        dog: {
          findMany: async () => {
            dbTouched = true;
            return [];
          },
          createMany: async () => {
            dbTouched = true;
            return { count: 0 };
          },
        },
        dogSourceIdentity: {
          findMany: async () => {
            dbTouched = true;
            return [];
          },
        },
      } as never,
      [
        { sourceProvider: "topaz", sourceId: "1", name: "Unknown runner" },
        { sourceProvider: "topaz", name: "Real Dog" },
        { sourceProvider: "topaz", sourceId: "2", name: "Vacant Box" },
      ],
    );
    assert.equal(ids.size, 0);
  });

  assert.equal(dbTouched, false);
  assert.ok(warnings.some((warning) => warning.reason === "invalid_or_placeholder_name"));
  assert.ok(
    warnings.some((warning) => warning.reason === "missing_stable_provider_identity"),
  );
}

async function rejectsPrototypeCreation() {
  let createCalls = 0;
  const warnings = await captureWarnings(async () => {
    const ids = await ensureDogs(
      {
        dog: {
          findMany: async () => [],
          createMany: async () => {
            createCalls += 1;
            return { count: 0 };
          },
        },
        dogSourceIdentity: { findMany: async () => [] },
      } as never,
      [
        {
          sourceProvider: "fasttrack-prototype",
          sourceId: "999",
          name: "Prototype Dog",
        },
      ],
    );
    assert.equal(ids.size, 0);
  });

  assert.equal(createCalls, 0);
  assert.ok(
    warnings.some((warning) => warning.reason === "provider_not_approved_for_creation"),
  );
}

async function resolvesLegacyExactKeyWithoutMutation() {
  let createCalls = 0;
  const canonical = {
    id: "legacy-canonical",
    earBrand: "thedogs:77",
    sourceProvider: null,
    sourceId: null,
  };
  const ids = await ensureDogs(
    {
      dog: {
        findMany: async () => [canonical],
        createMany: async () => {
          createCalls += 1;
          return { count: 0 };
        },
      },
      dogSourceIdentity: { findMany: async () => [] },
    } as never,
    [
      {
        sourceProvider: "thedogs",
        sourceId: "77",
        name: "Canonical Renamed Dog",
        colour: "Blue",
      },
    ],
  );

  assert.equal(ids.get("thedogs:77"), "legacy-canonical");
  assert.equal(createCalls, 0);
  assert.deepEqual(canonical, {
    id: "legacy-canonical",
    earBrand: "thedogs:77",
    sourceProvider: null,
    sourceId: null,
  });
}

async function createsOnlyStableIdentityIdempotently() {
  let stored: DogRow | null = null;
  let createCalls = 0;
  let createdData: Record<string, unknown> | undefined;
  const db = {
    dog: {
      findMany: async (args: { where?: { OR?: Array<Record<string, unknown>> } }) => {
        if (isNaturalLookup(args)) return [];
        if (!stored) return [];
        return [
          {
            id: stored.id,
            earBrand: stored.earBrand,
            sourceProvider: stored.sourceProvider,
            sourceId: stored.sourceId,
          },
        ];
      },
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        createCalls += 1;
        createdData = args.data[0];
        stored = dogRow({
          id: "created-canonical",
          name: String(createdData?.name),
          earBrand: (createdData?.earBrand as string | null | undefined) ?? null,
          sourceProvider: String(createdData?.sourceProvider),
          sourceId: String(createdData?.sourceId),
          whelpDate: (createdData?.whelpDate as Date | null | undefined) ?? null,
        });
        return { count: 1 };
      },
    },
    dogSourceIdentity: { findMany: async () => [] },
  };
  const observation = {
    sourceProvider: "topaz",
    sourceId: "900",
    name: "Stable Dog",
    sex: "F",
    colour: "Black",
    whelpDate: "2024-02-03",
    sire: { sourceProvider: "topaz", sourceId: "901", name: "Real Sire" },
    dam: { sourceProvider: "topaz", sourceId: "902", name: "Real Dam" },
  };

  const first = await ensureDogs(db as never, [observation]);
  const second = await ensureDogs(db as never, [observation]);

  assert.equal(first.get("topaz:900"), "created-canonical");
  assert.equal(second.get("topaz:900"), "created-canonical");
  assert.equal(first.has("Stable Dog"), false);
  assert.equal(createCalls, 1);
  assert.equal(createdData?.sourceProvider, "topaz");
  assert.equal(createdData?.sourceId, "900");
  assert.equal(createdData?.name, "Stable Dog");
  assert.equal(createdData?.earBrand, undefined);
  assert.equal("sireId" in (createdData ?? {}), false);
  assert.equal("damId" in (createdData ?? {}), false);
}

async function groupsExactLookupsByProvider() {
  let exactQuery:
    | { where?: { OR?: Array<Record<string, unknown>> } }
    | undefined;
  await captureWarnings(async () => {
    await ensureDogs(
      {
        dog: {
          findMany: async (args: {
            where?: { OR?: Array<Record<string, unknown>> };
          }) => {
            if (!isNaturalLookup(args) && !exactQuery) exactQuery = args;
            return [];
          },
          createMany: async () => ({ count: 0 }),
        },
        dogSourceIdentity: { findMany: async () => [] },
      } as never,
      [
        { sourceProvider: "provider-a", sourceId: "1", name: "Dog A" },
        { sourceProvider: "provider-a", sourceId: "2", name: "Dog B" },
        { sourceProvider: "provider-b", sourceId: "3", name: "Dog C" },
      ],
    );
  });

  const conditions = exactQuery?.where?.OR ?? [];
  const providerConditions = conditions.filter(
    (condition) => "sourceProvider" in condition,
  );
  assert.equal(providerConditions.length, 2);
  assert.deepEqual(
    providerConditions.map((condition) => condition.sourceProvider).sort(),
    ["provider-a", "provider-b"],
  );
  assert.deepEqual(
    (providerConditions[0]?.sourceId as { in?: string[] }).in,
    ["1", "2"],
  );
}

function isNaturalLookup(args: {
  where?: { OR?: Array<Record<string, unknown>> };
}) {
  return Boolean(args.where?.OR?.some((condition) => "name" in condition));
}

function dogRow(overrides: Partial<DogRow>): DogRow {
  return {
    id: "dog",
    name: "Dog",
    earBrand: null,
    sourceProvider: null,
    sourceId: null,
    whelpDate: null,
    sire: null,
    dam: null,
    ...overrides,
  };
}

async function captureWarnings(run: () => Promise<void>) {
  const warnings: Array<Record<string, unknown>> = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    try {
      warnings.push(JSON.parse(String(args[0])) as Record<string, unknown>);
    } catch {
      // Keep the test focused on structured logger events.
    }
  };
  try {
    await run();
  } finally {
    console.warn = originalWarn;
  }
  return warnings;
}
