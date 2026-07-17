import assert from "node:assert/strict";

import {
  JSON_REQUEST_MAX_ARRAY_ITEMS,
  JSON_REQUEST_MAX_BYTES,
  JSON_REQUEST_MAX_DEPTH,
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
    await readBoundedJsonRequest(
      new Request("http://local.test/api", {
        method: "POST",
        headers: { "content-type": 'application/json; charset="UTF-8"' },
        body: "[]",
      }),
    ),
    [],
  );
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
  for (const contentType of [
    "application/json; charset=iso-8859-1",
    "application/json; charset=utf-8; charset=utf-8",
  ]) {
    await expectCode(
      new Request("http://local.test/api", {
        method: "POST",
        headers: { "content-type": contentType },
        body: "{}",
      }),
      "request.unsupported_media_type",
    );
  }
  await assert.rejects(
    readBoundedJsonOrFormRequest(
      new Request("http://local.test/api", {
        method: "POST",
        headers: {
          "content-type":
            "application/x-www-form-urlencoded; charset=iso-8859-1",
        },
        body: "name=test",
      }),
    ),
    /request\.unsupported_media_type/,
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
  const maximumArray = await readBoundedJsonRequest(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Array(JSON_REQUEST_MAX_ARRAY_ITEMS).fill(null)),
    }),
  );
  assert.ok(Array.isArray(maximumArray));
  assert.equal(maximumArray.length, JSON_REQUEST_MAX_ARRAY_ITEMS);
  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Array(JSON_REQUEST_MAX_ARRAY_ITEMS + 1).fill(null)),
    }),
    "request.invalid_body",
  );
  await readBoundedJsonRequest(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nestedObject(JSON_REQUEST_MAX_DEPTH)),
    }),
  );
  await expectCode(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nestedObject(JSON_REQUEST_MAX_DEPTH + 1)),
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

function nestedObject(depth: number) {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) value = { value };
  return value;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
