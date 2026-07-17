import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { jsonError } from "../src/lib/api-errors";
import { SECURE_FAILURE_MASTER_EVIDENCE } from "./secure-failure-evidence";

async function main() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  let internalRequestId = "";
  console.error = (line: string) => errors.push(line);
  console.warn = (line: string) => warnings.push(line);

  try {
    const denied = await jsonError(new Error("auth.forbidden"));
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), {
      error: { code: "auth.forbidden", message: "auth.forbidden" },
    });

    const secret = "password=must-not-escape";
    const internal = await jsonError(
      new Error(`database at private.internal failed ${secret}`),
      "Could not complete request",
    );
    assert.equal(internal.status, 500);
    assert.deepEqual(await internal.json(), {
      error: {
        code: "internal.error",
        message: "Could not complete request",
      },
    });
    assert.equal(internal.headers.get("cache-control"), "no-store");
    internalRequestId = internal.headers.get("x-request-id") ?? "";
    assert.match(internalRequestId, /^[0-9a-f-]{36}$/i);
    assert.ok(!errors.join("\n").includes("must-not-escape"));
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }

  assert.equal(errors.length, 1);
  assert.equal(warnings.length, 1);
  const diagnostic = JSON.parse(errors[0]);
  assert.equal(diagnostic.event, "api.internal_error");
  assert.equal(diagnostic.status, 500);
  assert.equal(diagnostic.outcome, "denied");
  assert.equal(diagnostic.requestId, internalRequestId);

  const evidence = JSON.parse(
    readFileSync("output/database-audit/demo-fixture-idempotency.json", "utf8"),
  ) as RuntimeEvidence;
  assert.equal(evidence.schemaVersion, 16);
  assert.equal(evidence.auditKind, "synthetic-private-fixture-idempotency");
  assert.equal(evidence.safety.productionOrProviderSystemsContacted, false);
  assert.deepEqual(evidence.runtimeIdentity, {
    role: "greyhoundiq_runtime",
    sessionRole: "greyhoundiq_runtime",
    database: "greyhoundiq",
    schema: "public",
    canLogin: true,
    superuser: false,
    bypassRls: false,
  });
  const evidenceAgeMs = Date.now() - Date.parse(evidence.generatedAt);
  assert.ok(evidenceAgeMs >= 0 && evidenceAgeMs <= 24 * 60 * 60 * 1_000);
  for (const file of [
    "src/lib/conversation-service.ts",
    "src/lib/db-context.ts",
    "src/lib/signup-acceptance-worker-store.ts",
  ]) {
    assert.equal(
      sha256(readFileSync(file)),
      evidence.sourceBinding.files[file],
      `${file}: runtime proof source binding is stale`,
    );
  }
  const proofs = evidence.databaseOperationProofs as Array<{
    queryId: string;
    cases: Record<string, string>;
  }>;
  assert.equal(
    proof(proofs, "DB.PULSE.CONVERSATION.BLOCK.UPDATE").cases.rollback,
    "conversation-and-user-block-rolled-back",
  );
  assert.deepEqual(
    proof(proofs, "DB.PULSE.CONVERSATION.ACCESS.SELECT").cases,
    {
      participant: "returned-one",
      nonParticipant: "conversation.not_found",
      missing: "conversation.not_found",
    },
  );

  const worker = readFileSync("src/lib/signup-acceptance-worker.ts", "utf8");
  const workerStore = readFileSync(
    "src/lib/signup-acceptance-worker-store.ts",
    "utf8",
  );
  const workerTest = readFileSync(
    "src/lib/signup-acceptance-worker.test.ts",
    "utf8",
  );
  assert.match(
    worker,
    /userId: claim\.userId,[\s\S]*idempotencyKey: claim\.idempotencyKey,[\s\S]*correlationId: claim\.correlationId,[\s\S]*attempt: claim\.attempt/,
  );
  assert.match(
    workerStore,
    /outbox\."idempotencyKey",[\s\S]*outbox\."correlationId",[\s\S]*outbox\."retryCount" AS "attempt"/,
  );
  assert.match(
    workerTest,
    /assert\.equal\(retry\.retried, 1\)[\s\S]*signupAcceptanceRetryDelayMs\(1, "signup\.accepted:user_123"\)/,
  );

  const expectedIds = Object.keys(SECURE_FAILURE_MASTER_EVIDENCE);
  assert.equal(expectedIds.length, 8);
  for (const requirementId of expectedIds) {
    const requirement = MASTER_AUDIT_REQUIREMENTS.find(
      (candidate) => candidate.id === requirementId,
    );
    assert.ok(requirement, `${requirementId}: missing immutable requirement`);
    assert.deepEqual(
      SECURITY_MASTER_EVIDENCE[requirementId],
      SECURE_FAILURE_MASTER_EVIDENCE[requirementId],
    );
    assert.equal(isMasterRequirementComplete(requirement), true);
  }

  console.log("secure failure controls passed: eight controls verified");
}

function proof(
  proofs: Array<{ queryId: string; cases: Record<string, string> }>,
  queryId: string,
) {
  const result = proofs.find((candidate) => candidate.queryId === queryId);
  assert.ok(result, `${queryId}: missing runtime operation proof`);
  return result;
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

type RuntimeEvidence = {
  schemaVersion: number;
  auditKind: string;
  generatedAt: string;
  safety: { productionOrProviderSystemsContacted: boolean };
  runtimeIdentity: Record<string, unknown>;
  sourceBinding: { files: Record<string, string> };
  databaseOperationProofs: Array<{
    queryId: string;
    cases: Record<string, string>;
  }>;
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
