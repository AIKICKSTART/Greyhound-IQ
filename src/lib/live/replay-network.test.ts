import assert from "node:assert/strict";
import type { LookupAllOptions, LookupOneOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import {
  Response as UndiciResponse,
  type Dispatcher,
} from "undici";

import {
  createPinnedReplayFetch,
  createPublicAddressLookup,
  isPublicInternetAddress,
  type ReplayAddressResolver,
  type ReplayResolvedAddress,
} from "./replay-network";

async function main() {
  for (const address of [
    "8.8.8.8",
    "1.1.1.1",
    "2606:4700:4700::1111",
    "2600:9000:277a:3a00:f:e0ac:e240:21",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
  ]) {
    assert.equal(isPublicInternetAddress(address), true, address);
  }

  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff00::1",
    "2001:db8::1",
    "2002:c0a8:101::1",
    "3fff::1",
    "::ffff:10.0.0.1",
    "::ffff:100.64.0.1",
    "::ffff:169.254.169.254",
    "not-an-address",
  ]) {
    assert.equal(isPublicInternetAddress(address), false, address);
  }

  await testLookupRejectsAnyPrivateResolution();
  await testLookupRevalidatesOnDnsRebinding();
  await testPinnedFetchWiresLookupToDispatcher();
  console.log("replay DNS pinning tests passed");
}

async function testLookupRejectsAnyPrivateResolution() {
  const mixedLookup = createPublicAddressLookup(async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ]);
  await assert.rejects(
    lookupOne(mixedLookup),
    (error: NodeJS.ErrnoException) => error.code === "EACCES",
  );

  for (const candidate of [
    { address: "127.0.0.1", family: 4 },
    { address: "169.254.169.254", family: 4 },
    { address: "fc00::1", family: 6 },
    { address: "fe80::1", family: 6 },
    { address: "::ffff:192.168.1.1", family: 6 },
  ]) {
    const lookup = createPublicAddressLookup(async () => [candidate]);
    await assert.rejects(
      lookupOne(lookup),
      (error: NodeJS.ErrnoException) => error.code === "EACCES",
      candidate.address,
    );
  }

  const allLookup = createPublicAddressLookup(async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 },
  ]);
  assert.deepEqual(await lookupAll(allLookup), [
    { address: "8.8.8.8", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 },
  ]);
}

async function testLookupRevalidatesOnDnsRebinding() {
  let calls = 0;
  const resolver: ReplayAddressResolver = async () => {
    calls += 1;
    return calls === 1
      ? [{ address: "8.8.8.8", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }];
  };
  const lookup = createPublicAddressLookup(resolver);
  assert.deepEqual(await lookupOne(lookup), {
    address: "8.8.8.8",
    family: 4,
  });
  await assert.rejects(
    lookupOne(lookup),
    (error: NodeJS.ErrnoException) => error.code === "EACCES",
  );
  assert.equal(calls, 2);
}

async function testPinnedFetchWiresLookupToDispatcher() {
  const dispatcher = {} as Dispatcher;
  let pinnedLookup: LookupFunction | undefined;
  let observedDispatcher: Dispatcher | undefined;
  const resolver: ReplayAddressResolver = async () => [
    { address: "8.8.8.8", family: 4 },
  ];
  const fetch = createPinnedReplayFetch(resolver, {
    createDispatcher(lookup) {
      pinnedLookup = lookup;
      return dispatcher;
    },
    async fetch(_input, init) {
      observedDispatcher = init?.dispatcher;
      return new UndiciResponse("ok");
    },
  });

  const response = await fetch(
    "https://d2w8yyjcswa0zt.cloudfront.net/replay.m3u8",
  );
  assert.equal(await response.text(), "ok");
  assert.equal(observedDispatcher, dispatcher);
  assert.ok(pinnedLookup);
  assert.deepEqual(await lookupOne(pinnedLookup), {
    address: "8.8.8.8",
    family: 4,
  });
}

function lookupOne(
  lookup: LookupFunction,
  options: LookupOneOptions = { all: false },
): Promise<ReplayResolvedAddress> {
  return new Promise((resolve, reject) => {
    lookup("allowed.example", options, (error, address, family) => {
      if (error) {
        reject(error);
        return;
      }
      if (typeof address !== "string" || !family) {
        reject(new Error("expected one pinned address"));
        return;
      }
      resolve({ address, family });
    });
  });
}

function lookupAll(
  lookup: LookupFunction,
  options: LookupAllOptions = { all: true },
): Promise<ReplayResolvedAddress[]> {
  return new Promise((resolve, reject) => {
    lookup("allowed.example", options, (error, addresses) => {
      if (error) {
        reject(error);
        return;
      }
      if (!Array.isArray(addresses)) {
        reject(new Error("expected pinned address list"));
        return;
      }
      resolve(addresses);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
