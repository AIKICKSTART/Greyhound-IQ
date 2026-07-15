import assert from "node:assert/strict";
import {
  logBackgroundWarn,
  logCorrelatedInfo,
  logCorrelationContextFromHeaders,
  logError,
  logInfo,
  logRequestError,
  logWarn,
} from "./logger";

const captured: string[] = [];
const origError = console.error;
const origInfo = console.info;
const origWarn = console.warn;
console.error = (line: string) => captured.push(line);
console.info = (line: string) => captured.push(line);
console.warn = (line: string) => captured.push(line);

try {
  process.env.K_SERVICE = "greyhoundiq-web-test";
  process.env.K_REVISION = "revision-test";
  process.env.GOOGLE_CLOUD_REGION = "australia-southeast1";

  // logError → one-line JSON with severity ERROR and context fields spread
  logError("test.event", {
    userId: "u1",
    count: 2,
    requestId: "request-123",
    traceId: "105445aa7843bc8bf206b12000100000",
  });
  const errorLine = captured[captured.length - 1];
  assert.ok(!errorLine.includes("\n"), "JSON line must be single-line");
  const e = JSON.parse(errorLine);
  assert.equal(e.severity, "ERROR");
  assert.equal(e.event, "test.event");
  assert.equal(e.userId, "u1");
  assert.equal(e.count, 2);
  assert.equal(e.service, "greyhoundiq-web-test");
  assert.equal(e.region, "australia-southeast1");
  assert.equal(e.revision, "revision-test");
  assert.equal(e.requestId, "request-123");
  assert.equal(e.traceId, "105445aa7843bc8bf206b12000100000");
  assert.match(e.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(e.actorId, "u1");
  assert.equal(e.tenantId, null);
  assert.equal(e.durationMs, null);

  // logWarn → severity WARNING
  logWarn("test.warn", { flag: true });
  const warnObj = JSON.parse(captured[captured.length - 1]);
  assert.equal(warnObj.severity, "WARNING");
  assert.equal(warnObj.event, "test.warn");
  assert.equal(warnObj.flag, true);
  assert.equal(warnObj.requestId, null);
  assert.equal(warnObj.traceId, null);

  logInfo("test.info", { phase: "sync" });
  const infoObj = JSON.parse(captured[captured.length - 1]);
  assert.equal(infoObj.severity, "INFO");
  assert.equal(infoObj.event, "test.info");
  assert.equal(infoObj.phase, "sync");

  logInfo("test.security_fields", {
    actorId: "actor-1\nunsafe",
    organizationId: "tenant-1",
    targetType: "listing",
    targetId: "listing-1\nunsafe",
    outcome: "denied",
    errorCode: "authorization.denied",
    durationMs: 12.5,
    securityMetadata: {
      policy: "listing.owner",
      authorization: "Bearer hidden",
    },
  });
  const securityFields = JSON.parse(captured[captured.length - 1]);
  assert.equal(securityFields.actorId, "actor-1_unsafe");
  assert.equal(securityFields.tenantId, "tenant-1");
  assert.equal(securityFields.targetType, "listing");
  assert.equal(securityFields.targetId, "listing-1_unsafe");
  assert.equal(securityFields.outcome, "denied");
  assert.equal(securityFields.errorClass, "authorization.denied");
  assert.equal(securityFields.durationMs, 12.5);
  assert.deepEqual(securityFields.securityMetadata, {
    policy: "listing.owner",
    authorization: "[REDACTED]",
  });

  const cloudTraceId = "105445aa7843bc8bf206b12000100001";
  logInfo("test.request_not_trace", { requestId: cloudTraceId });
  const tracedInfo = JSON.parse(captured[captured.length - 1]);
  assert.equal(tracedInfo.requestId, cloudTraceId);
  assert.equal(
    tracedInfo.traceId,
    null,
    "a 32-hex request id must not fabricate Cloud Trace association",
  );

  const headerContext = logCorrelationContextFromHeaders(
    new Headers({
      "x-cloud-trace-context": `${cloudTraceId.toUpperCase()}/123;o=1`,
      "x-request-id": "caller-request-id",
    }),
  );
  assert.deepEqual(headerContext, {
    requestId: "caller-request-id",
    traceId: cloudTraceId,
  });
  logCorrelatedInfo(headerContext, "test.correlated", { safe: true });
  const correlatedInfo = JSON.parse(captured[captured.length - 1]);
  assert.equal(correlatedInfo.requestId, "caller-request-id");
  assert.equal(correlatedInfo.traceId, cloudTraceId);

  const requestOnlyContext = logCorrelationContextFromHeaders(
    new Headers({
      "x-cloud-trace-context": "invalid",
      "x-request-id": "request-only-123",
    }),
  );
  assert.deepEqual(requestOnlyContext, {
    requestId: "request-only-123",
    traceId: null,
  });

  logBackgroundWarn("test.background", { job: "boot" });
  const background = JSON.parse(captured[captured.length - 1]);
  assert.equal(background.requestId, null);
  assert.equal(background.traceId, null);

  // Error passed → stack embedded in message
  const err = new Error("boom");
  logError("test.stack", {}, err);
  const stackObj = JSON.parse(captured[captured.length - 1]);
  assert.ok(
    stackObj.message.includes("test.stack"),
    "message must include event",
  );
  assert.ok(
    stackObj.message.includes("boom"),
    "message must include error text",
  );
  // err.stack includes newline between "Error: …" and frames
  assert.ok(
    stackObj.message.includes("\n"),
    "stack must embed newline in message value",
  );

  // Non-Error err → coerced to string detail in message
  logError("test.str_err", {}, "plain-string-error");
  const strObj = JSON.parse(captured[captured.length - 1]);
  assert.ok(strObj.message.includes("plain-string-error"));

  logWarn("test.redaction", {
    Password: "hunter2",
    nested: {
      accessToken: "nested-token",
      children: [
        { AUTHORIZATION: "Bearer abc" },
        { "X-Api-Key": "api-key-value", safe: "visible" },
      ],
    },
    requestBody: { email: "private@example.test" },
    safePayloadCount: 3,
  });
  const redacted = JSON.parse(captured[captured.length - 1]);
  assert.equal(redacted.Password, "[REDACTED]");
  assert.equal(redacted.nested.accessToken, "[REDACTED]");
  assert.equal(redacted.nested.children[0].AUTHORIZATION, "[REDACTED]");
  assert.equal(redacted.nested.children[1]["X-Api-Key"], "[REDACTED]");
  assert.equal(redacted.nested.children[1].safe, "visible");
  assert.equal(redacted.requestBody, "[REDACTED]");
  assert.equal(redacted.safePayloadCount, 3);
  assert.ok(!JSON.stringify(redacted).includes("private@example.test"));

  const deep: Record<string, unknown> = {};
  let cursor = deep;
  for (let index = 0; index < 12; index += 1) {
    const child: Record<string, unknown> = {};
    cursor.child = child;
    cursor = child;
  }
  cursor.secret = "too-deep-secret";
  logWarn("test.depth", {
    deep,
    values: Array.from({ length: 60 }, (_, i) => i),
  });
  const bounded = JSON.parse(captured[captured.length - 1]);
  assert.ok(JSON.stringify(bounded).includes("[MAX_DEPTH]"));
  assert.equal(bounded.values.length, 51);
  assert.ok(!JSON.stringify(bounded).includes("too-deep-secret"));

  logError(
    "test.assignment_redaction",
    { requestId: "invalid request id", traceId: "not-a-trace" },
    new Error("authorization=Bearer-secret password:super-secret"),
  );
  const safeError = JSON.parse(captured[captured.length - 1]);
  assert.equal(safeError.requestId, null);
  assert.equal(safeError.traceId, null);
  assert.ok(!safeError.message.includes("Bearer-secret"));
  assert.ok(!safeError.message.includes("super-secret"));

  logError("test.sensitive_context_keys", {
    databaseUrl: "postgresql://dbuser:context-secret@db.example/greyhoundiq",
    connectionString:
      "postgresql://dbuser:connection-secret@db.example/greyhoundiq",
    authHeader: "Bearer context-bearer-secret",
    privateMessageBody: "private-message-secret",
    uploadedFileContents: "uploaded-file-secret",
    providerPayload: "provider-payload-secret",
  });
  const safeContextKeys = JSON.parse(captured[captured.length - 1]);
  assert.equal(safeContextKeys.databaseUrl, "[REDACTED]");
  assert.equal(safeContextKeys.connectionString, "[REDACTED]");
  assert.equal(safeContextKeys.authHeader, "[REDACTED]");
  assert.equal(safeContextKeys.privateMessageBody, "[REDACTED]");
  assert.equal(safeContextKeys.uploadedFileContents, "[REDACTED]");
  assert.equal(safeContextKeys.providerPayload, "[REDACTED]");

  logWarn("test.context_text_redaction", {
    detail:
      "authorization=Bearer context-string-secret password=context-password",
    callback: () => "token=function-source-secret",
  });
  const safeContextText = JSON.parse(captured[captured.length - 1]);
  assert.ok(!safeContextText.detail.includes("context-string-secret"));
  assert.ok(!safeContextText.detail.includes("context-password"));
  assert.equal(safeContextText.callback, "[FUNCTION]");

  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZWNyZXQifQ.signature-segment"; // gitleaks:allow - redaction test sentinel
  logError(
    "test.error_text_redaction",
    {},
    new Error(
      `authorization: Bearer error-bearer-secret connect failed for private@example.test postgresql://dbuser:url-secret@db.example/greyhoundiq provider rejected ${jwt}`,
    ),
  );
  const safeErrorText = JSON.parse(captured[captured.length - 1]);
  for (const secret of [
    "error-bearer-secret",
    "private@example.test",
    "url-secret",
    "eyJzdWIiOiJzZWNyZXQifQ",
  ]) {
    assert.ok(!safeErrorText.message.includes(secret));
  }
  assert.match(safeErrorText.message, /\[REDACTED\]/);
} finally {
  delete process.env.K_SERVICE;
  delete process.env.K_REVISION;
  delete process.env.GOOGLE_CLOUD_REGION;
  console.error = origError;
  console.info = origInfo;
  console.warn = origWarn;
}

testRequestLoggingFallback()
  .then(() => console.log("logger tests passed"))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });

async function testRequestLoggingFallback() {
  const requestCaptured: string[] = [];
  const originalError = console.error;
  console.error = (line: string) => requestCaptured.push(line);
  try {
    const requestLog = logRequestError("test.request_fallback", {
      phase: "response",
    });
    assert.equal(
      requestCaptured.length,
      0,
      "request logging must remain awaitable before a response completes",
    );
    await requestLog;
    const requestFallback = JSON.parse(requestCaptured.at(-1) ?? "{}");
    assert.match(requestFallback.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(requestFallback.traceId, null);

    const rawDatabaseError = new Error(
      "duplicate user private@example.test secret=database-secret"
    );
    assert.match(rawDatabaseError.message, /private@example\.test/);
    await logRequestError(
      "auth.callback_sync_failed",
      {
        errorCode: "auth.local_acceptance_failed",
        errorClass: "local_acceptance",
      },
      rawDatabaseError,
    );
    const safeCallbackFailure = JSON.parse(requestCaptured.at(-1) ?? "{}");
    assert.match(safeCallbackFailure.message, /^auth\.callback_sync_failed:/);
    assert.equal(
      safeCallbackFailure.errorCode,
      "auth.local_acceptance_failed"
    );
    assert.equal(safeCallbackFailure.errorClass, "local_acceptance");
    assert.ok(!JSON.stringify(safeCallbackFailure).includes("private@example.test"));
    assert.ok(!JSON.stringify(safeCallbackFailure).includes("database-secret"));
  } finally {
    console.error = originalError;
  }
}
