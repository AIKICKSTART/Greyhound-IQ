import assert from "node:assert/strict";
import { Agent, Response, type RequestInit } from "undici";
import {
  assertPublicHttpUrl,
  createPinnedLookup,
  extractLinkPreview,
  fetchLinkPreview,
  firstPreviewUrl,
  isPublicIpAddress,
} from "./link-preview";

assert.equal(firstPreviewUrl("Read https://example.com/story now"), "https://example.com/story");
assert.equal(firstPreviewUrl("no link"), null);
assert.equal(isPublicIpAddress("127.0.0.1"), false);
assert.equal(isPublicIpAddress("10.1.2.3"), false);
assert.equal(isPublicIpAddress("169.254.169.254"), false);
assert.equal(isPublicIpAddress("100.64.0.1"), false);
assert.equal(isPublicIpAddress("192.0.2.10"), false);
assert.equal(isPublicIpAddress("198.51.100.10"), false);
assert.equal(isPublicIpAddress("203.0.113.10"), false);
assert.equal(isPublicIpAddress("240.0.0.1"), false);
assert.equal(isPublicIpAddress("8.8.8.8"), true);
assert.equal(isPublicIpAddress("::1"), false);
assert.equal(isPublicIpAddress("::10.0.0.1"), false);
assert.equal(isPublicIpAddress("64:ff9b::a00:1"), false);
assert.equal(isPublicIpAddress("fec0::1"), false);
assert.equal(isPublicIpAddress("ff02::1"), false);
assert.equal(isPublicIpAddress("2606:4700:4700::1111"), true);

assert.deepEqual(
  extractLinkPreview(
    '<title>Fallback</title><meta property="og:title" content="Track &amp; Trial"><meta name="description" content="  Safe  preview  "><meta property="og:image" content="/hero.jpg">',
    "https://example.com/news"
  ),
  {
    url: "https://example.com/news",
    title: "Track & Trial",
    description: "Safe preview",
    imageUrl: "https://example.com/hero.jpg",
    siteName: null,
  }
);

void main();

async function main() {
  await testInputPolicy();
  await testPinnedLookup();
  await testRedirectResolutionAndPinning();
  await testPrivateRedirectRejected();
  await testResponseAndCredentialControls();
  await testRedirectBudget();
  await testPrivateMetadataImageRejected();
  console.log("link preview tests passed");
}

async function testInputPolicy() {
  const publicResolver = async () => [{ address: "8.8.8.8", family: 4 }];
  for (const value of [
    "file:///etc/passwd",
    "ftp://public.example/file",
    "https://user:password@public.example/private",
    "https://public.example:8443/private",
  ]) {
    await assert.rejects(() => assertPublicHttpUrl(value, publicResolver));
  }
  await assert.rejects(
    () =>
      assertPublicHttpUrl(
        "http://metadata.google.internal/computeMetadata/v1",
        async () => [{ address: "169.254.169.254", family: 4 }],
      ),
    /link_preview\.private_address/,
  );
}

async function testPinnedLookup() {
  const pinnedLookup = createPinnedLookup("preview.example", [
    { address: "8.8.8.8", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 },
  ]);
  const result = await new Promise<{ address: string; family: number }>((resolve, reject) => {
    pinnedLookup("preview.example", { family: 4 }, (error, address, family) => {
      if (error) return reject(error);
      if (typeof address !== "string") return reject(new Error("Expected one address"));
      resolve({ address, family: family ?? 0 });
    });
  });
  assert.deepEqual(result, { address: "8.8.8.8", family: 4 });

  await assert.rejects(
    new Promise((resolve, reject) => {
      pinnedLookup("rebound.example", {}, (error) => error ? reject(error) : resolve(null));
    }),
    /Pinned DNS hostname mismatch/
  );
}

async function testRedirectResolutionAndPinning() {
  const resolvedHosts: string[] = [];
  const requestedUrls: string[] = [];
  const resolver = async (hostname: string) => {
    resolvedHosts.push(hostname);
    return [{ address: hostname === "one.example" ? "8.8.8.8" : "1.1.1.1", family: 4 }];
  };
  const fetcher = async (input: string, init: RequestInit) => {
    requestedUrls.push(input);
    assert.ok(init.dispatcher instanceof Agent);
    if (input === "https://one.example/start") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://two.example/story" },
      });
    }
    return new Response("<title>Pinned redirect</title>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };

  const preview = await fetchLinkPreview(
    "https://one.example/start",
    fetcher,
    resolver
  );
  assert.equal(preview.url, "https://two.example/story");
  assert.deepEqual(requestedUrls, [
    "https://one.example/start",
    "https://two.example/story",
  ]);
  assert.deepEqual(resolvedHosts, ["one.example", "two.example"]);
}

async function testPrivateRedirectRejected() {
  let fetchCount = 0;
  await assert.rejects(
    fetchLinkPreview(
      "https://public.example/start",
      async () => {
        fetchCount += 1;
        return new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        });
      },
      async () => [{ address: "8.8.8.8", family: 4 }]
    ),
    /link_preview\.private_address/
  );
  assert.equal(fetchCount, 1);
}

async function testResponseAndCredentialControls() {
  const publicResolver = async () => [{ address: "8.8.8.8", family: 4 }];
  let capturedInit: RequestInit | undefined;
  const preview = await fetchLinkPreview(
    "https://public.example/story",
    async (_input, init) => {
      capturedInit = init;
      return new Response("<title>Safe</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
    publicResolver,
  );
  assert.equal(preview.title, "Safe");
  assert.equal(capturedInit?.redirect, "manual");
  assert.ok(capturedInit?.signal);
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers.Cookie, undefined);

  await assert.rejects(
    () =>
      fetchLinkPreview(
        "https://public.example/data",
        async () =>
          new Response("{}", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        publicResolver,
      ),
    /link_preview\.invalid_content_type/,
  );
  await assert.rejects(
    () =>
      fetchLinkPreview(
        "https://public.example/large",
        async () =>
          new Response("x".repeat(512 * 1024 + 1), {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        publicResolver,
      ),
    /link_preview\.response_too_large/,
  );
}

async function testRedirectBudget() {
  let fetchCount = 0;
  await assert.rejects(
    () =>
      fetchLinkPreview(
        "https://public.example/start",
        async () => {
          fetchCount += 1;
          return new Response(null, {
            status: 302,
            headers: { location: `/redirect-${fetchCount}` },
          });
        },
        async () => [{ address: "8.8.8.8", family: 4 }],
      ),
    /link_preview\.redirect_rejected/,
  );
  assert.equal(fetchCount, 4);
}

async function testPrivateMetadataImageRejected() {
  const preview = await fetchLinkPreview(
    "https://public.example/story",
    async () =>
      new Response(
        '<meta property="og:image" content="http://127.0.0.1/admin">',
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    async (hostname) =>
      hostname === "public.example"
        ? [{ address: "8.8.8.8", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }],
  );
  assert.equal(preview.imageUrl, null);
}
