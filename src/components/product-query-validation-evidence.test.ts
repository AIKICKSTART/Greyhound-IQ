import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  findProductQueryValidationIssues,
  PRODUCT_QUERY_VALIDATION_CONTRACTS,
  PRODUCT_QUERY_VALIDATION_EVIDENCE_FILE,
  PRODUCT_QUERY_VALIDATION_EXPECTED_GAIN,
  PRODUCT_QUERY_VALIDATION_MASTER_EVIDENCE,
  PRODUCT_QUERY_VALIDATION_REQUIREMENT_IDS,
  PRODUCT_QUERY_VALIDATION_SCOPE,
  PRODUCT_QUERY_VALIDATION_TEST_FILE,
} from "./product-query-validation-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-QUERY-VALIDATION

const REQUIREMENT_ID = "GLOBAL.FUNC.query-validation" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, "Validate query parameters.");
assert.deepEqual(PRODUCT_QUERY_VALIDATION_REQUIREMENT_IDS, [REQUIREMENT_ID]);
assert.equal(PRODUCT_QUERY_VALIDATION_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_QUERY_VALIDATION_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_QUERY_VALIDATION_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_QUERY_VALIDATION_EVIDENCE_FILE,
  PRODUCT_QUERY_VALIDATION_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_QUERY_VALIDATION_SCOPE, /source-static/i);
assert.match(PRODUCT_QUERY_VALIDATION_SCOPE, /11 previously raw/i);
assert.match(PRODUCT_QUERY_VALIDATION_SCOPE, /strict bounded Zod schema/i);
assert.match(PRODUCT_QUERY_VALIDATION_SCOPE, /repeated values fail/i);
assert.match(PRODUCT_QUERY_VALIDATION_SCOPE, /does not prove hydrated browser/i);

assert.equal(PRODUCT_QUERY_VALIDATION_CONTRACTS.length, 11);
assert.deepEqual(findProductQueryValidationIssues(PRODUCT_QUERY_VALIDATION_CONTRACTS), []);
assert.deepEqual(
  PRODUCT_QUERY_VALIDATION_CONTRACTS.map(({ id }) => id),
  [
    "PAGE.LISTINGS.NEW.PREFILL",
    "PAGE.DISCOVER.SEARCH",
    "PAGE.DOGS.SEARCH",
    "PAGE.MESSAGES.THREAD",
    "API.FEED.PAGE",
    "API.FEED.COMMENTS.PAGE",
    "API.DOGS.SEARCH",
    "API.DISCOVER.SEARCH",
    "API.MESSAGES.SEARCH",
    "API.LISTINGS.SEARCH",
    "API.PROFILES.MESSAGING.SEARCH",
  ],
);

const validatorSource = source("src/lib/query-validation.ts");
for (const contract of PRODUCT_QUERY_VALIDATION_CONTRACTS) {
  const boundarySource = source(contract.sourceFile);
  assert.ok(
    boundarySource.includes(contract.schemaSymbol),
    `${contract.id}: schema import missing`,
  );
  assert.ok(
    boundarySource.includes(contract.parseToken),
    `${contract.id}: boundary parse missing`,
  );
  assert.ok(
    boundarySource.includes(contract.failureToken),
    `${contract.id}: invalid-query behavior missing`,
  );
  assert.match(
    variableStatementSource(validatorSource, contract.schemaSymbol),
    /\.strict\(\)/,
    `${contract.id}: schema must reject unknown query keys`,
  );
  if (contract.behavior === "api-validation-error") {
    assert.ok(
      contract.sourceFile.includes("/api/"),
      `${contract.id}: API behavior attached to non-API source`,
    );
  } else {
    assert.ok(
      contract.sourceFile.endsWith("page.tsx"),
      `${contract.id}: page fallback attached to non-page source`,
    );
  }
}

for (const token of [
  "dogId: queryIdentifierSchema.optional()",
  "title: searchTextSchema(100).optional()",
  "price: z",
  "feedPageQuerySchema",
  "cursor: z.string().trim().min(1).max(512)",
  "feedCommentPageQuerySchema",
  "messageSearchQuerySchema",
  "messageThreadQuerySchema",
  "listingApiQuerySchema",
  "queryParamsObject",
  "searchParams.getAll(key)",
]) {
  assert.ok(validatorSource.includes(token), `query validator missing ${token}`);
}

const unitTestSource = source("src/lib/query-validation.test.ts");
for (const invalidCase of [
  '{ dogId: "../dog" }',
  '{ dogId: ["dog_1", "dog_2"] }',
  '{ price: "Infinity" }',
  '{ limit: "51" }',
  '{ cursor: "bad cursor" }',
  '{ before: "../message" }',
  '{ state: "XX" }',
  '{ unknown: "value" }',
  "q=one&q=two&limit=20",
]) {
  assert.ok(unitTestSource.includes(invalidCase), `missing invalid case ${invalidCase}`);
}

assert.deepEqual(
  findProductQueryValidationIssues([
    ...PRODUCT_QUERY_VALIDATION_CONTRACTS,
    PRODUCT_QUERY_VALIDATION_CONTRACTS[0],
  ]),
  ["PAGE.LISTINGS.NEW.PREFILL:DUPLICATE"],
);
assert.deepEqual(
  findProductQueryValidationIssues([
    {
      ...PRODUCT_QUERY_VALIDATION_CONTRACTS[0],
      route: "broken",
      schemaSymbol: "",
      failureToken: "",
    },
  ]),
  [
    "PAGE.LISTINGS.NEW.PREFILL:FAILURE_BEHAVIOR_MISSING",
    "PAGE.LISTINGS.NEW.PREFILL:INVALID_ROUTE",
    "PAGE.LISTINGS.NEW.PREFILL:VALIDATION_BINDING_MISSING",
  ],
);

const evidenceSource = source(PRODUCT_QUERY_VALIDATION_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Query-validation evidence passed in isolation: 11 formerly raw listing, search, cursor, and filter boundaries are strict, bounded, duplicate-aware, and fail safely; exact +1 central wiring is ready.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function variableStatementSource(value: string, symbol: string) {
  const start = value.indexOf(`export const ${symbol} =`);
  assert.ok(start >= 0, `Missing schema ${symbol}`);
  const end = value.indexOf(";", start);
  assert.ok(end > start, `Missing schema end ${symbol}`);
  return value.slice(start, end + 1);
}
