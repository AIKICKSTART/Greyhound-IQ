import assert from "node:assert/strict";

import {
  auditProductionSqlSafety,
  inspectProductionSqlSource,
} from "./check-production-sql-safety";

const safe = inspectProductionSqlSource(
  "src/lib/safe.ts",
  [
    'import { Prisma } from "@prisma/client";',
    "async function safe(prisma: any, id: string) {",
    "  await prisma.$queryRaw`SELECT * FROM \"User\" WHERE id = ${id}`;",
    "  await prisma.$executeRaw(Prisma.sql`DELETE FROM \"Job\" WHERE id = ${id}`);",
    "}",
  ].join("\n"),
);
assert.deepEqual(safe.violations, []);
assert.equal(safe.safeRawOperationCount, 2);

const unsafeFixtures = [
  {
    source: 'prisma.$queryRawUnsafe("SELECT " + userInput);',
    code: "UNSAFE_RAW_METHOD",
  },
  {
    source: 'prisma.$executeRaw("DELETE FROM Job WHERE id = " + userInput);',
    code: "UNPARAMETERIZED_RAW_CALL",
  },
  {
    source: "const query = prisma.$queryRaw; query(userInput);",
    code: "DETACHED_RAW_METHOD",
  },
  {
    source: 'prisma["$queryRaw"](Prisma.sql`SELECT 1`);',
    code: "DYNAMIC_RAW_METHOD",
  },
  {
    source: "Prisma.raw(userInput);",
    code: "PRISMA_RAW",
  },
  {
    source: "const { $queryRaw: query } = prisma; query(userInput);",
    code: "DETACHED_RAW_METHOD",
  },
  {
    source: "const { raw: unsafeFragment } = Prisma; unsafeFragment(userInput);",
    code: "PRISMA_RAW",
  },
] as const;

for (const [index, fixture] of unsafeFixtures.entries()) {
  const inspection = inspectProductionSqlSource(
    `src/lib/unsafe-${index}.ts`,
    fixture.source,
  );
  assert.ok(
    inspection.violations.some((violation) => violation.code === fixture.code),
    `${fixture.code}: negative fixture must be rejected`,
  );
}

const repositoryAudit = auditProductionSqlSafety(process.cwd());
assert.deepEqual(
  repositoryAudit.violations,
  [],
  "production source must not bypass parameterized Prisma raw operations",
);
assert.ok(
  repositoryAudit.safeRawOperationCount > 0,
  "the policy must exercise a non-vacuous production raw SQL surface",
);
assert.ok(repositoryAudit.scannedFiles > 0);

console.log(
  `Production SQL safety tests passed: ${repositoryAudit.safeRawOperationCount} parameterized raw operations verified.`,
);
