import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  collectDatabaseCompatibilityInventory,
  databaseCompatibilityInventoryDiff,
} from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  processUsageDeliveryBatch,
  type UsageDeliveryWorkerStore,
} from "../src/lib/billing/usage-delivery-worker";
import { checkLocalRateLimit } from "../src/lib/rate-limit";
import { TopazProvider } from "../src/lib/live/topaz";
import {
  assertUserExportCollections,
  assertUserExportDto,
  assertUserExportSize,
  USER_EXPORT_COLLECTION_LIMIT,
  USER_EXPORT_MAX_BYTES,
} from "../src/lib/user-export-policy";
import {
  auditCollectionQueryBounds,
  type CollectionQuerySource,
} from "./collection-query-bound-evidence";
import { DATABASE_OPERATIONS } from "./database-operations";
import {
  ENDPOINT_DATABASE_REQUIREMENT_IDS,
  ENDPOINT_RESOURCE_DATABASE_EVIDENCE_FILE,
  ENDPOINT_RESOURCE_DATABASE_EVIDENCE_SCOPE,
  ENDPOINT_RESOURCE_DATABASE_EXPECTED_GAIN,
  ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE,
  ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS,
  ENDPOINT_RESOURCE_DATABASE_TEST_FILE,
  ENDPOINT_RESOURCE_REQUIREMENT_IDS,
} from "./endpoint-resource-database-evidence";
import { RATE_LIMITS } from "./rate-limits";

const EXPECTED_RESOURCE_IDS = [
  "security.endpoint-test-resource-abuse.pagination-maximum",
  "security.endpoint-test-resource-abuse.large-search",
  "security.endpoint-test-resource-abuse.high-cost-filter-combination",
  "security.endpoint-test-resource-abuse.repeated-submissions",
  "security.endpoint-test-resource-abuse.per-user-rate-limits",
  "security.endpoint-test-resource-abuse.per-object-rate-limits",
  "security.endpoint-test-resource-abuse.messaging-quotas",
  "security.endpoint-test-resource-abuse.export-quotas",
  "security.endpoint-test-resource-abuse.ai-cost-limits",
  "security.endpoint-test-resource-abuse.queue-backpressure",
  "security.endpoint-test-resource-abuse.provider-timeout",
  "security.endpoint-test-resource-abuse.database-timeout",
  "security.resource-control.per-user-rate-limit",
  "security.resource-control.per-ip-rate-limit-where-appropriate",
  "security.resource-control.per-object-rate-limit-where-appropriate",
  "security.abuse-control.actor-based-limits",
  "security.abuse-control.object-based-limits",
  "security.abuse-control.not-global-ip-only",
] as const;

const EXPECTED_DATABASE_IDS = [
  "security.endpoint-test-database.tenant-predicate",
  "security.endpoint-test-database.ownership-predicate",
  "security.endpoint-test-database.row-level-security",
  "security.endpoint-test-database.database-role-privileges",
  "security.endpoint-test-database.constraint-enforcement",
  "security.endpoint-test-database.affected-row-checks",
  "security.endpoint-test-database.transaction-rollback",
  "security.endpoint-test-database.query-timeout",
  "security.endpoint-test-database.pagination-bound",
  "security.endpoint-test-database.sensitive-column-selection",
  "security.endpoint-test-database.deleted-record-filtering",
  "security.endpoint-test-database.index-use-for-critical-queries",
  "security.endpoint-test-database.migration-compatibility",
] as const;

type JsonRecord = Record<string, unknown>;

async function main() {
  assert.deepEqual(ENDPOINT_RESOURCE_REQUIREMENT_IDS, EXPECTED_RESOURCE_IDS);
  assert.deepEqual(ENDPOINT_DATABASE_REQUIREMENT_IDS, EXPECTED_DATABASE_IDS);
  assert.deepEqual(ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS, [
    ...EXPECTED_RESOURCE_IDS,
    ...EXPECTED_DATABASE_IDS,
  ]);
  assert.equal(ENDPOINT_RESOURCE_DATABASE_EXPECTED_GAIN, 31);
  assert.equal(new Set(ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS).size, 31);
  assert.deepEqual(
    Object.keys(ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE),
    ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS,
  );
  assert.match(ENDPOINT_RESOURCE_DATABASE_EVIDENCE_SCOPE, /provider-free/i);
  assert.match(ENDPOINT_RESOURCE_DATABASE_EVIDENCE_SCOPE, /disposable-loopback/i);
  assert.match(ENDPOINT_RESOURCE_DATABASE_EVIDENCE_SCOPE, /does not claim production/i);
  assert.doesNotMatch(
    readFileSync(ENDPOINT_RESOURCE_DATABASE_EVIDENCE_FILE, "utf8"),
    /(?:from\s+["']node:|require\(["']node:)/,
  );

  const immutableIds = new Set(
    SECURITY_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
  );
  const masterEvidenceSource = readFileSync(
    "src/components/master-audit-evidence.ts",
    "utf8",
  );
  assert.match(
    masterEvidenceSource,
    /import \{ ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE \} from "\.\.\/\.\.\/security\/endpoint-resource-database-evidence";/,
  );
  assert.match(
    masterEvidenceSource,
    /\.\.\.ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE,/,
  );
  for (const requirementId of ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS) {
    assert.equal(
      immutableIds.has(requirementId),
      true,
      `${requirementId}: missing immutable security requirement`,
    );
    const evidence = ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE[requirementId];
    assert.equal(evidence.status, "verified");
    assert.equal(evidence.evidence[0], ENDPOINT_RESOURCE_DATABASE_EVIDENCE_FILE);
    assert.equal(evidence.evidence[1], ENDPOINT_RESOURCE_DATABASE_TEST_FILE);
    assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
    for (const evidencePath of evidence.evidence) {
      assert.equal(
        existsSync(evidencePath),
        true,
        `${requirementId}: missing ${evidencePath}`,
      );
    }
  }

  await assertResourceControls();
  assertDatabaseControls();

  console.log(
    "Endpoint resource/database evidence passed: 25 exact source, unit, and disposable-loopback negative controls (12 resource + 13 database)",
  );
}

async function assertResourceControls() {
  const collectionAudit = auditCollectionQueryBounds(
    collectProductionSources("src"),
  );
  assert.deepEqual(collectionAudit.issues, []);
  assert.ok(collectionAudit.records.length >= 200);
  const unsafeCollection = auditCollectionQueryBounds([
    {
      path: "synthetic/unbounded.ts",
      source: "prisma.user.findMany({ take: requestLimit });",
    },
  ]);
  assert.ok(
    unsafeCollection.issues.some((issue) =>
      issue.includes("COLLECTION_TAKE_NOT_ENFORCED"),
    ),
  );

  const querySource = readFileSync("src/lib/queries.ts", "utf8");
  for (const marker of [
    ".slice(0, 80)",
    "const RACE_SEARCH_RESULT_LIMIT = 120",
    "const RACE_SEARCH_DOG_MATCH_LIMIT = 80",
    "const RACE_SEARCH_RUNNER_RESULT_LIMIT = 48",
    "withDbAnonymousQueryDeadline",
  ]) {
    assert.ok(querySource.includes(marker), `bounded search: ${marker}`);
  }

  const now = 1_750_000_000_000;
  const limiterKey = `endpoint-resource-evidence:${process.pid}`;
  assert.deepEqual(checkLocalRateLimit(limiterKey, 2, 1_000, now), {
    allowed: true,
    remaining: 1,
    resetAt: now + 1_000,
  });
  assert.equal(
    checkLocalRateLimit(limiterKey, 2, 1_000, now).allowed,
    true,
  );
  assert.deepEqual(checkLocalRateLimit(limiterKey, 2, 1_000, now), {
    allowed: false,
    remaining: 0,
    resetAt: now + 1_000,
  });
  assert.equal(
    checkLocalRateLimit(limiterKey, 2, 1_000, now + 1_001).allowed,
    true,
  );

  assert.ok(RATE_LIMITS.length >= 60);
  assert.ok(
    RATE_LIMITS.filter((entry) => entry.keyShape.includes("<db-user-id>"))
      .length >= 50,
  );
  assert.ok(
    RATE_LIMITS.some(
      (entry) =>
        entry.keyShape.includes("<db-user-id>") &&
        /<(?:conversation|message|post|comment|listing|media|room|thread|topic)-id>/.test(
          entry.keyShape,
        ),
    ),
  );
  assertRateLimit(
    "POST",
    "/api/messages",
    10,
    60_000,
    "closed",
  );
  assertRateLimit(
    "POST",
    "/api/conversations/[id]/messages",
    10,
    60_000,
    "closed",
  );
  assertRateLimit(
    "POST",
    "/api/users/me/export",
    3,
    60 * 60_000,
    "closed",
  );
  assertRateLimit(
    "POST",
    "/api/agents/[type]/run",
    10,
    60_000,
    "closed",
  );

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

  let storeCalled = false;
  const emptyStore: UsageDeliveryWorkerStore = {
    async claimBatch() {
      storeCalled = true;
      return { claims: [], expiredDeadLettered: 0 };
    },
    async complete() {
      return true;
    },
    async fail() {
      return "dead-letter";
    },
  };
  await assert.rejects(
    () =>
      processUsageDeliveryBatch({
        store: emptyStore,
        handler: async () => "sent",
        limit: 101,
      }),
    /billing\.usage_worker_limit_invalid/,
  );
  await assert.rejects(
    () =>
      processUsageDeliveryBatch({
        store: emptyStore,
        handler: async () => "sent",
        limit: 20,
        concurrency: 11,
      }),
    /billing\.usage_worker_concurrency_invalid/,
  );
  assert.equal(storeCalled, false, "invalid worker budgets must fail before claim");

  let providerReceivedDeadline = false;
  const provider = new TopazProvider(
    "synthetic-test-key",
    (async (_input, init) => {
      providerReceivedDeadline = init?.signal instanceof AbortSignal;
      throw new Error("synthetic provider unavailable");
    }) as typeof fetch,
  );
  await assert.rejects(() => provider.fetchResults(1), /topaz\.request_failed/);
  assert.equal(providerReceivedDeadline, true);
  const topazSource = readFileSync("src/lib/live/topaz.ts", "utf8");
  assert.match(topazSource, /const TOPAZ_REQUEST_TIMEOUT_MS = 15_000/);
  assert.match(topazSource, /controller\.abort\(new Error\("topaz\.request_timeout"\)\)/);
  assert.match(topazSource, /attempt < MAX_RETRIES/);
}

function assertDatabaseControls() {
  const compatibility = collectDatabaseCompatibilityInventory();
  assert.deepEqual(databaseCompatibilityInventoryDiff(compatibility), []);

  const rls = readJson("security/row-level-security-runtime-evidence.json");
  assert.equal(rls.verdict, "verified");
  const safety = record(rls.safety, "RLS safety");
  assert.match(String(safety.scope), /disposable-database/);
  assert.equal(safety.productionContacted, false);
  const sourceBinding = record(rls.sourceBinding, "RLS source binding");
  assert.equal(sourceBinding.prismaSchemaSha256, compatibility.schemaSha256);
  assert.equal(sourceBinding.migrationsSha256, compatibility.migrationsSha256);
  assert.equal(
    sourceBinding.dbContextSha256,
    sha256(readFileSync("src/lib/db-context.ts")),
  );

  const catalog = record(rls.catalog, "RLS catalog");
  assert.equal(catalog.applicationModelCount, compatibility.counts.models);
  assert.equal(catalog.rlsEnabledCount, compatibility.counts.models);
  assert.equal(catalog.forceRlsCount, compatibility.counts.models);
  const cases = record(rls.cases, "RLS cases");
  assert.deepEqual(record(cases.anonymous, "anonymous"), zeroTenantCounts());
  assert.deepEqual(record(cases.ownerA, "owner A"), {
    membershipA: 1,
    membershipB: 0,
    organizationA: 1,
    organizationB: 0,
    signupOutbox: 0,
  });
  assert.deepEqual(record(cases.ownerB, "owner B"), {
    membershipA: 0,
    membershipB: 1,
    organizationA: 0,
    organizationB: 1,
    signupOutbox: 0,
  });
  assert.deepEqual(rls.rollback, { ...zeroTenantCounts(), verified: true });

  const roleSeparation = record(rls.roleSeparation, "role separation");
  const negativeControls = record(
    roleSeparation.negativeControls,
    "role negative controls",
  );
  assert.ok(
    Object.values(negativeControls).every((value) => value === true),
    "all six runtime-role privilege probes must be denied",
  );

  assert.equal(DATABASE_OPERATIONS.length, 27);
  assert.ok(DATABASE_OPERATIONS.some((operation) => operation.ownershipPredicate));
  assert.ok(
    DATABASE_OPERATIONS.every(
      (operation) => operation.constraintsReliedOn.length > 0,
    ),
  );
  assert.ok(
    DATABASE_OPERATIONS.every((operation) => operation.indexesExpected.length > 0),
  );
  assert.ok(
    DATABASE_OPERATIONS.every(
      (operation) =>
        Number.isSafeInteger(operation.timeoutMilliseconds) &&
        (operation.timeoutMilliseconds as number) > 0,
    ),
  );
  assert.ok(
    DATABASE_OPERATIONS.every(
      (operation) =>
        Number.isSafeInteger(operation.maximumRowCount) &&
        (operation.maximumRowCount as number) >= 0,
    ),
  );

  const demo = readJson("output/database-audit/demo-fixture-idempotency.json");
  assert.equal(demo.verdict, "verified");
  const collisionProbes = array(demo.collisionRollbackProbes, "collision probes");
  assert.ok(collisionProbes.length >= 2);
  for (const probe of collisionProbes) {
    assert.equal(record(probe, "collision probe").status, "verified");
  }
  const operationProofs = array(
    demo.databaseOperationProofs,
    "database operation proofs",
  ).map((proof) => record(proof, "database operation proof"));
  assert.ok(operationProofs.length >= 15);
  assert.ok(
    operationProofs.every(
      (proof) =>
        typeof proof.rowCountDelta === "number" &&
        proof.status === "verified",
    ),
  );
  const mediaDeleteProof = operationProofs.find(
    (proof) => proof.queryId === "DB.MEDIA.ASSET.DELETE.TOMBSTONE",
  );
  assert.ok(mediaDeleteProof);
  assert.deepEqual(record(mediaDeleteProof.cases, "media delete cases"), {
    owner: "tombstoned-one-and-audited-once",
    otherOwner: "media.not_found",
    missing: "media.not_found",
    rlsReplay: "exact-update-returned-zero",
    rollback: "tombstone-and-audit-unchanged",
    duplicate: "one-tombstone-one-audit-retained",
    feedPostResidual: "fixture-unlinked-not-proven",
    realtimeResidual: "disabled-no-event-path-proven",
    storageResidual: "loopback-best-effort-error-path-only",
  });

  const deletion = readJson("output/database-audit/account-deletion-finalize.json");
  const deletionProof = record(deletion.proof, "deletion proof");
  assert.deepEqual(record(deletionProof.rollback, "deletion rollback"), {
    forcedUniqueEmailConflict: true,
    authoredMessageUnchanged: true,
    profileUnchanged: true,
    userStillPending: true,
    deletionJobsCreated: 0,
    finalizationAuditsCreated: 0,
  });

  assert.throws(
    () => assertUserExportDto({ stripeCustomerId: "synthetic-customer" }),
    /export\.forbidden_field/,
  );
  const deletedFiltering = DATABASE_OPERATIONS.filter((operation) =>
    /deleted|tombstone|archiv/i.test(
      `${operation.visibilityPredicate ?? ""} ${operation.notFoundBehaviour} ${operation.columnsWritten.join(" ")}`,
    ),
  );
  assert.ok(deletedFiltering.length >= 4);

  const indexNames = new Set<string>();
  for (const path of [
    "output/database-audit/account-deletion-finalize.json",
    "output/database-audit/user-export-read.json",
    "output/database-audit/realtime-grant-revoke.json",
  ]) {
    collectIndexNames(readJson(path), indexNames);
  }
  for (const indexName of [
    "MediaAsset_uploaderId_sha256_idx",
    "giq_realtime_topic_grants_pkey",
  ]) {
    assert.equal(indexNames.has(indexName), true, `${indexName}: plan evidence missing`);
  }
  const accountDeletionOperation = DATABASE_OPERATIONS.find(
    (operation) =>
      operation.queryId === "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
  );
  assert.ok(accountDeletionOperation);
  assert.match(
    accountDeletionOperation.explainPlanEvidence ?? "",
    /Small disposable fixtures may select sequential scans; representative-volume index selection remains a load-test residual\./,
  );

  const migrationReplay = readJson("output/database-audit/migration-replay.json");
  assert.equal(migrationReplay.verdict, "verified");
  const migrationSafety = record(migrationReplay.safety, "migration safety");
  assert.match(String(migrationSafety.scope), /loopback-local-only/);
  const migrationBinding = record(
    migrationReplay.sourceBinding,
    "migration source binding",
  );
  assert.equal(migrationBinding.prismaSchemaSha256, compatibility.schemaSha256);
  assert.equal(migrationBinding.migrationsSha256, compatibility.migrationsSha256);
  assert.equal(migrationBinding.migrationCount, compatibility.counts.migrations);
  assert.deepEqual(record(migrationReplay.replay, "migration replay"), {
    status: "verified",
    exitCode: 0,
    outputSha256: "28e77f97ae58244e924dd9acfdc03fe391975a4d93358d3295aa65ca59eeb1b2",
    summary: [
      "No difference detected.",
      "Loaded Prisma config from prisma.config.ts.",
    ],
  });

  const dbContextSource = readFileSync("src/lib/db-context.ts", "utf8");
  assert.match(dbContextSource, /set_config\('statement_timeout'/);
  assert.match(dbContextSource, /database\.invalid_query_deadline/);
}

function assertRateLimit(
  method: string,
  route: string,
  maximum: number,
  windowMilliseconds: number,
  failMode: string,
) {
  const entry = RATE_LIMITS.find(
    (candidate) => candidate.method === method && candidate.route === route,
  );
  assert.ok(entry, `${method} ${route}: rate limit missing`);
  assert.equal(entry.maximum, maximum);
  assert.equal(entry.windowMilliseconds, windowMilliseconds);
  assert.equal(entry.failMode, failMode);
}

function collectProductionSources(directory: string): CollectionQuerySource[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
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
    return [
      {
        path: relative(process.cwd(), fullPath).replaceAll("\\", "/"),
        source: readFileSync(fullPath, "utf8"),
      },
    ];
  });
}

function collectIndexNames(value: unknown, target: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIndexNames(item, target));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "indexName" && typeof child === "string" && child) {
      target.add(child);
    }
    collectIndexNames(child, target);
  }
}

function zeroTenantCounts() {
  return {
    membershipA: 0,
    membershipB: 0,
    organizationA: 0,
    organizationB: 0,
    signupOutbox: 0,
  };
}

function readJson(path: string) {
  return record(JSON.parse(readFileSync(path, "utf8")), path);
}

function record(value: unknown, label: string): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), label);
  return value;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
