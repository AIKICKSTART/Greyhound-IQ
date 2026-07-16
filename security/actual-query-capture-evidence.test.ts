import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import {
  ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS,
  ACTUAL_QUERY_CAPTURE_MASTER_EVIDENCE,
  ACTUAL_QUERY_CAPTURE_RESIDUAL_GAPS,
  VERIFIED_ACTUAL_QUERY_CAPTURE_REQUIREMENT_IDS,
} from "./actual-query-capture-evidence";
import {
  DATABASE_OPERATIONS,
  type DatabaseOperationContract,
} from "./database-operations";

type JsonRecord = Record<string, unknown>;
type SqlCapture = JsonRecord & {
  normalizedSql: string;
  sha256: string;
  parameterCount: number;
  persistedParameterValues: false;
};

const actualQueryRequirementIds = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.id.startsWith("security.actual-query-capture."),
).map((requirement) => requirement.id);
const classifiedRequirementIds = [
  ...VERIFIED_ACTUAL_QUERY_CAPTURE_REQUIREMENT_IDS,
  ...Object.keys(ACTUAL_QUERY_CAPTURE_RESIDUAL_GAPS),
];
assert.equal(actualQueryRequirementIds.length, 18);
assert.deepEqual(
  classifiedRequirementIds.toSorted(),
  actualQueryRequirementIds.toSorted(),
);
assert.equal(new Set(classifiedRequirementIds).size, 18);

for (const requirementId of VERIFIED_ACTUAL_QUERY_CAPTURE_REQUIREMENT_IDS) {
  const evidence = ACTUAL_QUERY_CAPTURE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "verified");
  for (const path of evidence.evidence) {
    assert.ok(existsSync(path), `${requirementId}: missing ${path}`);
  }
}

assert.equal(DATABASE_OPERATIONS.length, 27);
assert.equal(
  new Set(DATABASE_OPERATIONS.map((operation) => operation.queryId)).size,
  DATABASE_OPERATIONS.length,
);
for (const operation of DATABASE_OPERATIONS) validateOperation(operation);

const proofs = new Map<string, { artifactPath: string; proof: JsonRecord }>();
let capturedStatementCount = 0;
let firstDocument: JsonRecord | undefined;
let firstSql: SqlCapture | undefined;

for (const artifactPath of ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS) {
  const raw = readFileSync(artifactPath, "utf8");
  const document = asRecord(JSON.parse(raw), `${artifactPath}: document`);
  firstDocument ??= document;
  validateArtifactSafety(document, artifactPath, raw);

  for (const proof of getProofs(document)) {
    const queryId = requiredString(proof.queryId, `${artifactPath}: queryId`);
    assert.ok(!proofs.has(queryId), `${queryId}: duplicate runtime proof`);
    assert.equal(proof.status, "verified", `${queryId}: proof not verified`);
    proofs.set(queryId, { artifactPath, proof });

    const sqlCaptures = getSqlCaptures(proof);
    assert.ok(sqlCaptures.length > 0, `${queryId}: no generated SQL captured`);
    for (const sql of sqlCaptures) {
      validateSqlCapture(sql, queryId);
      firstSql ??= sql;
      capturedStatementCount += 1;
    }
  }
}

assert.deepEqual(
  [...proofs.keys()].toSorted(),
  DATABASE_OPERATIONS.map((operation) => operation.queryId).toSorted(),
);
assert.ok(capturedStatementCount >= DATABASE_OPERATIONS.length);

for (const operation of DATABASE_OPERATIONS) {
  const runtimeProof = proofs.get(operation.queryId);
  assert.ok(runtimeProof, `${operation.queryId}: runtime proof missing`);
  assert.equal(runtimeProof.proof.sourceFile, operation.sourceFile);
  assert.equal(runtimeProof.proof.sourceSymbol, operation.sourceSymbol);
}

const timeoutGaps = DATABASE_OPERATIONS.filter(
  (operation) => operation.timeoutMilliseconds == null,
).map((operation) => operation.queryId);
assert.deepEqual(timeoutGaps, []);
assert.ok(VERIFIED_ACTUAL_QUERY_CAPTURE_REQUIREMENT_IDS.includes(
  "security.actual-query-capture.timeout",
));
assert.ok(!VERIFIED_ACTUAL_QUERY_CAPTURE_REQUIREMENT_IDS.includes(
  "security.actual-query-capture.locate" as never,
));

const timeoutByQueryId = new Map(
  DATABASE_OPERATIONS.map((operation) => [
    operation.queryId,
    operation.timeoutMilliseconds,
  ]),
);
assert.equal(timeoutByQueryId.get("DB.PULSE.REALTIME_GRANT.REVOKE"), 5_000);
for (const queryId of [
  "DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE",
  "DB.RACING.RACE.SEARCH.READ_BUNDLE",
  "DB.RACING.RACE.OPEN.DETAIL_BUNDLE",
]) {
  assert.equal(timeoutByQueryId.get(queryId), 30_000, queryId);
}

const dbContextSource = readFileSync("src/lib/db-context.ts", "utf8");
for (const runtimeDeadlineContract of [
  "withDbAnonymousQueryDeadline",
  "statementTimeoutMilliseconds",
  "transactionTimeoutMilliseconds",
  "set_config('statement_timeout'",
  "database.invalid_query_deadline",
]) {
  assert.ok(
    dbContextSource.includes(runtimeDeadlineContract),
    `database deadline runtime missing: ${runtimeDeadlineContract}`,
  );
}
assert.ok(
  dbContextSource.indexOf("set_config('statement_timeout'") <
    dbContextSource.indexOf("return fn(tx);", dbContextSource.indexOf("withDbAnonymousQueryDeadline")),
  "PostgreSQL statement timeout must be installed before the bounded callback",
);

const querySource = readFileSync("src/lib/queries.ts", "utf8");
for (const sourceSymbol of [
  "getTodaysMeetings",
  "getRaceById",
  "getPreviousRaceVideoRunners",
  "getRaceExplorerData",
]) {
  const symbolOffset = querySource.indexOf(sourceSymbol);
  assert.ok(symbolOffset >= 0, `${sourceSymbol}: source missing`);
  assert.ok(
    querySource.indexOf("withDbAnonymousQueryDeadline", symbolOffset) >= 0,
    `${sourceSymbol}: runtime deadline missing`,
  );
}
assert.match(querySource, /statementTimeoutMilliseconds: 10_000/);
assert.match(querySource, /transactionTimeoutMilliseconds: 30_000/);

const realtimeSource = readFileSync("src/lib/realtime-service.ts", "utf8");
const revokeRpcSource = sourceBetween(
  realtimeSource,
  "async function revokeRealtimeTopicGrants(",
  "function scopedRealtimeChannel(",
);
assert.match(revokeRpcSource, /request\.abortSignal\?\.\(/);
assert.match(revokeRpcSource, /AbortSignal\.timeout\(REALTIME_RPC_TIMEOUT_MS\)/);
assert.match(realtimeSource, /const REALTIME_RPC_TIMEOUT_MS = 5_000/);
assert.doesNotMatch(revokeRpcSource, /Promise\.race/);

const databaseSource = readFileSync("src/lib/db.ts", "utf8");
for (const guard of [
  "capture-sanitized-statements-on-disposable-loopback-55734",
  'process.env.NODE_ENV === "production"',
  '["127.0.0.1", "::1", "[::1]"].includes(url.hostname)',
  'url.port === "55734"',
  'url.pathname === "/greyhoundiq"',
  'decodeURIComponent(url.username) === "greyhoundiq_runtime"',
]) {
  assert.ok(databaseSource.includes(guard), `capture guard missing: ${guard}`);
}
assert.doesNotMatch(databaseSource, /console\.(?:log|info|warn|error).*params/);

const forgedOperation = {
  ...DATABASE_OPERATIONS[0],
  tests: [],
};
assert.throws(() => validateOperation(forgedOperation), /tests/);

const forgedDocument = structuredClone(firstDocument as JsonRecord);
const forgedSafety = asRecord(forgedDocument.safety, "forged safety");
forgedSafety.productionOrProviderSystemsContacted = true;
assert.throws(
  () => validateArtifactSafety(forgedDocument, "forged.json", JSON.stringify(forgedDocument)),
  /production\/provider contact/,
);

assert.ok(firstSql);
assert.throws(
  () => validateSqlCapture({ ...firstSql, normalizedSql: `${firstSql.normalizedSql} -- drift` }, "forged"),
  /SQL hash drift/,
);

console.log(
  `Actual-query capture evidence passed: ${DATABASE_OPERATIONS.length} source-bound operations, ${capturedStatementCount} sanitized local SQL shapes and bounded runtime deadlines; exhaustive source coverage remains open.`,
);

function validateOperation(operation: DatabaseOperationContract) {
  assert.equal(operation.verificationStatus, "Verified", `${operation.queryId}: status`);
  assert.ok(existsSync(operation.sourceFile), `${operation.queryId}: sourceFile`);
  assert.ok(operation.sourceSymbol.trim(), `${operation.queryId}: sourceSymbol`);
  assert.equal(operation.parameterized, true, `${operation.queryId}: parameterized`);
  assert.ok(operation.boundParameters.length > 0, `${operation.queryId}: placeholders`);
  assert.ok(
    operation.columnsRead.length + operation.columnsWritten.length > 0,
    `${operation.queryId}: columns`,
  );
  assert.ok(
    [operation.tenantPredicate, operation.ownershipPredicate, operation.visibilityPredicate]
      .every((value) => value == null || value.trim().length > 0),
    `${operation.queryId}: predicates`,
  );
  assert.ok(Array.isArray(operation.rowLevelSecurityPolicies));
  assert.ok(operation.expectedRowCount.trim(), `${operation.queryId}: expected rows`);
  assert.ok(
    Number.isInteger(operation.maximumRowCount) &&
      (operation.maximumRowCount as number) >= 0,
    `${operation.queryId}: maximum rows`,
  );
  assert.match(operation.databaseRole, /^(?:greyhoundiq_runtime|service_role)$/);
  assert.ok(
    operation.indexesExpected.length + operation.constraintsReliedOn.length > 0,
    `${operation.queryId}: indexes/constraints`,
  );
  if (operation.operationType !== "select") {
    assert.ok(
      operation.transactionBoundary?.trim() || operation.locks?.length,
      `${operation.queryId}: transaction/locking`,
    );
  }
  assert.ok(operation.returnedDataShape.trim(), `${operation.queryId}: response map`);
  assert.ok(
    Number.isSafeInteger(operation.timeoutMilliseconds) &&
      (operation.timeoutMilliseconds as number) > 0,
    `${operation.queryId}: timeout`,
  );
  assert.ok(operation.tests.length > 0, `${operation.queryId}: tests`);
  for (const testPath of operation.tests) {
    assert.ok(existsSync(testPath), `${operation.queryId}: missing test ${testPath}`);
  }
}

function validateArtifactSafety(
  document: JsonRecord,
  artifactPath: string,
  raw: string,
) {
  assert.equal(document.verdict, "verified", `${artifactPath}: verdict`);
  const safety = asRecord(document.safety, `${artifactPath}: safety`);
  assert.match(requiredString(safety.scope, `${artifactPath}: scope`), /loopback/);
  if (safety.host !== undefined) {
    assert.ok(
      typeof safety.host === "string" &&
        ["127.0.0.1", "::1", "[::1]"].includes(safety.host),
      `${artifactPath}: literal loopback host`,
    );
  }
  if (safety.port !== undefined) assert.equal(safety.port, 55734);
  const noExternalContact =
    safety.productionOrProviderSystemsContacted === false ||
    safety.providerContact === false;
  assert.ok(noExternalContact, `${artifactPath}: production/provider contact`);
  assert.doesNotMatch(raw, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(
    raw,
    /"(?:password|access[_-]?token|refresh[_-]?token|service[_-]?role[_-]?key|database[_-]?url)"\s*:/i,
  );
}

function validateSqlCapture(sql: SqlCapture, queryId: string) {
  assert.ok(sql.normalizedSql.trim(), `${queryId}: empty SQL`);
  assert.ok(Number.isInteger(sql.parameterCount) && sql.parameterCount >= 0);
  assert.equal(sql.persistedParameterValues, false);
  assert.ok(!Object.hasOwn(sql, "params"), `${queryId}: raw params persisted`);
  assert.ok(!Object.hasOwn(sql, "parameterValues"), `${queryId}: values persisted`);
  assert.equal(
    createHash("sha256").update(sql.normalizedSql).digest("hex"),
    sql.sha256,
    `${queryId}: SQL hash drift`,
  );
  if (sql.parameterCount > 0) assert.match(sql.normalizedSql, /\$\d+/);
}

function getProofs(document: JsonRecord) {
  const result: JsonRecord[] = [];
  const proof = optionalRecord(document.proof);
  if (proof && typeof proof.queryId === "string") result.push(proof);
  if (Array.isArray(document.databaseOperationProofs)) {
    result.push(
      ...document.databaseOperationProofs.map((entry, index) =>
        asRecord(entry, `databaseOperationProofs[${index}]`),
      ),
    );
  }
  return result;
}

function getSqlCaptures(proof: JsonRecord): SqlCapture[] {
  const candidates: unknown[] = [
    proof.observedSql,
    optionalRecord(proof.statement)?.observedSql,
    proof.invocation,
  ];
  if (Array.isArray(proof.variants)) {
    candidates.push(...proof.variants.map((variant) => optionalRecord(variant)?.observedSql));
  }
  if (Array.isArray(proof.statements)) {
    candidates.push(...proof.statements.map((statement) => optionalRecord(statement)?.observedSql));
  }
  return candidates
    .filter((candidate): candidate is JsonRecord => optionalRecord(candidate) !== null)
    .map((candidate) => candidate as SqlCapture)
    .filter((candidate) => typeof candidate.normalizedSql === "string");
}

function asRecord(value: unknown, label: string): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
  return value as JsonRecord;
}

function optionalRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function requiredString(value: unknown, label: string) {
  assert.ok(typeof value === "string" && value.trim(), label);
  return value;
}

function sourceBetween(value: string, start: string, end: string) {
  const from = value.indexOf(start);
  const to = value.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return value.slice(from, to);
}
