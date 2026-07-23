import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  DEMO_FIXTURE_IDEMPOTENCY_EVIDENCE_PATH,
} from "./check-demo-route-fixture-idempotency";
import {
  DEMO_FIXTURE_EVIDENCE_MAX_AGE_MS,
  validateDemoFixtureEvidence,
} from "./demo-route-fixture-evidence";
import { DATABASE_OPERATIONS } from "../security/database-operations";
import { isDesignLabDatabaseOperationComplete } from "../src/components/design-lab-database-contracts";

type JsonObject = Record<string, unknown>;

const root = process.cwd();
const now = new Date();
const evidence = JSON.parse(
  readFileSync(DEMO_FIXTURE_IDEMPOTENCY_EVIDENCE_PATH, "utf8"),
) as unknown;

assert.doesNotThrow(() => validateDemoFixtureEvidence(evidence, { root, now }));

const evidenceObject = evidence as JsonObject;
const operationProofs = evidenceObject.databaseOperationProofs;
assert.ok(Array.isArray(operationProofs));
for (const proofValue of operationProofs) {
  const proof = proofValue as JsonObject;
  const queryId = String(proof.queryId);
  const operation = DATABASE_OPERATIONS.find((entry) => entry.queryId === queryId);
  assert.ok(operation, `Database operation missing for ${queryId}`);
  assert.equal(isDesignLabDatabaseOperationComplete(operation), true, queryId);
  const runtimeIdentity = objectAt(proof, "runtimeIdentity");
  assert.equal(operation.databaseRole, runtimeIdentity.role);
  assert.equal(operation.databaseName, runtimeIdentity.database);
  assert.equal(operation.schemaName, runtimeIdentity.schema);
  const observedSql = objectAt(proof, "observedSql");
  assert.equal(operation.normalizedSql, observedSql.normalizedSql);
  const parameterCount = Number(observedSql.parameterCount);
  const boundParameterText = operation.boundParameters.join(" ");
  for (let position = 1; position <= parameterCount; position += 1) {
    assert.ok(
      boundParameterText.includes(`$${position}`),
      `${queryId} registry bind position $${position}`,
    );
  }
  const explain = objectAt(proof, "explain");
  assert.ok(
    operation.explainPlanEvidence?.includes(
      "output/database-audit/demo-fixture-idempotency.json",
    ),
  );
  assert.ok(
    operation.explainPlanEvidence?.includes(
      String(objectAt(explain, "plan").nodeType),
    ),
  );
  const proofVariants = proof.variants;
  assert.ok(Array.isArray(proofVariants));
  if (proofVariants.length > 0) {
    assert.equal(
      operation.normalizedSqlVariants?.length,
      proofVariants.length,
      `${queryId} registry SQL variants`,
    );
    proofVariants.forEach((variantValue, variantIndex) => {
      const proofVariant = variantValue as JsonObject;
      const registryVariant = operation.normalizedSqlVariants?.[variantIndex];
      assert.ok(registryVariant, `${queryId} registry variant ${variantIndex}`);
      assert.equal(registryVariant.variant, proofVariant.variant);
      const variantSql = objectAt(proofVariant, "observedSql");
      assert.equal(registryVariant.normalizedSql, variantSql.normalizedSql);
      const variantBindText = registryVariant.boundParameters.join(" ");
      for (
        let position = 1;
        position <= Number(variantSql.parameterCount);
        position += 1
      ) {
        assert.ok(
          variantBindText.includes(`$${position}`),
          `${queryId} ${registryVariant.variant} bind position $${position}`,
        );
      }
      const variantExplain = objectAt(proofVariant, "explain");
      assert.ok(
        registryVariant.explainPlanEvidence.includes(
          String(objectAt(variantExplain, "plan").nodeType),
        ),
      );
    });
  }
}

rejectsMutation("omitted bound source file", (candidate) => {
  const files = objectAt(objectAt(candidate, "sourceBinding"), "files");
  delete files[Object.keys(files)[0]];
}, /sourceBinding\.files keys/);

rejectsMutation("missing approved asset", (candidate) => {
  const assets = objectAt(objectAt(candidate, "sourceBinding"), "assets");
  delete assets[Object.keys(assets)[0]];
}, /sourceBinding\.assets keys/);

rejectsMutation("changed approved asset hash", (candidate) => {
  const assets = objectAt(objectAt(candidate, "sourceBinding"), "assets");
  const firstAsset = objectAt(assets, Object.keys(assets)[0]);
  firstAsset.sha256 = "0".repeat(64);
}, /source or asset binding is stale/);

rejectsMutation("empty collision probes", (candidate) => {
  candidate.collisionRollbackProbes = [];
}, /collisionRollbackProbes/);

rejectsMutation("forged runtime role identity", (candidate) => {
  objectAt(candidate, "runtimeIdentity").role = "postgres";
}, /runtimeIdentity values/);

rejectsMutation("missing database operation proof", (candidate) => {
  const proofs = candidate.databaseOperationProofs;
  assert.ok(Array.isArray(proofs));
  proofs.pop();
}, /databaseOperationProofs/);

rejectsMutation("forged database operation row delta", (candidate) => {
  const proofs = candidate.databaseOperationProofs;
  assert.ok(Array.isArray(proofs));
  const conversation = proofs.find(
    (proof) =>
      proof &&
      typeof proof === "object" &&
      (proof as JsonObject).queryId === "DB.PULSE.CONVERSATION.ACCESS.SELECT",
  );
  assert.ok(conversation && typeof conversation === "object");
  (conversation as JsonObject).rowCountDelta = 1;
}, /databaseOperationProofs/);

rejectsMutation("inlined database operation bind", (candidate) => {
  const observedSql = operationObservedSql(candidate, 0);
  const sql = `${String(observedSql.normalizedSql)} demo-inline-forbidden`;
  observedSql.normalizedSql = sql;
  observedSql.sha256 = sha256(sql);
}, /persisted fixture value/);

rejectsMutation("renamed database operation bind", (candidate) => {
  const observedSql = operationObservedSql(candidate, 0);
  const namedBinds = observedSql.namedBinds;
  assert.ok(Array.isArray(namedBinds));
  (namedBinds[0] as JsonObject).name = "renamed-bind";
}, /namedBinds values/);

rejectsMutation("changed database operation bind positions", (candidate) => {
  const observedSql = operationObservedSql(candidate, 0);
  const namedBinds = observedSql.namedBinds;
  assert.ok(Array.isArray(namedBinds));
  (namedBinds[0] as JsonObject).positions = [2];
}, /namedBinds values/);

rejectsMutation("persisted database operation values", (candidate) => {
  operationObservedSql(candidate, 1).persistedParameterValues = true;
}, /persistedParameterValues/);

rejectsMutation("forged conversation block statement type", (candidate) => {
  operationObservedSqlByQueryId(
    candidate,
    "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
  ).statementType = "SELECT";
}, /statementType/);

rejectsMutation("changed user block bind positions", (candidate) => {
  const namedBinds = operationObservedSqlByQueryId(
    candidate,
    "DB.PULSE.USER_BLOCK.UPSERT",
  ).namedBinds;
  assert.ok(Array.isArray(namedBinds));
  (namedBinds[0] as JsonObject).positions = [2];
}, /namedBinds values/);

rejectsMutation("erased block rollback outcome", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.PULSE.CONVERSATION.BLOCK.UPDATE"),
    "cases",
  ).rollback = "not-proven";
}, /reviewed outcome/);

rejectsMutation("erased duplicate no-mutation outcome", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.PULSE.USER_BLOCK.UPSERT"),
    "cases",
  ).duplicateSqlPath = "not-proven";
}, /reviewed outcome/);

rejectsMutation("forged signup claim statement type", (candidate) => {
  operationObservedSqlByQueryId(
    candidate,
    "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
  ).statementType = "UPDATE";
}, /statementType/);

rejectsMutation("changed signup claim lease-token bind", (candidate) => {
  const namedBinds = operationObservedSqlByQueryId(
    candidate,
    "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
  ).namedBinds;
  assert.ok(Array.isArray(namedBinds));
  (namedBinds[4] as JsonObject).positions = [6];
}, /namedBinds values/);

rejectsMutation("erased signup claim lock outcome", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.AUTH.SIGNUP_OUTBOX.CLAIM"),
    "cases",
  ).locked = "not-proven";
}, /reviewed outcome/);

rejectsMutation("removed signup settlement SQL variant", (candidate) => {
  const variants = operationProof(
    candidate,
    "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
  ).variants;
  assert.ok(Array.isArray(variants));
  variants.pop();
}, /variants length/);

rejectsMutation("renamed signup settlement SQL variant", (candidate) => {
  const variants = operationProof(
    candidate,
    "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
  ).variants;
  assert.ok(Array.isArray(variants));
  (variants[1] as JsonObject).variant = "complete";
}, /variant/);

rejectsMutation("forged signup retry SQL", (candidate) => {
  const variants = operationProof(
    candidate,
    "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
  ).variants;
  assert.ok(Array.isArray(variants));
  const observedSql = objectAt(variants[1] as JsonObject, "observedSql");
  observedSql.normalizedSql = `${String(observedSql.normalizedSql)} changed`;
}, /sha256 value/);

rejectsMutation("detached signup settlement primary SQL", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.AUTH.SIGNUP_OUTBOX.SETTLE"),
    "observedSql",
  ).sha256 = "0".repeat(64);
}, /sha256 value|primary observedSql/);

rejectsMutation("unsanitized explain plan", (candidate) => {
  operationExplain(candidate, 0).sanitized = false;
}, /sanitized/);

rejectsMutation("explain plan expression leak", (candidate) => {
  const plan = objectAt(operationExplain(candidate, 0), "plan");
  plan.filter = "id = a persisted value";
}, /plan keys/);

rejectsMutation("forged explain plan hash", (candidate) => {
  operationExplain(candidate, 1).planSha256 = "0".repeat(64);
}, /planSha256 value/);

rejectsMutation("forged conversation block plan hash", (candidate) => {
  operationExplainByQueryId(
    candidate,
    "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
  ).planSha256 = "0".repeat(64);
}, /planSha256 value/);

rejectsMutation("forged signup claim plan hash", (candidate) => {
  operationExplainByQueryId(
    candidate,
    "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
  ).planSha256 = "0".repeat(64);
}, /planSha256 value/);

rejectsMutation("forged signup dead-letter plan hash", (candidate) => {
  const variants = operationProof(
    candidate,
    "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
  ).variants;
  assert.ok(Array.isArray(variants));
  objectAt(variants[2] as JsonObject, "explain").planSha256 = "0".repeat(64);
}, /planSha256 value/);

rejectsMutation("forged operation runtime identity", (candidate) => {
  const proofs = candidate.databaseOperationProofs;
  assert.ok(Array.isArray(proofs));
  objectAt(proofs[0] as JsonObject, "runtimeIdentity").role = "postgres";
}, /runtimeIdentity values/);

rejectsMutation("forged cleanup delete count", (candidate) => {
  const deleted = objectAt(objectAt(candidate, "cleanup"), "deleted");
  deleted.User = 3;
}, /cleanup\.deleted values/);

rejectsMutation("forged conversation block audit cleanup", (candidate) => {
  const deleted = objectAt(objectAt(candidate, "cleanup"), "deleted");
  deleted.ConversationBlockAuditLog = 2;
}, /cleanup\.deleted values/);

rejectsMutation("forged signup outbox cleanup", (candidate) => {
  const deleted = objectAt(objectAt(candidate, "cleanup"), "deleted");
  deleted.SignupOutbox = 0;
}, /cleanup\.deleted values/);

rejectsMutation("forged dog ownership cleanup", (candidate) => {
  const deleted = objectAt(objectAt(candidate, "cleanup"), "deleted");
  deleted.DogOwnershipOperationProbe = 0;
}, /cleanup\.deleted values/);

rejectsMutation("forged Stripe webhook cleanup", (candidate) => {
  const deleted = objectAt(objectAt(candidate, "cleanup"), "deleted");
  deleted.StripeWebhookOperationProbe = 0;
}, /cleanup\.deleted values/);

rejectsMutation("forged user-export artifact cleanup", (candidate) => {
  const deleted = objectAt(objectAt(candidate, "cleanup"), "deleted");
  deleted.UserExportArtifact = 1;
}, /cleanup\.deleted values/);

rejectsMutation("erased user-export atomic rollback", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.ACCOUNT.DATA_EXPORT.AUDIT.INSERT"),
    "cases",
  ).atomicRollback = "not-proven";
}, /reviewed outcome/);

rejectsMutation("erased user-export owner mutation denial", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.ACCOUNT.DATA_EXPORT.ARTIFACT.INSERT"),
    "cases",
  ).ownerMutation = "not-proven";
}, /reviewed outcome/);

rejectsMutation("erased dog ownership anonymous RLS outcome", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.RACING.DOG.OPEN.OWNERSHIP.SELECT"),
    "cases",
  ).anonymousRlsReplay = "not-proven";
}, /reviewed outcome/);

rejectsMutation("erased Stripe webhook redaction outcome", (candidate) => {
  objectAt(
    operationProof(candidate, "DB.BILLING.STRIPE_WEBHOOK_EVENT.INSERT"),
    "cases",
  ).redaction = "not-proven";
}, /reviewed outcome/);

rejectsMutation("erased first-run model counts", (candidate) => {
  objectAt(candidate, "firstRun").modelCounts = {};
}, /firstRun\.modelCounts keys/);

rejectsMutation("forged matching fixture hashes", (candidate) => {
  objectAt(candidate, "firstRun").fixtureSha256 = "0".repeat(64);
  objectAt(candidate, "secondRun").fixtureSha256 = "0".repeat(64);
}, /reviewed deterministic graph/);

rejectsMutation("forged matching provider hashes", (candidate) => {
  objectAt(candidate, "providerBefore").rowsSha256 = "0".repeat(64);
  objectAt(candidate, "providerAfter").rowsSha256 = "0".repeat(64);
}, /reviewed deterministic rows/);

rejectsMutation("stale timestamp", (candidate) => {
  candidate.generatedAt = new Date(
    now.getTime() - DEMO_FIXTURE_EVIDENCE_MAX_AGE_MS - 1,
  ).toISOString();
}, /generatedAt is stale/);

rejectsMutation("extra top-level field", (candidate) => {
  candidate.unexpected = true;
}, /evidence keys/);

rejectsMutation("extra nested field", (candidate) => {
  objectAt(candidate, "safety").unexpected = true;
}, /evidence\.safety keys/);

rejectsMutation("non-loopback evidence host", (candidate) => {
  objectAt(candidate, "safety").host = "database.example.test";
}, /literal loopback address/);

rejectsMutation("password-bearing URL", (candidate) => {
  objectAt(candidate, "safety").cleanup =
    "postgresql://runtime:secret@127.0.0.1:55734/greyhoundiq";
}, /password-bearing URL/);

console.log("strict demo fixture evidence and mutation tests passed");

function rejectsMutation(
  label: string,
  mutate: (candidate: JsonObject) => void,
  expected: RegExp,
) {
  const candidate = structuredClone(evidence) as JsonObject;
  mutate(candidate);
  assert.throws(
    () => validateDemoFixtureEvidence(candidate, { root, now }),
    expected,
    label,
  );
}

function objectAt(value: JsonObject, key: string) {
  const child = value[key];
  assert.ok(
    child !== null && typeof child === "object" && !Array.isArray(child),
    `${key} must be an object`,
  );
  return child as JsonObject;
}

function operationObservedSql(candidate: JsonObject, index: number) {
  const proofs = candidate.databaseOperationProofs;
  assert.ok(Array.isArray(proofs));
  return objectAt(proofs[index] as JsonObject, "observedSql");
}

function operationExplain(candidate: JsonObject, index: number) {
  const proofs = candidate.databaseOperationProofs;
  assert.ok(Array.isArray(proofs));
  return objectAt(proofs[index] as JsonObject, "explain");
}

function operationProof(candidate: JsonObject, queryId: string) {
  const proofs = candidate.databaseOperationProofs;
  assert.ok(Array.isArray(proofs));
  const proof = proofs.find(
    (value) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as JsonObject).queryId === queryId,
  );
  assert.ok(proof && typeof proof === "object", `${queryId} proof`);
  return proof as JsonObject;
}

function operationObservedSqlByQueryId(candidate: JsonObject, queryId: string) {
  return objectAt(operationProof(candidate, queryId), "observedSql");
}

function operationExplainByQueryId(candidate: JsonObject, queryId: string) {
  return objectAt(operationProof(candidate, queryId), "explain");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
