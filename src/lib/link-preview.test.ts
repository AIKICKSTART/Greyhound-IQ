import assert from "node:assert/strict";
import { Agent, Response, type RequestInit } from "undici";
import {
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
  await testPinnedLookup();
  await testRedirectResolutionAndPinning();
  await testPrivateRedirectRejected();
  console.log("link preview tests passed");
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
