import assert from "node:assert/strict";

import {
  JSON_REQUEST_MAX_BYTES,
  readBoundedJsonOrFormRequest,
  readBoundedJsonRequest,
  readBoundedOptionalJsonRequest,
} from "./json-request";

async function expectCode(request: Request, code: string, maxBytes?: number) {
  await assert.rejects(
    readBoundedJsonRequest(request, maxBytes),
    (error: unknown) => error instanceof Error && error.message === code,
  );
}

async function main() {
  const accepted = await readBoundedJsonRequest(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/problem+json; charset=utf-8" },
      body: JSON.stringify({ ok: true }),
    }),
  );
  assert.deepEqual(accepted, { ok: true });
  assert.deepEqual(
    await readBoundedOptionalJsonRequest(
      new Request("http://local.test/api", { method: "POST" }),
    ),
    {},
  );
  assert.deepEqual(
    await readBoundedJsonOrFormRequest(
      new Request("http://local.test/api", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "plan=pro&interval=monthly",
      }),
    ),
    { plan: "pro", interval: "monthly" },
  );
  await assert.rejects(
    readBoundedJsonOrFormRequest(
      new Request("http://local.test/api", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "--x--",
      }),
    ),
    /request\.unsupported_media_type/,
  );

  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }),
    "request.unsupported_media_type",
  );
  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-encoding": "gzip",
      },
      body: "{}",
    }),
    "request.unsupported_content_encoding",
  );
  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(JSON_REQUEST_MAX_BYTES + 1),
      },
      body: "{}",
    }),
    "request.body_too_large",
  );
  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "not-a-number",
      },
      body: "{}",
    }),
    "request.invalid_body",
  );
  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
    "request.invalid_body",
  );

  const oversizedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(5));
      controller.enqueue(new Uint8Array(5));
      controller.close();
    },
  });
  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversizedStream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    "request.body_too_large",
    8,
  );

  console.log("bounded JSON request tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
