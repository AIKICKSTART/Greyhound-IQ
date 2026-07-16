import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  DOG_PUBLIC_DETAIL_EVIDENCE_PATH,
  DOG_PUBLIC_DETAIL_VERIFY_CONFIRMATION,
  assertDogPublicDetailVerifierTarget,
  validateDogPublicDetailEvidence,
} from "./check-dog-public-detail-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertDogPublicDetailVerifierTarget(
    runtimeUrl,
    DOG_PUBLIC_DETAIL_VERIFY_CONFIRMATION,
  ).toString(),
  runtimeUrl,
);
for (const invalid of [
  "postgresql://greyhoundiq_runtime@127.0.0.1:55733/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime:secret@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@localhost:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/postgres",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq?host=db.invalid",
]) {
  assert.throws(() =>
    assertDogPublicDetailVerifierTarget(
      invalid,
      DOG_PUBLIC_DETAIL_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertDogPublicDetailVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, DOG_PUBLIC_DETAIL_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateDogPublicDetailEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) =>
    candidate.queryId === "DB.RACING.DOG.OPEN.PUBLIC_DETAIL_BUNDLE",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/queries.ts");
assert.equal(
  operation.sourceSymbol,
  "getDogById plus src/lib/pedigree.ts#getDogPedigree",
);
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 359);

const statements = (evidence.proof as Record<string, unknown>)
  .statements as Array<Record<string, unknown>>;
assert.equal(operation.normalizedSqlVariants?.length, statements.length);
assert.deepEqual(
  operation.normalizedSqlVariants?.map((variant) => ({
    variant: variant.variant,
    normalizedSql: variant.normalizedSql,
  })),
  statements.map((statement) => ({
    variant: statement.variant,
    normalizedSql: (statement.observedSql as Record<string, unknown>)
      .normalizedSql,
  })),
);
assert.ok(
  operation.tests.includes("scripts/check-dog-public-detail-postgres.test.ts"),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(DOG_PUBLIC_DETAIL_EVIDENCE_PATH),
  ),
);

const queriesSource = readFileSync(resolve(root, "src/lib/queries.ts"), "utf8");
const dogQuery = between(
  queriesSource,
  "export const getDogById",
  "export async function getMyDogOwnership",
);
for (const contract of [
  "const DOG_DETAIL_FORM_ENTRY_LIMIT = 64;",
  "const DOG_DETAIL_PROFILE_FORM_LIMIT = 20;",
  "const DOG_DETAIL_RUNNER_LIMIT = 20;",
  "const DOG_DETAIL_OWNERSHIP_LIMIT = 16;",
  "take: DOG_DETAIL_FORM_ENTRY_LIMIT",
  "take: DOG_DETAIL_PROFILE_FORM_LIMIT",
  "take: DOG_DETAIL_RUNNER_LIMIT",
  "take: DOG_DETAIL_OWNERSHIP_LIMIT",
  'where: { status: "approved" }',
]) {
  assert.ok(queriesSource.includes(contract) || dogQuery.includes(contract), contract);
}
assert.doesNotMatch(dogQuery, /email:\s*true|subscriptionTier:\s*true/);
assert.match(dogQuery, /careerStats:\s*\{/);
assert.match(dogQuery, /starts:\s*careerStarts/);
assert.match(dogQuery, /finishGroups\.find\(\(row\) => row\.finish === 1\)/);
assert.match(dogQuery, /placings:\s*finishGroups\.reduce/);

const pedigreeSource = readFileSync(resolve(root, "src/lib/pedigree.ts"), "utf8");
assert.match(pedigreeSource, /const MAX_PEDIGREE_GENERATIONS = 5;/);
assert.match(pedigreeSource, /Math\.min\(\s*MAX_PEDIGREE_GENERATIONS/);
assert.match(pedigreeSource, /gen < boundedGenerations/);

const pageSource = readFileSync(resolve(root, "src/app/dogs/[id]/page.tsx"), "utf8");
assert.match(pageSource, /dog\.careerStats\.starts/);
assert.match(pageSource, /dog\.careerStats\.wins/);
assert.match(pageSource, /dog\.careerStats\.placings/);

console.log(
  "dog public-detail database evidence passed: bounded least-privilege reads, exact anonymous replay and five-generation pedigree proof",
);

function between(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return source.slice(from, to);
}
