import assert from "node:assert/strict";

import {
  fetchStorageObjectHead,
  resolveStorageUploadOptions,
} from "./supabase-storage";

function partialResponse(bytes: Uint8Array, headers: Record<string, string> = {}) {
  return new Response(bytes.buffer as ArrayBuffer, {
    status: 206,
    headers: {
      "content-length": String(bytes.byteLength),
      "content-range": `bytes 0-${bytes.byteLength - 1}/100`,
      ...headers,
    },
  });
}

async function main() {
assert.deepEqual(resolveStorageUploadOptions("image/png"), {
  cacheControl: "31536000",
  contentType: "image/png",
  upsert: true,
});
assert.deepEqual(
  resolveStorageUploadOptions("image/png", {
    cacheControl: null,
    upsert: false,
  }),
  { contentType: "image/png", upsert: false },
);

const calls: RequestInit[] = [];
const head = await fetchStorageObjectHead("https://storage.invalid/signed", 4, {
  fetchImpl: async (_input, init) => {
    calls.push(init ?? {});
    return partialResponse(new Uint8Array([1, 2, 3, 4]));
  },
});
assert.deepEqual([...head], [1, 2, 3, 4]);
assert.equal(calls[0].cache, "no-store");
assert.deepEqual(calls[0].headers, { Range: "bytes=0-3" });

await assert.rejects(() =>
  fetchStorageObjectHead("https://storage.invalid/signed", 4, {
    fetchImpl: async () =>
      new Response(new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-length": "4" },
      }),
  })
);
await assert.rejects(() =>
  fetchStorageObjectHead("https://storage.invalid/signed", 4, {
    fetchImpl: async () =>
      partialResponse(new Uint8Array([1, 2, 3, 4]), {
        "content-length": "5",
        "content-range": "bytes 0-4/100",
      }),
  })
);
await assert.rejects(() =>
  fetchStorageObjectHead("https://storage.invalid/signed", 4, {
    fetchImpl: async () =>
      new Response(new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer, {
        status: 206,
        headers: { "content-range": "bytes 0-3/100" },
      }),
  })
);

await assert.rejects(
  () =>
    fetchStorageObjectHead("https://storage.invalid/signed", 4, {
      timeoutMs: 10,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    }),
  /timeout|abort/i
);

await assert.rejects(
  () =>
    fetchStorageObjectHead("https://storage.invalid/signed", 4, {
      timeoutMs: 10,
      fetchImpl: async (_input, init) => {
        let controller: ReadableStreamDefaultController<Uint8Array>;
        const stream = new ReadableStream<Uint8Array>({
          start(value) {
            controller = value;
          },
        });
        init?.signal?.addEventListener("abort", () =>
          controller.error(init.signal?.reason)
        );
        return new Response(stream, {
          status: 206,
          headers: {
            "content-length": "4",
            "content-range": "bytes 0-3/100",
          },
        });
      },
    }),
  /timeout|abort/i
);

console.log("supabase storage tests passed");
}

const keepAlive = setInterval(() => undefined, 1000);
void main().then(
  () => clearInterval(keepAlive),
  (error) => {
    clearInterval(keepAlive);
    console.error(error);
    process.exitCode = 1;
  }
);
