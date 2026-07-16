import assert from "node:assert/strict";

import {
  boundResponseBody,
  classifyReplayContent,
  fetchReplayTarget,
  MAX_REPLAY_RANGE_HEADER_LENGTH,
  MAX_REPLAY_STREAM_BYTES,
  MISSING_REPLAY_CLIENT_KEY,
  normalizeReplayRange,
  ReplayStreamSemaphore,
  rewriteManifest,
  serveReplayTarget,
} from "./handler";
import { GET } from "./route";

process.env.REPLAY_PROXY_SECRET ||= "test-secret-for-replay-proxy-route";

const START = "https://d2w8yyjcswa0zt.cloudfront.net/start.m3u8";
const FINAL = "https://mediatdogs.skyracing.com.au/final.m3u8";
const STREAM = "https://d2w8yyjcswa0zt.cloudfront.net/video.mp4";

async function main() {
  await testManualRedirectsAndAuthorityValidation();
  testManifestBounds();
  testSingleRangeValidation();
  await testContentTypePolicy();
  await testRangeForwardingAndSemaphoreCompletion();
  await testPerClientConcurrencyFairness();
  await testEarlyResponseCancellation();
  await testBoundedBodyCancellationAndRelease();
  await testHeaderDeadlineAndBodyIdlePolicy();
  await testLocalAdmissionControl();
  console.log("replay proxy hardening tests passed");
}

async function testManualRedirectsAndAuthorityValidation() {
  const calls: Array<{ input: string; redirect: RequestRedirect | undefined }> = [];
  let redirectCancelled = false;
  const allowedRedirectFetch = async (
    input: string | URL,
    init?: RequestInit,
  ) => {
    const value = String(input);
    calls.push({ input: value, redirect: init?.redirect });
    if (value === START) {
      return new Response(
        new ReadableStream({
          cancel() {
            redirectCancelled = true;
          },
        }),
        { status: 302, headers: { location: FINAL } },
      );
    }
    return new Response("manifest", { status: 200 });
  };

  for (const target of [
    "https://attacker.example/replay.m3u8",
    "https://user:pass@d2w8yyjcswa0zt.cloudfront.net/replay.m3u8",
    "https://d2w8yyjcswa0zt.cloudfront.net:8443/replay.m3u8",
    "https://d2w8yyjcswa0zt.cloudfront.net/replay.m3u8#fragment",
  ]) {
    await assert.rejects(
      fetchReplayTarget(target, {}, allowedRedirectFetch),
      /replay\.fetch_target_not_allowed/,
    );
  }

  const allowed = await fetchReplayTarget(START, {}, allowedRedirectFetch);
  assert.equal(allowed.target, FINAL);
  assert.equal(await allowed.response.text(), "manifest");
  assert.equal(redirectCancelled, true);
  assert.deepEqual(calls, [
    { input: START, redirect: "manual" },
    { input: FINAL, redirect: "manual" },
  ]);

  for (const location of [
    "https://attacker.example/replay.m3u8",
    "http://d2w8yyjcswa0zt.cloudfront.net/insecure.m3u8",
    "http://169.254.169.254/latest/meta-data/",
    "https://user@d2w8yyjcswa0zt.cloudfront.net/replay.m3u8",
    "https://d2w8yyjcswa0zt.cloudfront.net:444/replay.m3u8",
    "https://d2w8yyjcswa0zt.cloudfront.net/replay.m3u8#fragment",
  ]) {
    await assert.rejects(
      fetchReplayTarget(
        START,
        {},
        async () => new Response(null, { status: 302, headers: { location } }),
      ),
      /replay\.redirect_target_not_allowed/,
    );
  }

  await assert.rejects(
    fetchReplayTarget(
      START,
      {},
      async () => new Response(null, { status: 302 }),
    ),
    /replay\.redirect_location_missing/,
  );

  await assert.rejects(
    fetchReplayTarget(
      START,
      {},
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            location: "https://d2w8yyjcswa0zt.cloudfront.net/loop.m3u8",
          },
        }),
    ),
    /replay\.redirect_limit_exceeded/,
  );
}

function testManifestBounds() {
  const rewritten = rewriteManifest(
    '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment.ts',
    START,
  );
  assert.match(rewritten, /URI="\/api\/replay\/stream\?t=/);
  assert.match(rewritten, /\n\/api\/replay\/stream\?t=/);

  assert.throws(
    () => rewriteManifest("one.ts\ntwo.ts", START, { maxUris: 1 }),
    /replay\.manifest_uri_limit_exceeded/,
  );
  assert.throws(
    () => rewriteManifest("one.ts", START, { maxOutputBytes: 32 }),
    /replay\.manifest_output_limit_exceeded/,
  );
  assert.throws(
    () => rewriteManifest("#EXTM3U\n\n\n", START, { maxLines: 2 }),
    /replay\.manifest_line_limit_exceeded/,
  );
  assert.throws(
    () => rewriteManifest("https://attacker.example/segment.ts", START),
    /replay\.manifest_target_not_allowed/,
  );
}

function testSingleRangeValidation() {
  assert.equal(normalizeReplayRange("bytes=0-99"), "bytes=0-99");
  assert.equal(normalizeReplayRange("BYTES=000-099"), "bytes=0-99");
  assert.equal(normalizeReplayRange("bytes=100-"), "bytes=100-");
  assert.equal(normalizeReplayRange("bytes=-1024"), "bytes=-1024");
  const maximumLengthRange = `bytes=${"0".repeat(
    MAX_REPLAY_RANGE_HEADER_LENGTH - "bytes=".length - 1,
  )}-`;
  assert.equal(maximumLengthRange.length, MAX_REPLAY_RANGE_HEADER_LENGTH);
  assert.equal(normalizeReplayRange(maximumLengthRange), "bytes=0-");
  for (const invalid of [
    `bytes=${"0".repeat(MAX_REPLAY_RANGE_HEADER_LENGTH - "bytes=".length)}-`,
    " bytes=0-99 ",
    "items=0-1",
    "bytes=-",
    "bytes=2-1",
    "bytes=0-1,4-5",
    `bytes=-${MAX_REPLAY_STREAM_BYTES + 1}`,
    `bytes=0-${MAX_REPLAY_STREAM_BYTES}`,
    "bytes=999999999999999999999-",
  ]) {
    assert.equal(normalizeReplayRange(invalid), null, invalid);
  }
}

async function testContentTypePolicy() {
  for (const contentType of [
    "application/vnd.apple.mpegurl",
    "application/x-mpegURL; charset=utf-8",
    "audio/mpegurl",
    "audio/x-mpegurl",
  ]) {
    assert.equal(
      classifyReplayContent(
        START,
        new Response(null, { headers: { "content-type": contentType } }),
      ),
      "manifest",
      contentType,
    );
  }

  for (const contentType of [
    "video/mp4",
    "video/mp2t",
    "video/iso.segment",
    "audio/aac",
    "audio/mpeg",
    "application/octet-stream",
  ]) {
    assert.equal(
      classifyReplayContent(
        STREAM,
        new Response(null, { headers: { "content-type": contentType } }),
      ),
      "media",
      contentType,
    );
  }

  assert.equal(
    classifyReplayContent(
      STREAM,
      new Response(null, { headers: { "content-type": "text/html" } }),
    ),
    null,
  );
  assert.equal(classifyReplayContent(STREAM, new Response(null)), null);
  assert.equal(
    classifyReplayContent(
      START,
      new Response(null, { headers: { "content-type": "video/mp4" } }),
    ),
    null,
  );

  let activeBodyCancelled = false;
  const activeSemaphore = new ReplayStreamSemaphore(1);
  const activeResponse = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    {
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              activeBodyCancelled = true;
            },
          }),
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
      semaphore: activeSemaphore,
      clientKey: "active-content-client",
    },
  );
  assert.equal(activeResponse.status, 502);
  assert.equal(activeBodyCancelled, true);
  assert.equal(activeSemaphore.activeCount, 0);
  assert.equal(
    activeResponse.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );

  const manifestSemaphore = new ReplayStreamSemaphore(1);
  const manifestResponse = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    START,
    {
      fetchImpl: async () =>
        new Response("#EXTM3U\nsegment.ts", {
          headers: { "content-type": "application/x-mpegURL" },
        }),
      semaphore: manifestSemaphore,
      clientKey: "manifest-client",
    },
  );
  assert.equal(manifestResponse.status, 200);
  assert.match(await manifestResponse.text(), /\/api\/replay\/stream\?t=/);
  assert.equal(manifestSemaphore.activeCount, 0);
  assert.equal(
    manifestResponse.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );

  const keySemaphore = new ReplayStreamSemaphore(1);
  const keyResponse = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    "https://d2w8yyjcswa0zt.cloudfront.net/key.bin",
    {
      fetchImpl: async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { "content-type": "application/octet-stream" },
        }),
      semaphore: keySemaphore,
      clientKey: "key-client",
    },
  );
  assert.equal(keyResponse.status, 200);
  assert.deepEqual(
    new Uint8Array(await keyResponse.arrayBuffer()),
    new Uint8Array([1, 2, 3, 4]),
  );
  assert.equal(keySemaphore.activeCount, 0);
}

async function testRangeForwardingAndSemaphoreCompletion() {
  const semaphore = new ReplayStreamSemaphore(1);
  let forwardedRange: string | null = null;
  let fetchCalls = 0;
  const fetchImpl = async (_input: string | URL, init?: RequestInit) => {
    fetchCalls += 1;
    forwardedRange = new Headers(init?.headers).get("range");
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 206,
      headers: {
        "content-type": "video/mp4",
        "content-length": "4",
        "content-range": "bytes 0-3/4",
      },
    });
  };

  const response = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream", {
      headers: { range: "bytes=0-3" },
    }),
    STREAM,
    { fetchImpl, semaphore },
  );
  assert.equal(response.status, 206);
  assert.equal(forwardedRange, "bytes=0-3");
  assert.equal(semaphore.activeCount, 1);
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cache-control"), "private, no-store");

  const saturated = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    { fetchImpl, semaphore },
  );
  assert.equal(saturated.status, 503);
  assert.equal(saturated.headers.get("retry-after"), "1");
  assert.equal(fetchCalls, 1);

  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
  assert.equal(semaphore.activeCount, 0);

  const invalidRange = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream", {
      headers: { range: "bytes=0-1,4-5" },
    }),
    STREAM,
    { fetchImpl, semaphore },
  );
  assert.equal(invalidRange.status, 416);
  assert.equal(fetchCalls, 1);
  assert.equal(semaphore.activeCount, 0);
}

async function testPerClientConcurrencyFairness() {
  const semaphore = new ReplayStreamSemaphore(8, 4);
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(new ReadableStream<Uint8Array>(), {
      headers: { "content-type": "video/mp4" },
    });
  };

  const clientAResponses = await Promise.all(
    Array.from({ length: 4 }, () =>
      serveReplayTarget(
        new Request("http://localhost/api/replay/stream"),
        STREAM,
        { fetchImpl, semaphore, clientKey: "client-a" },
      )),
  );
  assert.equal(semaphore.activeCount, 4);
  assert.equal(semaphore.activeCountFor("client-a"), 4);

  const clientABlocked = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    { fetchImpl, semaphore, clientKey: "client-a" },
  );
  assert.equal(clientABlocked.status, 503);
  assert.equal(fetchCalls, 4);

  const clientBResponse = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    { fetchImpl, semaphore, clientKey: "client-b" },
  );
  assert.equal(clientBResponse.status, 200);
  assert.equal(fetchCalls, 5);
  assert.equal(semaphore.activeCountFor("client-b"), 1);
  assert.equal(semaphore.activeCount, 5);

  await Promise.all(
    [...clientAResponses, clientBResponse].map((response) =>
      response.body?.cancel()),
  );
  assert.equal(semaphore.activeCount, 0);
  assert.equal(semaphore.activeCountFor("client-a"), 0);
  assert.equal(semaphore.activeCountFor("client-b"), 0);

  const missingSemaphore = new ReplayStreamSemaphore(8, 4);
  const missingResponses = await Promise.all(
    Array.from({ length: 4 }, () =>
      serveReplayTarget(
        new Request("http://localhost/api/replay/stream"),
        STREAM,
        { fetchImpl, semaphore: missingSemaphore },
      )),
  );
  const missingBlocked = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    { fetchImpl, semaphore: missingSemaphore },
  );
  assert.equal(missingBlocked.status, 503);
  assert.equal(missingSemaphore.activeCountFor(MISSING_REPLAY_CLIENT_KEY), 4);
  await Promise.all(missingResponses.map((response) => response.body?.cancel()));
  assert.equal(missingSemaphore.activeCount, 0);
}

async function testEarlyResponseCancellation() {
  for (const init of [
    { status: 500 },
    {
      status: 200,
      headers: {
        "content-type": "video/mp4",
        "content-length": String(MAX_REPLAY_STREAM_BYTES + 1),
      },
    },
  ]) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const upstream = new Response(body, init);
    const semaphore = new ReplayStreamSemaphore(1);
    const result = await serveReplayTarget(
      new Request("http://localhost/api/replay/stream"),
      STREAM,
      { fetchImpl: async () => upstream, semaphore },
    );
    assert.equal(result.status, 502);
    assert.equal(cancelled, true);
    assert.equal(semaphore.activeCount, 0);
  }

  const failedFetchSemaphore = new ReplayStreamSemaphore(1);
  const failedFetch = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    {
      fetchImpl: async () => {
        throw new Error("upstream unavailable");
      },
      semaphore: failedFetchSemaphore,
    },
  );
  assert.equal(failedFetch.status, 502);
  assert.equal(failedFetchSemaphore.activeCount, 0);

  const invalidManifestSemaphore = new ReplayStreamSemaphore(1);
  const invalidManifest = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    START,
    {
      fetchImpl: async () =>
        new Response("https://attacker.example/segment.ts", {
          headers: { "content-type": "application/vnd.apple.mpegurl" },
        }),
      semaphore: invalidManifestSemaphore,
    },
  );
  assert.equal(invalidManifest.status, 502);
  assert.equal(invalidManifestSemaphore.activeCount, 0);
}

async function testBoundedBodyCancellationAndRelease() {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const semaphore = new ReplayStreamSemaphore(1);
  const release = semaphore.tryAcquire("bounded-body-test");
  assert.ok(release);
  const bounded = boundResponseBody(body, 4, { onFinalize: release });
  await assert.rejects(new Response(bounded).arrayBuffer(), /replay\.response_too_large/);
  await Promise.resolve();
  assert.equal(cancelled, true);
  assert.equal(semaphore.activeCount, 0);
}

async function testHeaderDeadlineAndBodyIdlePolicy() {
  let clientCancelled = false;
  const clientSemaphore = new ReplayStreamSemaphore(1);
  const client = new AbortController();
  const clientResponse = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream", {
      signal: client.signal,
    }),
    STREAM,
    {
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              clientCancelled = true;
            },
          }),
          { headers: { "content-type": "video/mp4" } },
        ),
      semaphore: clientSemaphore,
      clientKey: "client-abort",
      bodyIdleTimeoutMs: 1_000,
    },
  );
  client.abort(new Error("client disconnected"));
  await assert.rejects(clientResponse.arrayBuffer());
  await delay(0);
  assert.equal(clientCancelled, true);
  assert.equal(clientSemaphore.activeCount, 0);

  const headerSemaphore = new ReplayStreamSemaphore(1);
  const headerTimeout = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    {
      fetchImpl: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          const abort = () => reject(signal?.reason);
          if (signal?.aborted) abort();
          else signal?.addEventListener("abort", abort, { once: true });
        }),
      semaphore: headerSemaphore,
      clientKey: "header-timeout",
      headerTimeoutMs: 25,
      bodyIdleTimeoutMs: 1_000,
    },
  );
  assert.equal(headerTimeout.status, 502);
  assert.equal(headerSemaphore.activeCount, 0);

  let emitted = 0;
  const continuousSemaphore = new ReplayStreamSemaphore(1);
  const continuousResponse = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    {
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async pull(controller) {
              await delay(15);
              if (emitted === 4) {
                controller.close();
                return;
              }
              emitted += 1;
              controller.enqueue(new Uint8Array([emitted]));
            },
          }),
          { headers: { "content-type": "video/mp4" } },
        ),
      semaphore: continuousSemaphore,
      clientKey: "slow-continuous",
      headerTimeoutMs: 20,
      bodyIdleTimeoutMs: 40,
    },
  );
  assert.deepEqual(
    new Uint8Array(await continuousResponse.arrayBuffer()),
    new Uint8Array([1, 2, 3, 4]),
  );
  assert.equal(continuousSemaphore.activeCount, 0);

  let idleCancelled = false;
  const idleSemaphore = new ReplayStreamSemaphore(1);
  const idleResponse = await serveReplayTarget(
    new Request("http://localhost/api/replay/stream"),
    STREAM,
    {
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([1]));
            },
            cancel() {
              idleCancelled = true;
            },
          }),
          { headers: { "content-type": "video/mp4" } },
        ),
      semaphore: idleSemaphore,
      clientKey: "idle-stall",
      bodyIdleTimeoutMs: 25,
    },
  );
  await assert.rejects(
    idleResponse.arrayBuffer(),
    /replay\.response_idle_timeout/,
  );
  await delay(0);
  assert.equal(idleCancelled, true);
  assert.equal(idleSemaphore.activeCount, 0);
}

async function testLocalAdmissionControl() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await GET(
      new Request("http://localhost/api/replay/stream?t=x"),
    );
    assert.equal(response.status, 403, `attempt ${attempt} should reach token denial`);
  }
  const limited = await GET(
    new Request("http://localhost/api/replay/stream?t=x"),
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("ratelimit-limit"), "30");
  assert.equal(limited.headers.get("ratelimit-remaining"), "0");
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal(limited.headers.get("cache-control"), "private, no-store");
  assert.equal(limited.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(limited.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(await limited.json(), {
    error: {
      code: "rate_limit.exceeded",
      message: "Too many replay requests",
    },
  });
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
