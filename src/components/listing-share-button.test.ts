import assert from "node:assert/strict";

import {
  buildListingShareUrl,
  executeListingShare,
} from "./listing-share-button";

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function run() {
  assert.equal(
    buildListingShareUrl("https://greyhoundsiq.com.au/account", "listing/id"),
    "https://greyhoundsiq.com.au/marketplace/listing%2Fid",
  );

  const nativeCalls: ShareData[] = [];
  assert.equal(
    await executeListingShare({
      adapter: {
        share: async (data) => {
          nativeCalls.push(data);
        },
      },
      listingId: "listing-1",
      origin: "https://greyhoundsiq.com.au",
      title: "Race kennel equipment",
    }),
    "shared",
  );
  assert.deepEqual(nativeCalls, [
    {
      title: "Race kennel equipment",
      text: "Race kennel equipment",
      url: "https://greyhoundsiq.com.au/marketplace/listing-1",
    },
  ]);

  let copied = "";
  assert.equal(
    await executeListingShare({
      adapter: {
        clipboard: {
          writeText: async (value) => {
            copied = value;
          },
        },
      },
      listingId: "listing-2",
      origin: "https://greyhoundsiq.com.au/path",
      title: "Dog listing",
    }),
    "copied",
  );
  assert.equal(copied, "https://greyhoundsiq.com.au/marketplace/listing-2");

  copied = "";
  assert.equal(
    await executeListingShare({
      adapter: {
        share: async () => {
          throw new Error("native share failed");
        },
        clipboard: {
          writeText: async (value) => {
            copied = value;
          },
        },
      },
      listingId: "listing-3",
      origin: "https://greyhoundsiq.com.au",
      title: "Fallback listing",
    }),
    "copied",
  );
  assert.equal(copied, "https://greyhoundsiq.com.au/marketplace/listing-3");

  copied = "";
  const cancelled = new Error("cancelled");
  cancelled.name = "AbortError";
  assert.equal(
    await executeListingShare({
      adapter: {
        share: async () => {
          throw cancelled;
        },
        clipboard: {
          writeText: async (value) => {
            copied = value;
          },
        },
      },
      listingId: "listing-4",
      origin: "https://greyhoundsiq.com.au",
      title: "Cancelled listing",
    }),
    "cancelled",
  );
  assert.equal(copied, "", "cancelling native share must not copy silently");

  await assert.rejects(
    executeListingShare({
      adapter: {},
      listingId: "listing-5",
      origin: "https://greyhoundsiq.com.au",
      title: "Unavailable listing",
    }),
    /listing\.share_unavailable/,
  );

  console.log(
    "Listing share behavior passed: canonical URL encoding, native share, cancellation, clipboard fallback, and unavailable handling.",
  );
}
