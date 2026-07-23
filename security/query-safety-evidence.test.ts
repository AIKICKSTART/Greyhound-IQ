import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { auditProductionSqlSafety, inspectProductionSqlSource } from "../scripts/check-production-sql-safety";
import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import { jsonError } from "../src/lib/api-errors";
import { runtimeDatabaseUrl } from "../src/lib/database-url";
import {
  assertUserExportCollections,
  assertUserExportSize,
  USER_EXPORT_COLLECTION_LIMIT,
  USER_EXPORT_MAX_BYTES,
  USER_EXPORT_NESTED_COLLECTION_LIMIT,
} from "../src/lib/user-export-policy";
import { ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS } from "./actual-query-capture-evidence";
import {
  MAX_COLLECTION_QUERY_ROWS,
  auditCollectionQueryBounds,
  type CollectionQuerySource,
} from "./collection-query-bound-evidence";
import { DATABASE_OPERATIONS } from "./database-operations";
import {
  auditOrmInjectionSources,
  type OrmInjectionSource,
} from "./orm-injection-control-evidence";
import {
  QUERY_SAFETY_MASTER_EVIDENCE,
  QUERY_SAFETY_RESIDUAL_GAPS,
  VERIFIED_QUERY_SAFETY_REQUIREMENT_IDS,
} from "./query-safety-evidence";
import { ROW_LEVEL_SECURITY_BOUNDARY } from "./row-level-security-evidence";

type JsonRecord = Record<string, unknown>;

async function main() {
  const requirementIds = MASTER_AUDIT_REQUIREMENTS.filter(
    (requirement) =>
      requirement.prompt === "security" &&
      requirement.id.startsWith("security.query-safety."),
  ).map((requirement) => requirement.id);
  const classifiedIds = [
    "security.query-safety.parameterized-values",
    ...VERIFIED_QUERY_SAFETY_REQUIREMENT_IDS,
    ...Object.keys(QUERY_SAFETY_RESIDUAL_GAPS),
  ];
  assert.equal(requirementIds.length, 17);
  assert.deepEqual(classifiedIds.toSorted(), requirementIds.toSorted());
  assert.equal(new Set(classifiedIds).size, requirementIds.length);

  for (const requirementId of VERIFIED_QUERY_SAFETY_REQUIREMENT_IDS) {
    const evidence = QUERY_SAFETY_MASTER_EVIDENCE[requirementId];
    assert.equal(evidence.status, "verified");
    for (const path of evidence.evidence) {
      assert.ok(existsSync(path), `${requirementId}: missing ${path}`);
    }
  }

  const productionSources = collectProductionSources("src");
  const sqlAudit = auditProductionSqlSafety();
  assert.deepEqual(sqlAudit.violations, []);
  assert.ok(sqlAudit.safeRawOperationCount > 0);
  assert.deepEqual(auditOrmInjectionSources(productionSources), []);

  const collectionAudit = auditCollectionQueryBounds(productionSources);
  assert.deepEqual(collectionAudit.issues, []);
  assert.ok(collectionAudit.records.length > 0);
  assert.ok(
    collectionAudit.records.every(
      (record) =>
        record.maximumRows >= 1 &&
        record.maximumRows <= MAX_COLLECTION_QUERY_ROWS,
    ),
  );

  assert.ok(
    inspectProductionSqlSource(
      "src/lib/unsafe.ts",
      'prisma.$queryRawUnsafe("SELECT " + input)',
    ).violations.length > 0,
  );
  assert.ok(
    auditOrmInjectionSources([
      {
        path: "src/lib/dynamic-key.ts",
        source:
          "prisma.user.findMany({ where: { [input.field]: input.value } });",
      },
    ]).some((issue) => issue.startsWith("ORM_DYNAMIC_KEY:")),
  );
  assert.ok(
    auditCollectionQueryBounds([
      {
        path: "src/lib/unbounded.ts",
        source: "prisma.user.findMany({ take: requestLimit });",
      },
    ]).issues.some((issue) => issue.includes("COLLECTION_TAKE_NOT_ENFORCED")),
  );

  assert.equal(USER_EXPORT_COLLECTION_LIMIT, 500);
  assert.equal(USER_EXPORT_NESTED_COLLECTION_LIMIT, 20);
  assert.throws(
    () =>
      assertUserExportCollections({
        rows: Array.from({ length: USER_EXPORT_COLLECTION_LIMIT + 1 }),
      }),
    /export\.too_large/,
  );
  assert.throws(
    () => assertUserExportSize("x".repeat(USER_EXPORT_MAX_BYTES + 1)),
    /export\.too_large/,
  );
  const exportOperation = DATABASE_OPERATIONS.find(
    (operation) => operation.queryId === "DB.ACCOUNT.DATA_EXPORT.READ",
  );
  assert.ok(exportOperation);
  assert.equal(exportOperation.parameterized, true);
  assert.ok(exportOperation.maximumRowCount && exportOperation.maximumRowCount > 0);
  assert.match(exportOperation.ownershipPredicate ?? "", /current/i);

  const exportArtifact = readJson("output/database-audit/user-export-read.json");
  const exportProof = asRecord(exportArtifact.proof, "export proof");
  assert.equal(exportProof.collectionTake, USER_EXPORT_COLLECTION_LIMIT + 1);
  assert.equal(
    exportProof.nestedCollectionTake,
    USER_EXPORT_NESTED_COLLECTION_LIMIT + 1,
  );
  assert.deepEqual(exportProof.overflow, {
    topLevelSentinelRows: 501,
    nestedSentinelRows: 21,
    result: "both-rejected-before-export-completion",
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (line: string) => errors.push(line);
  console.warn = (line: string) => warnings.push(line);
  let redactedResponse: Response;
  try {
    redactedResponse = await jsonError(
      new Error(
        "Prisma P2024 database=private-db password=synthetic-secret user=private@example.test",
      ),
      "Could not complete request",
    );
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  assert.equal(redactedResponse.status, 500);
  assert.deepEqual(await redactedResponse.json(), {
    error: { code: "internal.error", message: "Could not complete request" },
  });
  assert.doesNotMatch(JSON.stringify(awaitBody(errors, warnings)), /synthetic-secret|private@example/);

  let planCount = 0;
  let firstPlan: JsonRecord | undefined;
  for (const artifactPath of ACTUAL_QUERY_CAPTURE_ARTIFACT_PATHS) {
    const artifact = readJson(artifactPath);
    validateNoProductionImpact(artifact, artifactPath);
    for (const proof of getProofs(artifact)) {
      for (const plan of getPlans(proof)) {
        validateSafePlan(plan, proof.queryId);
        firstPlan ??= plan;
        planCount += 1;
      }
    }
  }
  assert.ok(planCount >= DATABASE_OPERATIONS.length);
  assert.ok(firstPlan);
  assert.throws(
    () => validateSafePlan({ ...firstPlan, analyze: true }, "forged"),
    /must not execute/,
  );

  assert.match(
    ROW_LEVEL_SECURITY_BOUNDARY.applicationAuthorizationGap,
    /remains partially verified/,
  );
  assert.deepEqual(
    DATABASE_OPERATIONS.filter(
      (operation) => operation.timeoutMilliseconds == null,
    ).map((operation) => operation.queryId),
    [],
  );
  assert.match(
    QUERY_SAFETY_RESIDUAL_GAPS["security.query-safety.timeouts"],
    /deployed enforcement has not been independently verified/i,
  );
  assert.equal(
    new URL(
      runtimeDatabaseUrl(
        "postgresql://runtime@127.0.0.1/greyhoundiq?connection_limit=999",
      ),
    ).searchParams.get("connection_limit"),
    "999",
    "supplied pool limits are not capped, so bounded-pools must remain open",
  );

  console.log(
    `Query-safety evidence passed: ${VERIFIED_QUERY_SAFETY_REQUIREMENT_IDS.length} controls, ${collectionAudit.records.length} bounded production collections and ${planCount} non-executing local plans; 10 residuals remain open.`,
  );
}

function collectProductionSources(
  directory: string,
): Array<CollectionQuerySource & OrmInjectionSource> {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under production source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectProductionSources(fullPath);
      if (
        !/\.(?:c|m)?(?:j|t)sx?$/.test(entry.name) ||
        /\.(?:test|spec)\.(?:c|m)?(?:j|t)sx?$/.test(entry.name)
      ) {
        return [];
      }
      return [{
        path: relative(process.cwd(), fullPath).replaceAll("\\", "/"),
        source: readFileSync(fullPath, "utf8"),
      }];
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

function validateNoProductionImpact(document: JsonRecord, artifactPath: string) {
  assert.equal(document.verdict, "verified", `${artifactPath}: verdict`);
  const safety = asRecord(document.safety, `${artifactPath}: safety`);
  assert.match(String(safety.scope), /loopback/);
  assert.ok(
    safety.productionOrProviderSystemsContacted === false ||
      safety.providerContact === false,
    `${artifactPath}: production/provider contact`,
  );
}

function validateSafePlan(plan: JsonRecord, queryId: unknown) {
  assert.equal(plan.analyze, false, `${String(queryId)}: plan must not execute`);
  assert.equal(plan.buffers, false, `${String(queryId)}: buffers`);
  assert.ok(
    Number.isInteger(plan.statementTimeoutMilliseconds) &&
      (plan.statementTimeoutMilliseconds as number) <= 5_000,
    `${String(queryId)}: plan timeout`,
  );
}

function getProofs(document: JsonRecord) {
  const proofs: JsonRecord[] = [];
  const proof = optionalRecord(document.proof);
  if (proof?.queryId) proofs.push(proof);
  if (Array.isArray(document.databaseOperationProofs)) {
    proofs.push(...document.databaseOperationProofs.map((entry) => asRecord(entry, "proof")));
  }
  return proofs;
}

function getPlans(proof: JsonRecord) {
  const candidates: unknown[] = [
    proof.explain,
    optionalRecord(proof.statement)?.explain,
    proof.deletePlan,
  ];
  if (Array.isArray(proof.variants)) {
    candidates.push(...proof.variants.map((entry) => optionalRecord(entry)?.explain));
  }
  if (Array.isArray(proof.statements)) {
    candidates.push(...proof.statements.map((entry) => optionalRecord(entry)?.explain));
  }
  return candidates.flatMap((candidate) => {
    const record = optionalRecord(candidate);
    return record ? [record] : [];
  });
}

function readJson(path: string) {
  return asRecord(JSON.parse(readFileSync(path, "utf8")), path);
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

function awaitBody(errors: string[], warnings: string[]) {
  return { errors, warnings };
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
