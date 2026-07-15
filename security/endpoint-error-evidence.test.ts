import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { jsonError } from "../src/lib/api-errors";
import {
  AUTH_CALLBACK_RECOVERY_COPY,
  classifyAuthCallbackFailure,
  parseAuthCallbackFailureReason,
  parseAuthCallbackReference,
} from "../src/lib/auth-callback-recovery";
import { safeQuery } from "../src/lib/db";
import { TopazProvider } from "../src/lib/live/topaz";
import { downloadStorageObjectHead } from "../src/lib/supabase-storage";
import {
  ENDPOINT_ERROR_EVIDENCE_FILE,
  ENDPOINT_ERROR_EVIDENCE_SCOPE,
  ENDPOINT_ERROR_EXPECTED_GAIN,
  ENDPOINT_ERROR_MASTER_EVIDENCE,
  ENDPOINT_ERROR_REQUIREMENT_IDS,
  ENDPOINT_ERROR_TEST_FILE,
} from "./endpoint-error-evidence";

const EXPECTED_REQUIREMENT_IDS = [
  "security.endpoint-test-error.database-unavailable",
  "security.endpoint-test-error.storage-unavailable",
  "security.endpoint-test-error.authentication-provider-unavailable",
  "security.endpoint-test-error.racing-provider-unavailable",
  "security.endpoint-test-error.internal-exception",
  "security.endpoint-test-error.logging-failure",
] as const;

async function main() {
  assert.deepEqual(ENDPOINT_ERROR_REQUIREMENT_IDS, EXPECTED_REQUIREMENT_IDS);
  assert.deepEqual(
    Object.keys(ENDPOINT_ERROR_MASTER_EVIDENCE),
    EXPECTED_REQUIREMENT_IDS,
  );
  assert.equal(ENDPOINT_ERROR_EXPECTED_GAIN, 6);
  assert.equal(new Set(EXPECTED_REQUIREMENT_IDS).size, 6);
  assert.match(ENDPOINT_ERROR_EVIDENCE_SCOPE, /provider-free fault injection/);
  assert.match(ENDPOINT_ERROR_EVIDENCE_SCOPE, /does not claim cache, queue/);
  assert.doesNotMatch(
    readFileSync(ENDPOINT_ERROR_EVIDENCE_FILE, "utf8"),
    /(?:from\s+["']node:|require\(["']node:)/,
  );

  const immutableIds = new Set(
    SECURITY_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
  );
  for (const requirementId of EXPECTED_REQUIREMENT_IDS) {
    assert.equal(
      immutableIds.has(requirementId),
      true,
      `${requirementId}: missing immutable requirement`,
    );
    const evidence = ENDPOINT_ERROR_MASTER_EVIDENCE[requirementId];
    assert.equal(evidence.status, "verified");
    assert.equal(evidence.evidence[0], ENDPOINT_ERROR_EVIDENCE_FILE);
    assert.equal(evidence.evidence[1], ENDPOINT_ERROR_TEST_FILE);
    assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
    for (const evidencePath of evidence.evidence) {
      assert.equal(
        existsSync(evidencePath),
        true,
        `${requirementId}: ${evidencePath}`,
      );
    }
  }

  const diagnostics: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalFetch = globalThis.fetch;
  let unexpectedNetworkCalls = 0;
  console.error = (line: string) => diagnostics.push(line);
  console.warn = (line: string) => diagnostics.push(line);
  globalThis.fetch = (async () => {
    unexpectedNetworkCalls += 1;
    throw new Error("test.unexpected_network_call");
  }) as typeof fetch;

  try {
    await assertDatabaseUnavailable();
    await assertStorageUnavailable();
    await assertAuthenticationProviderUnavailable();
    await assertRacingProviderUnavailable();
    await assertInternalException();
    await assertLoggingFailureIsContained();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
  }

  assert.equal(
    unexpectedNetworkCalls,
    0,
    "fault evidence must not contact production or a provider",
  );
  assert.doesNotMatch(
    diagnostics.join("\n"),
    /database-password|internal-secret|private@example\.test/,
  );

  console.log(
    "Endpoint error evidence passed: six provider-free production fault classes handled safely",
  );
}

async function assertDatabaseUnavailable() {
  const previousNodeEnv = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  const databaseFailure = Object.assign(
    new Error(
      "Can't reach database server at private.internal password=database-password",
    ),
    { code: "P1001" },
  );
  let caught: unknown;
  try {
    await safeQuery(
      async () => {
        throw databaseFailure;
      },
      [{ unsafe: "fallback-must-not-render" }],
    );
  } catch (error) {
    caught = error;
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
  }
  assert.equal(caught, databaseFailure);

  const response = await jsonError(caught, "Data is temporarily unavailable");
  await assertJsonFailure(response, 500, "internal.error", "Data is temporarily unavailable");
}

async function assertStorageUnavailable() {
  const keys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => delete process.env[key]);

  let caught: unknown;
  try {
    await downloadStorageObjectHead(
      "private-user-media",
      "synthetic/error-evidence.bin",
      32,
    );
  } catch (error) {
    caught = error;
  } finally {
    keys.forEach((key) => restoreEnv(key, previous[key]));
  }
  assert.match(String(caught), /media\.storage_unavailable/);

  const response = await jsonError(caught, "Storage is temporarily unavailable");
  await assertJsonFailure(
    response,
    503,
    "media.storage_unavailable",
    "Storage is temporarily unavailable",
  );
}

async function assertAuthenticationProviderUnavailable() {
  assert.equal(
    classifyAuthCallbackFailure("temporarily_unavailable"),
    "provider",
  );
  assert.equal(
    parseAuthCallbackFailureReason("raw WorkOS failure private@example.test"),
    "failed",
  );

  const reference = parseAuthCallbackReference(
    "2e831fa8-988f-4ed8-a83a-165e2ecd258d",
  );
  assert.equal(reference, "2e831fa8-988f-4ed8-a83a-165e2ecd258d");
  const copy = AUTH_CALLBACK_RECOVERY_COPY.provider;
  assert.match(copy.title, /Sign-in is temporarily unavailable/);
  assert.doesNotMatch(
    JSON.stringify(copy),
    /WorkOS|private@example\.test|error_description/,
  );

  const recoveryPage = readFileSync("src/app/auth/error/page.tsx", "utf8");
  assert.match(recoveryPage, /AUTH_CALLBACK_RECOVERY_COPY\[reason\]/);
  assert.match(recoveryPage, /parseAuthCallbackReference\(params\.ref\)/);
  assert.match(recoveryPage, /Try sign-in again/);
  assert.match(recoveryPage, /Support reference:/);
  assert.doesNotMatch(recoveryPage, /WorkOS|error_description/);

  const callbackRoute = readFileSync("src/app/callback/route.ts", "utf8");
  assert.match(callbackRoute, /onError:/);
  assert.match(callbackRoute, /classifyAuthCallbackFailure/);
  assert.match(callbackRoute, /new URL\("\/auth\/error", baseUrl\)/);
}

async function assertRacingProviderUnavailable() {
  let calls = 0;
  const provider = new TopazProvider(
    "synthetic-test-key",
    (async () => {
      calls += 1;
      return new Response(null, {
        status: 503,
        headers: { "retry-after": "0" },
      });
    }) as typeof fetch,
  );

  let caught: unknown;
  try {
    await provider.fetchResults(1);
  } catch (error) {
    caught = error;
  }
  assert.equal(calls, 6, "provider retries must remain bounded");
  assert.match(String(caught), /topaz\.request_failed:503/);

  const response = await jsonError(
    caught,
    "Racing data is temporarily unavailable",
  );
  await assertJsonFailure(
    response,
    500,
    "internal.error",
    "Racing data is temporarily unavailable",
  );
}

async function assertInternalException() {
  const response = await jsonError(
    new Error(
      "unexpected failure password=internal-secret user=private@example.test",
    ),
    "Could not complete request",
  );
  await assertJsonFailure(
    response,
    500,
    "internal.error",
    "Could not complete request",
  );
}

async function assertLoggingFailureIsContained() {
  const capturedStderr: string[] = [];
  const originalError = console.error;
  const originalStderrWrite = process.stderr.write;
  console.error = () => {
    throw new Error("synthetic.console_sink_unavailable");
  };
  process.stderr.write = ((chunk: string | Uint8Array) => {
    capturedStderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

  let response: Response;
  try {
    response = await jsonError(
      new Error("logger path password=internal-secret private@example.test"),
      "Could not complete request",
    );
  } finally {
    console.error = originalError;
    process.stderr.write = originalStderrWrite;
  }
  await assertJsonFailure(
    response,
    500,
    "internal.error",
    "Could not complete request",
  );
  assert.equal(capturedStderr.length, 1);
  assert.doesNotMatch(
    capturedStderr[0],
    /internal-secret|private@example\.test/,
  );

  console.error = () => {
    throw new Error("synthetic.console_sink_unavailable");
  };
  process.stderr.write = (() => {
    throw new Error("synthetic.stderr_sink_unavailable");
  }) as typeof process.stderr.write;
  try {
    response = await jsonError(
      new Error("both diagnostic sinks unavailable"),
      "Could not complete request",
    );
  } finally {
    console.error = originalError;
    process.stderr.write = originalStderrWrite;
  }
  await assertJsonFailure(
    response,
    500,
    "internal.error",
    "Could not complete request",
  );
}

async function assertJsonFailure(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(
    response.headers.get("x-request-id") ?? "",
    /^[0-9a-f-]{36}$/i,
  );
  assert.deepEqual(await response.json(), { error: { code, message } });
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
