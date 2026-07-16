import assert from "node:assert/strict";

const CONFIRMATION = "delete-expired-rate-limits-on-disposable-loopback-55734";
const FIXTURE_PREFIX = "integration:rate-limit-prune:";

const inputUrl = process.env.RATE_LIMIT_MAINTENANCE_TEST_DATABASE_URL?.trim();
assert.ok(inputUrl, "RATE_LIMIT_MAINTENANCE_TEST_DATABASE_URL is required");
assert.equal(
  process.env.RATE_LIMIT_MAINTENANCE_TEST_CONFIRM,
  CONFIRMATION,
  `RATE_LIMIT_MAINTENANCE_TEST_CONFIRM must equal ${CONFIRMATION}`,
);

const databaseUrl = new URL(inputUrl);
assert.ok(
  databaseUrl.protocol === "postgresql:" || databaseUrl.protocol === "postgres:",
  "The maintenance integration target must be PostgreSQL",
);
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname),
  "The maintenance integration target must be literal loopback",
);
assert.equal(
  databaseUrl.port,
  "55734",
  "The maintenance integration test is restricted to the disposable replay port 55734",
);
assert.equal(
  databaseUrl.pathname,
  "/postgres",
  "The disposable replay database must be the isolated postgres database",
);

// Authenticate with the disposable database owner, then shed BYPASSRLS before
// Prisma opens any connection. The production cleanup is thereby exercised as
// the same NOBYPASSRLS runtime role used by the application contract.
databaseUrl.searchParams.set("options", "-c role=greyhoundiq_runtime");
databaseUrl.searchParams.set("connection_limit", "4");
process.env.DATABASE_URL = databaseUrl.toString();

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
const { prisma } = await import("../src/lib/db");
const { withDbSystemContext } = await import("../src/lib/db-context");
const { pruneExpiredRateLimits } = await import(
  "../src/lib/rate-limit-maintenance"
);

const expiredAt = new Date(Date.now() - 60_000);
const futureAt = new Date(Date.now() + 3_600_000);
const bulkKeys = Array.from(
  { length: 5_001 },
  (_, index) => `${FIXTURE_PREFIX}bulk:${index}`,
);
const lockedKey = `${FIXTURE_PREFIX}locked`;
const freeKey = `${FIXTURE_PREFIX}free`;
const futureKey = `${FIXTURE_PREFIX}future`;

try {
  const [identity] = await prisma.$queryRaw<
    Array<{ role: string; superuser: boolean; bypassRls: boolean }>
  >`
    SELECT
      current_user AS "role",
      rol.rolsuper AS "superuser",
      rol.rolbypassrls AS "bypassRls"
    FROM pg_roles AS rol
    WHERE rol.rolname = current_user
  `;
  assert.deepEqual(identity, {
    role: "greyhoundiq_runtime",
    superuser: false,
    bypassRls: false,
  });

  await deleteFixtures();
  await withDbSystemContext((tx) =>
    tx.rateLimit.createMany({
      data: [
        ...bulkKeys.map((key) => ({ key, count: 1, resetAt: expiredAt })),
        { key: futureKey, count: 1, resetAt: futureAt },
      ],
    }),
  );

  assert.equal(
    await prisma.rateLimit.count({
      where: { key: { startsWith: FIXTURE_PREFIX } },
    }),
    0,
    "The runtime role must not see limiter rows without system context",
  );
  assert.equal(
    (
      await prisma.rateLimit.deleteMany({
        where: { key: { startsWith: FIXTURE_PREFIX } },
      })
    ).count,
    0,
    "The runtime role must not delete limiter rows without system context",
  );

  const bulkResult = await pruneExpiredRateLimits();
  assert.equal(bulkResult.status, "drained");
  assert.equal(bulkResult.deleted, bulkKeys.length);
  assert.equal(bulkResult.batches, 2);
  assert.equal(
    await withDbSystemContext((tx) =>
      tx.rateLimit.count({ where: { key: futureKey } }),
    ),
    1,
    "Cleanup must preserve unexpired rows",
  );

  await withDbSystemContext((tx) =>
    tx.rateLimit.createMany({
      data: [
        { key: lockedKey, count: 1, resetAt: expiredAt },
        { key: freeKey, count: 1, resetAt: expiredAt },
      ],
    }),
  );

  let markLockReady!: () => void;
  let releaseLock!: () => void;
  const lockReady = new Promise<void>((resolve) => {
    markLockReady = resolve;
  });
  const lockRelease = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const locker = withDbSystemContext(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "key"
        FROM "RateLimit"
        WHERE "key" = ${lockedKey}
        FOR UPDATE
      `;
      markLockReady();
      await lockRelease;
    },
    { maxWait: 5_000, timeout: 30_000 },
  );

  await lockReady;
  try {
    const contended = await pruneExpiredRateLimits();
    assert.equal(contended.status, "backlog", JSON.stringify(contended));
    assert.equal(contended.deleted, 1);
    assert.equal(contended.stalled, true);
  } finally {
    releaseLock();
    await locker;
  }

  const resumed = await pruneExpiredRateLimits();
  assert.equal(resumed.status, "drained");
  assert.equal(resumed.deleted, 1);

  console.log(
    JSON.stringify({
      ok: true,
      role: identity.role,
      rlsDeniedWithoutSystemContext: true,
      bulkDeleted: bulkResult.deleted,
      bulkBatches: bulkResult.batches,
      skipLockedPartialProgress: true,
      resumedAfterLock: true,
      unexpiredPreserved: true,
    }),
  );
} finally {
  await deleteFixtures();
  await prisma.$disconnect();
}

async function deleteFixtures() {
  await withDbSystemContext((tx) =>
    tx.rateLimit.deleteMany({
      where: { key: { startsWith: FIXTURE_PREFIX } },
    }),
  );
}
}
