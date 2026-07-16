import assert from "node:assert/strict";

import {
  createRequestId,
  deriveRequestId,
  normalizeRequestId,
  normalizeTraceId,
  parseCloudTraceId,
} from "./request-id";

const traceId = "105445aa7843bc8bf206b12000100000";

assert.equal(
  deriveRequestId(
    new Headers({
      "x-cloud-trace-context": `${traceId.toUpperCase()}/123;o=1`,
      "x-request-id": "caller-id",
    })
  ),
  "caller-id",
  "trace propagation must not replace the independent request id"
);
assert.equal(parseCloudTraceId(`${traceId}/0;o=0`), traceId);
assert.equal(parseCloudTraceId(`${traceId}/not-a-span;o=1`), undefined);
assert.equal(parseCloudTraceId(`${traceId}suffix/1;o=1`), undefined);

assert.equal(normalizeRequestId("  request-123:A.B  "), "request-123:A.B");
assert.equal(normalizeRequestId("contains whitespace"), undefined);
assert.equal(normalizeRequestId("bad\nheader"), undefined);
assert.equal(normalizeRequestId("x".repeat(129)), undefined);
assert.equal(normalizeTraceId(traceId.toUpperCase()), traceId);
assert.equal(normalizeTraceId("f".repeat(31)), undefined);

const generated = deriveRequestId(
  new Headers({
    "x-cloud-trace-context": "invalid",
    "x-request-id": "x".repeat(129),
  })
);
assert.match(generated, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const boundaryId = createRequestId();
assert.match(
  boundaryId,
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);
assert.notEqual(boundaryId, "caller-id");

console.log("request id tests passed");
