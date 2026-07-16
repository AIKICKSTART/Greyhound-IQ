import assert from "node:assert/strict";

import { readBoundedTextResponse } from "./remote-response";

const policy = {
  maxBytes: 8,
  allowedContentTypes: ["text/html"],
} as const;

void main();

async function main() {
  assert.equal(
    await readBoundedTextResponse(
      new Response("safe", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      policy,
    ),
    "safe",
  );
  await assert.rejects(() =>
    readBoundedTextResponse(
      new Response("{}", { headers: { "content-type": "application/json" } }),
      policy,
    ),
  );
  await assert.rejects(() =>
    readBoundedTextResponse(
      new Response("unsafe", {
        headers: { "content-type": "text/html-malicious" },
      }),
      policy,
    ),
  );
  assert.equal(
    await readBoundedTextResponse(
      new Response("{}", {
        headers: { "content-type": "application/problem+json" },
      }),
      { ...policy, allowedContentTypes: ["+json"] },
    ),
    "{}",
  );
  await assert.rejects(() =>
    readBoundedTextResponse(
      new Response("oversized", { headers: { "content-type": "text/html" } }),
      policy,
    ),
  );
  await assert.rejects(() =>
    readBoundedTextResponse(
      new Response("safe", {
        headers: { "content-type": "text/html", "content-length": "9" },
      }),
      policy,
    ),
  );

  console.log("remote response tests passed");
}
