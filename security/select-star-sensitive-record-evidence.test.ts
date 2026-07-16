import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditSelectStarSensitiveRecords,
  REVIEWED_SELECT_STAR_PROJECTIONS,
  SELECT_STAR_SENSITIVE_RECORD_MASTER_EVIDENCE,
  SELECT_STAR_SENSITIVE_RECORD_REQUIREMENT_ID,
  SELECT_STAR_SENSITIVE_RECORD_SCOPE,
  type RawSqlSource,
  type ReviewedSelectStarProjection,
} from "./select-star-sensitive-record-evidence";

const EXPECTED_RAW_SQL_SOURCE_PATHS = [
  "src/app/admin/jobs/page.tsx",
  "src/app/admin/safety/page.tsx",
  "src/lib/account-service.ts",
  "src/lib/admin-access-contract.ts",
  "src/lib/admin-reporting.ts",
  "src/lib/billing/usage-delivery-worker-store.ts",
  "src/lib/db-context.ts",
  "src/lib/db-stats.ts",
  "src/lib/db.ts",
  "src/lib/feed-service.ts",
  "src/lib/live/dog-profile-sync.ts",
  "src/lib/live/status.ts",
  "src/lib/live/sync.ts",
  "src/lib/media-service.ts",
  "src/lib/organization-team-service.ts",
  "src/lib/queries.ts",
  "src/lib/rate-limit-maintenance.ts",
  "src/lib/rate-limit.ts",
  "src/lib/scheduled-task-control.ts",
  "src/lib/signup-acceptance-worker-store.ts",
  "src/lib/social-actor-service.ts",
  "src/lib/user-export-service.ts",
] as const;

const sources = discoverRawSqlSources("src");
const audit = auditSelectStarSensitiveRecords(sources);

assert.deepEqual(
  sources.map(({ path }) => path),
  EXPECTED_RAW_SQL_SOURCE_PATHS,
);
assert.equal(audit.sourceCount, 22);
assert.equal(audit.rawQueryPrimitiveCount, 118);
assert.deepEqual(audit.issues, []);
assert.deepEqual(audit.records, [
  {
    path: "src/lib/feed-service.ts",
    line: 661,
    projection: "ranked.*",
    relation: "ranked",
    signature: "SELECT ranked.* FROM ranked",
    contextSha256:
      "8b186a4709c1b0a52d8ede1248ef4e319c9b0e2b729145841740d4aa488c85a9",
  },
  {
    path: "src/lib/queries.ts",
    line: 2068,
    projection: "*",
    relation: null,
    signature: "SELECT *",
    contextSha256:
      "5f3acfcd3c2d9d98fb5e8060a83d2fed1b13b359a8c02b3aa3e2f99752902d52",
  },
]);
assert.equal(REVIEWED_SELECT_STAR_PROJECTIONS.length, 2);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === SELECT_STAR_SENSITIVE_RECORD_REQUIREMENT_ID,
);
assert.equal(requirement?.requirement, "Do not use SELECT * for sensitive records.");
const evidence =
  SELECT_STAR_SENSITIVE_RECORD_MASTER_EVIDENCE[
    SELECT_STAR_SENSITIVE_RECORD_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing SELECT-star evidence: ${path}`);
}
assert.match(SELECT_STAR_SENSITIVE_RECORD_SCOPE, /every production TypeScript/i);
assert.match(SELECT_STAR_SENSITIVE_RECORD_SCOPE, /exact field-construction context digest/i);
assert.match(SELECT_STAR_SENSITIVE_RECORD_SCOPE, /not database-table or sensitive-record stars/i);
assert.match(SELECT_STAR_SENSITIVE_RECORD_SCOPE, /deployed query capture remain separate/i);

assertIssue([], [], "SELECT_STAR_SOURCE_INVENTORY_VACUOUS");
assertIssue([], [], "SELECT_STAR_RAW_SQL_INVENTORY_VACUOUS");
assertIssue(
  [{ path: "fixture.ts", source: "export const value = 1;" }],
  [],
  "SELECT_STAR_SOURCE_WITHOUT_RAW_SQL",
);
assertIssue(
  [source("const rows = db.$queryRaw`SELECT * FROM private_record`;")],
  [],
  "SELECT_STAR_PROJECTION_UNREVIEWED",
);
assertIssue(
  [source("const rows = db.$queryRaw`SELECT id, private_record.* FROM private_record`;")],
  [],
  "SELECT_STAR_PROJECTION_UNREVIEWED",
);
assert.deepEqual(
  auditSelectStarSensitiveRecords(
    [source("// SELECT * FROM ignored\nconst rows = db.$queryRaw`SELECT id FROM safe`;")],
    [],
  ).issues,
  [],
);

const reviewedFixtureSource = source(
  "const rows = db.$queryRaw`WITH safe AS (SELECT 1 AS id) SELECT safe.* FROM safe`;",
);
const fixtureRecord = auditSelectStarSensitiveRecords(
  [reviewedFixtureSource],
  [],
).records[0];
assert.ok(fixtureRecord);
const reviewedFixture = review(fixtureRecord);
assert.deepEqual(
  auditSelectStarSensitiveRecords([reviewedFixtureSource], [reviewedFixture]).issues,
  [],
);
assertIssue(
  [
    source(
      "const rows = db.$queryRaw`WITH safe AS (SELECT 1 AS id, 'secret' AS token) SELECT safe.* FROM safe`;",
    ),
  ],
  [reviewedFixture],
  "SELECT_STAR_REVIEW_CONTEXT_DRIFT",
);
assertIssue(
  [reviewedFixtureSource],
  [reviewedFixture, reviewedFixture],
  "SELECT_STAR_REVIEW_DUPLICATE",
);
assertIssue(
  [reviewedFixtureSource],
  [{ ...reviewedFixture, disposition: "too short" }],
  "SELECT_STAR_REVIEW_DISPOSITION_INCOMPLETE",
);
assertIssue(
  [source("const rows = db.$queryRaw`SELECT id FROM safe`;")],
  [reviewedFixture],
  "SELECT_STAR_REVIEW_STALE",
);

console.log(
  `Sensitive SELECT-star evidence passed: ${audit.rawQueryPrimitiveCount} raw-SQL primitives across ${audit.sourceCount} production sources; ${audit.records.length} exact internal CTE projections reviewed and zero table/entity star projections.`,
);

function discoverRawSqlSources(root: string): RawSqlSource[] {
  const sources: RawSqlSource[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      sources.push(...discoverRawSqlSources(path));
      continue;
    }
    if (!/\.(?:ts|tsx)$/u.test(entry.name) || /\.(?:test|spec)\./u.test(entry.name)) {
      continue;
    }
    const source = readFileSync(path, "utf8");
    if (
      /\$(?:queryRaw|executeRaw)(?:Unsafe)?\b|\bPrisma\.sql\b/u.test(source)
    ) {
      sources.push({ path: path.replaceAll("\\", "/"), source });
    }
  }
  return sources.toSorted((left, right) => left.path.localeCompare(right.path));
}

function assertIssue(
  fixtureSources: RawSqlSource[],
  reviews: ReviewedSelectStarProjection[],
  expected: string,
) {
  const issues = auditSelectStarSensitiveRecords(fixtureSources, reviews).issues;
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}

function source(value: string): RawSqlSource {
  return { path: "fixture.ts", source: value };
}

function review(
  record: (typeof audit.records)[number],
): ReviewedSelectStarProjection {
  return {
    path: record.path,
    signature: record.signature,
    contextSha256: record.contextSha256,
    disposition:
      "This exact internal CTE projection is accepted because the synthetic CTE explicitly constructs a non-sensitive identifier field. Any CTE context change must invalidate this review digest.",
  };
}
