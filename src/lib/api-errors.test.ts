import assert from "node:assert/strict";

import { jsonError } from "./api-errors";

async function main() {
  const capturedErrors: string[] = [];
  const capturedWarnings: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (line: string) => capturedErrors.push(line);
  console.warn = (line: string) => capturedWarnings.push(line);
  try {
    const storageUnavailable = await jsonError(
      new Error("media.storage_unavailable"),
      "Could not finalize media",
    );
    assert.equal(storageUnavailable.status, 503);
    assert.deepEqual(await storageUnavailable.json(), {
      error: {
        code: "media.storage_unavailable",
        message: "Could not finalize media",
      },
    });
    assert.match(
      storageUnavailable.headers.get("x-request-id") ?? "",
      /^[0-9a-f-]{36}$/i,
    );
    assert.equal(storageUnavailable.headers.get("cache-control"), "no-store");

    const forbidden = await jsonError(new Error("auth.forbidden"));
    assert.equal(forbidden.status, 403);
    assert.deepEqual(await forbidden.json(), {
      error: { code: "auth.forbidden", message: "auth.forbidden" },
    });

    const oversized = await jsonError(new Error("request.body_too_large"));
    assert.equal(oversized.status, 413);
    const unsupported = await jsonError(
      new Error("request.unsupported_media_type"),
    );
    assert.equal(unsupported.status, 415);
    const encoded = await jsonError(
      new Error("request.unsupported_content_encoding"),
    );
    assert.equal(encoded.status, 415);

    const internal = await jsonError(
      new Error("database failed password=do-not-log"),
      "Could not complete request",
    );
    assert.equal(internal.status, 500);
    assert.ok(!(await internal.text()).includes("do-not-log"));
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  assert.equal(capturedErrors.length, 2);
  assert.equal(capturedWarnings.length, 4);
  const entry = JSON.parse(capturedErrors.at(-1) ?? "{}");
  assert.match(entry.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(entry.traceId, null);
  assert.equal(entry.event, "api.internal_error");
  assert.equal(entry.status, 500);
  assert.equal(entry.outcome, "denied");
  assert.ok(!JSON.stringify(entry).includes("do-not-log"));

  const rejection = JSON.parse(capturedWarnings[0] ?? "{}");
  assert.equal(rejection.event, "api.request_rejected");
  assert.equal(rejection.code, "auth.forbidden");
  assert.equal(rejection.status, 403);
  assert.equal(rejection.outcome, "denied");

  console.log("api error tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
