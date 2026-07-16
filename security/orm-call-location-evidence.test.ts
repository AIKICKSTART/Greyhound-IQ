import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditOrmCallLocations,
  digestLocations,
  discoverOrmCallLocations,
  ORM_CALL_LOCATION_MASTER_EVIDENCE,
  ORM_CALL_LOCATION_REQUIREMENT_ID,
  ORM_CALL_LOCATION_SCOPE,
  PRODUCTION_ORM_LOCATION_BASELINE,
  type OrmCallLocationBaseline,
  type OrmLocationSource,
} from "./orm-call-location-evidence";

const sources = collectProductionSources("src");
const current = auditOrmCallLocations(
  sources,
  PRODUCTION_ORM_LOCATION_BASELINE,
);

assert.ok(sources.length > 600);
assert.deepEqual(current.issues, []);
assert.equal(current.locations.length, 940);
assert.equal(current.digest, PRODUCTION_ORM_LOCATION_BASELINE.digest);
assert.equal(new Set(current.locations.map(({ key }) => key)).size, 940);
assert.equal(
  new Set(current.locations.map(({ sourceFile }) => sourceFile)).size,
  99,
);
assert.equal(
  new Set(
    current.locations.map(
      ({ sourceFile, sourceSymbol }) => `${sourceFile}:${sourceSymbol}`,
    ),
  ).size,
  446,
);
assert.equal(
  current.locations.filter(({ model }) => model !== null).length,
  864,
);
assert.equal(
  current.locations.filter(({ model }) => model === null).length,
  76,
);
assert.equal(
  current.locations.filter(({ invocation }) => invocation === "call").length,
  878,
);
assert.equal(
  current.locations.filter(({ invocation }) => invocation === "tagged-template")
    .length,
  62,
);
assert.deepEqual(operationCounts(current.locations), {
  $executeRaw: 21,
  $queryRaw: 50,
  $transaction: 5,
  aggregate: 2,
  count: 84,
  create: 91,
  createMany: 15,
  delete: 11,
  deleteMany: 43,
  findFirst: 116,
  findFirstOrThrow: 3,
  findMany: 185,
  findUnique: 94,
  findUniqueOrThrow: 3,
  groupBy: 17,
  update: 119,
  updateMany: 50,
  upsert: 31,
});

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === ORM_CALL_LOCATION_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Locate the real repository or ORM call for every database operation.",
);
const evidence =
  ORM_CALL_LOCATION_MASTER_EVIDENCE[ORM_CALL_LOCATION_REQUIREMENT_ID];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing ORM location evidence: ${path}`);
}
assert.match(ORM_CALL_LOCATION_SCOPE, /non-test production files under src/i);
assert.match(ORM_CALL_LOCATION_SCOPE, /nearest source symbol/i);
assert.match(ORM_CALL_LOCATION_SCOPE, /repository\/ORM call location only/i);
assert.match(ORM_CALL_LOCATION_SCOPE, /does not claim generated SQL capture/i);
assert.match(ORM_CALL_LOCATION_SCOPE, /runtime execution/i);
assert.match(ORM_CALL_LOCATION_SCOPE, /production readiness/i);

const fixture = source(
  [
    "export async function locateFixture(prisma: PrismaClient) {",
    "  const users = prisma.user;",
    "  await users.findMany({ where: { active: true } });",
    "  await prisma.$transaction([]);",
    "  await prisma.$queryRaw`SELECT 1`;",
    "  await prisma.$executeRaw`SELECT 1`;",
    "}",
  ].join("\n"),
);
const fixtureLocations = discoverOrmCallLocations(fixture.path, fixture.source);
assert.equal(fixtureLocations.length, 4);
assert.deepEqual(
  fixtureLocations.map(({ operation }) => operation).sort(),
  ["$executeRaw", "$queryRaw", "$transaction", "findMany"],
);
assert.ok(
  fixtureLocations.every(
    ({ sourceFile, sourceSymbol, line, column }) =>
      sourceFile === fixture.path &&
      sourceSymbol === "locateFixture" &&
      line > 0 &&
      column > 0,
  ),
);
assert.equal(
  fixtureLocations.find(({ operation }) => operation === "findMany")?.model,
  "user",
);
const fixtureBaseline: OrmCallLocationBaseline = {
  callCount: fixtureLocations.length,
  digest: digestLocations(fixtureLocations.toSorted((left, right) =>
    left.key.localeCompare(right.key),
  )),
};
assert.deepEqual(
  auditOrmCallLocations([fixture], fixtureBaseline).issues,
  [],
);

assertIssue([], PRODUCTION_ORM_LOCATION_BASELINE, "ORM_LOCATION_SOURCE_INVENTORY_VACUOUS");
assertIssue(
  [source("export function noDatabaseCall() { return true; }")],
  { callCount: 0, digest: digestLocations([]) },
  "ORM_LOCATION_CALL_INVENTORY_VACUOUS",
);
assertIssue(
  [fixture, fixture],
  fixtureBaseline,
  "ORM_LOCATION_SOURCE_PATH_DUPLICATE",
);
assertIssue(
  [{ ...fixture, path: "src/lib/fixture.test.ts" }],
  fixtureBaseline,
  "ORM_LOCATION_SOURCE_PATH_INVALID",
);
assertIssue(
  [source("export function broken( {")],
  { callCount: 0, digest: digestLocations([]) },
  "ORM_LOCATION_SOURCE_PARSE_ERROR",
);
assertIssue(
  [fixture],
  { ...fixtureBaseline, callCount: fixtureBaseline.callCount + 1 },
  "ORM_LOCATION_CALL_COUNT_DRIFT",
);
assertIssue(
  [fixture],
  { ...fixtureBaseline, digest: "0".repeat(64) },
  "ORM_LOCATION_DIGEST_DRIFT",
);
const moduleFixture = source("prisma.user.findMany();");
const moduleLocations = discoverOrmCallLocations(
  moduleFixture.path,
  moduleFixture.source,
);
assert.equal(moduleLocations.length, 1);
assertIssue(
  [moduleFixture],
  {
    callCount: 1,
    digest: digestLocations(moduleLocations),
  },
  "ORM_LOCATION_SOURCE_SYMBOL_MISSING",
);

console.log(
  `ORM call-location evidence passed: ${current.locations.length} production Prisma calls in ${new Set(current.locations.map(({ sourceFile }) => sourceFile)).size} source files are bound to exact files, symbols, lines, receivers/models, operations, and a dependency-sensitive digest.`,
);

function collectProductionSources(root: string): OrmLocationSource[] {
  return walk(root)
    .filter((path) => [".ts", ".tsx"].includes(extname(path)))
    .map((path) => path.replaceAll("\\", "/"))
    .filter(
      (path) =>
        !/(?:^|\/)[^/]+\.(?:test|spec|stories)\.tsx?$/u.test(path) &&
        !/(?:^|\/)__tests__(?:\/|$)/u.test(path),
    )
    .sort()
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
}

function walk(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function source(value: string): OrmLocationSource {
  return { path: "src/lib/orm-location-fixture.ts", source: value };
}

function assertIssue(
  fixtureSources: readonly OrmLocationSource[],
  baseline: OrmCallLocationBaseline,
  expected: string,
) {
  const issues = auditOrmCallLocations(fixtureSources, baseline).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function operationCounts(locations: readonly { operation: string }[]) {
  return Object.fromEntries(
    Object.entries(Object.groupBy(locations, ({ operation }) => operation))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([operation, rows]) => [operation, rows?.length ?? 0]),
  );
}
